import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { verifyApiKey } from '../middleware/apiKey.js';
import { createError } from '../middleware/errorHandler.js';
import { checkAndPauseIfNeeded } from '../utils/usageLimits.js';

const router = Router();

// Document usage ingestion schema
const documentUsageSchema = z.object({
    customerId: z.string(),
    pagesSpent: z.number().int().min(0),
    rowsUsed: z.number().int().min(0),
    jobId: z.string().optional(),
    scenarioId: z.string().optional(),
    scenarioName: z.string().optional(),
    timestamp: z.string().datetime().optional(),
});

/**
 * POST /api/usage/document
 *
 * Ingest document usage data from Make.com.
 * Requires X-API-Key header.
 * Idempotency-Key header is optional:
 *   - If provided: prevents duplicate processing (Make.com retries)
 *   - If omitted: every request is accepted and increments totals
 */
router.post(
    '/document',
    verifyApiKey,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;

            // Idempotency key: use header if provided, otherwise generate unique key
            const idempotencyKey = (req.headers['idempotency-key'] as string)
                || crypto.randomUUID();

            // Validate payload
            const data = documentUsageSchema.parse(req.body);

            // Verify tenant exists
            const tenant = await prisma.tenant.findUnique({
                where: { id: data.customerId },
            });

            if (!tenant) {
                return next(createError('Customer not found', 404, 'CUSTOMER_NOT_FOUND'));
            }

            // Try to insert (idempotent - will fail silently on duplicate key)
            try {
                const event = await prisma.documentUsageEvent.create({
                    data: {
                        customerId: data.customerId,
                        idempotencyKey,
                        pagesSpent: data.pagesSpent,
                        rowsUsed: data.rowsUsed,
                        jobId: data.jobId,
                        scenarioId: data.scenarioId,
                        scenarioName: data.scenarioName,
                        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                    },
                });

                // Update daily aggregate (upsert)
                const eventDate = new Date(event.timestamp);
                eventDate.setHours(0, 0, 0, 0);

                await prisma.documentUsageAggregate.upsert({
                    where: {
                        customerId_date: {
                            customerId: data.customerId,
                            date: eventDate,
                        },
                    },
                    create: {
                        customerId: data.customerId,
                        date: eventDate,
                        pagesSpent: data.pagesSpent,
                        rowsUsed: data.rowsUsed,
                        eventCount: 1,
                    },
                    update: {
                        pagesSpent: { increment: data.pagesSpent },
                        rowsUsed: { increment: data.rowsUsed },
                        eventCount: { increment: 1 },
                    },
                });

                // Fire-and-forget limit check — pauses Make.com scenarios if limits exceeded
                checkAndPauseIfNeeded(prisma, data.customerId).catch((e) =>
                    console.error('[documentUsage] Limit check failed:', e)
                );

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
                        message: 'Event already processed (same Idempotency-Key)',
                    });
                    return;
                }
                throw error;
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                return next(createError('Invalid data: ' + error.errors[0].message, 400, 'VALIDATION_ERROR'));
            }
            next(error);
        }
    }
);

/**
 * GET /api/usage/document
 *
 * Query document usage data for dashboard.
 * Requires X-API-Key header.
 * Query params: customerId (required), from (YYYY-MM-DD, optional), to (YYYY-MM-DD, optional)
 */
router.get(
    '/document',
    verifyApiKey,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;

            const customerId = req.query.customerId as string;
            const from = req.query.from as string;
            const to = req.query.to as string;

            if (!customerId) {
                return next(createError('Missing customerId parameter', 400, 'MISSING_PARAMETER'));
            }

            // Build where clause
            const where: any = { customerId };

            if (from || to) {
                where.date = {};
                if (from) {
                    where.date.gte = new Date(from);
                }
                if (to) {
                    where.date.lte = new Date(to);
                }
            }

            // Get aggregated data
            const aggregates = await prisma.documentUsageAggregate.findMany({
                where,
                orderBy: { date: 'asc' },
            });

            // Calculate totals
            const totals = {
                pagesSpent: aggregates.reduce((sum, agg) => sum + agg.pagesSpent, 0),
                rowsUsed: aggregates.reduce((sum, agg) => sum + agg.rowsUsed, 0),
            };

            // Format response
            res.json({
                customerId,
                from: from || null,
                to: to || null,
                days: aggregates.map(agg => ({
                    date: agg.date.toISOString().split('T')[0],
                    pagesSpent: agg.pagesSpent,
                    rowsUsed: agg.rowsUsed,
                })),
                totals,
            });
        } catch (error) {
            next(error);
        }
    }
);

export { router as documentUsageRouter };
