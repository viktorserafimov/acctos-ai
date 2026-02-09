import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { verifyHmacSignature } from '../middleware/hmac.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

// Event ingestion schema
const eventSchema = z.object({
    tenantId: z.string(),
    source: z.enum(['make', 'azure', 'openai']),
    documentType: z.enum(['bank', 'vat']).optional(),
    fileType: z.enum(['pdf', 'excel']).optional(),
    step: z.enum(['split', 'ocr', 'classify', 'route', 'finalize']).optional(),
    chunkStart: z.number().optional(),
    chunkEnd: z.number().optional(),
    bankCode: z.string().optional(),
    cost: z.number().optional(),
    tokens: z.number().optional(),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.string().datetime().optional(),
});

/**
 * POST /v1/events/ingest
 * 
 * Called by Make.com, Azure, or OpenAI to report processing events.
 * Requires HMAC signature and idempotency key.
 */
router.post(
    '/ingest',
    verifyHmacSignature,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;

            // Get idempotency key from header
            const idempotencyKey = req.headers['idempotency-key'] as string;
            if (!idempotencyKey) {
                return next(createError('Missing Idempotency-Key header', 400, 'MISSING_IDEMPOTENCY_KEY'));
            }

            // Validate event data
            const data = eventSchema.parse(req.body);

            // Verify tenant exists
            const tenant = await prisma.tenant.findUnique({
                where: { id: data.tenantId },
            });

            if (!tenant) {
                return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
            }

            // Try to insert (idempotent - will fail silently on duplicate)
            try {
                const event = await prisma.usageEvent.create({
                    data: {
                        tenantId: data.tenantId,
                        source: data.source,
                        idempotencyKey,
                        documentType: data.documentType,
                        fileType: data.fileType,
                        step: data.step,
                        chunkStart: data.chunkStart,
                        chunkEnd: data.chunkEnd,
                        bankCode: data.bankCode,
                        cost: data.cost ? new Decimal(data.cost) : null,
                        tokens: data.tokens,
                        metadata: data.metadata,
                        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                    },
                });

                // Update daily aggregate (upsert)
                const eventDate = new Date(event.timestamp);
                eventDate.setHours(0, 0, 0, 0);

                await prisma.usageAggregate.upsert({
                    where: {
                        tenantId_date_source_documentType_fileType_step_bankCode: {
                            tenantId: data.tenantId,
                            date: eventDate,
                            source: data.source,
                            documentType: data.documentType || '',
                            fileType: data.fileType || '',
                            step: data.step || '',
                            bankCode: data.bankCode || '',
                        },
                    },
                    create: {
                        tenantId: data.tenantId,
                        date: eventDate,
                        source: data.source,
                        documentType: data.documentType || '',
                        fileType: data.fileType || '',
                        step: data.step || '',
                        bankCode: data.bankCode || '',
                        eventCount: 1,
                        totalCost: data.cost ? new Decimal(data.cost) : new Decimal(0),
                        totalTokens: data.tokens || 0,
                    },
                    update: {
                        eventCount: { increment: 1 },
                        totalCost: { increment: data.cost || 0 },
                        totalTokens: { increment: data.tokens || 0 },
                    },
                });

                res.status(201).json({
                    status: 'created',
                    eventId: event.id,
                });
            } catch (error: unknown) {
                // Handle duplicate key error (idempotent behavior)
                if (
                    error instanceof PrismaClientKnownRequestError &&
                    error.code === 'P2002'
                ) {
                    res.status(200).json({
                        status: 'duplicate',
                        message: 'Event already processed',
                    });
                    return;
                }
                throw error;
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                return next(createError('Invalid event data: ' + error.errors[0].message, 400, 'VALIDATION_ERROR'));
            }
            next(error);
        }
    }
);

export { router as eventsRouter };
