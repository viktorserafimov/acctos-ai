import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

// All ticket routes require authentication
router.use(authenticateToken);

// Validation schemas
const createTicketSchema = z.object({
    subject: z.string().min(5).max(200),
    message: z.string().min(10),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const addMessageSchema = z.object({
    content: z.string().min(1),
    isInternal: z.boolean().optional(),
});

/**
 * POST /v1/tickets
 * Create a new support ticket
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const data = createTicketSchema.parse(req.body);

        const ticket = await prisma.ticket.create({
            data: {
                tenantId,
                subject: data.subject,
                priority: data.priority || 'normal',
                messages: {
                    create: {
                        authorId: req.user!.id,
                        content: data.message,
                    },
                },
            },
            include: {
                messages: {
                    include: { author: { select: { id: true, name: true, email: true } } },
                },
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                tenantId,
                action: 'ticket.create',
                resource: 'ticket',
                resourceId: ticket.id,
            },
        });

        res.status(201).json(ticket);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(createError('Invalid input: ' + error.errors[0].message, 400, 'VALIDATION_ERROR'));
        }
        next(error);
    }
});

/**
 * GET /v1/tickets
 * List all tickets for tenant
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const status = req.query.status as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const where = {
            tenantId,
            ...(status && { status }),
        };

        const [tickets, total] = await Promise.all([
            prisma.ticket.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    _count: { select: { messages: true } },
                },
            }),
            prisma.ticket.count({ where }),
        ]);

        res.json({
            tickets,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/tickets/:id
 * Get ticket details with messages
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const ticket = await prisma.ticket.findFirst({
            where: {
                id: req.params.id,
                tenantId, // Enforce tenant isolation
            },
            include: {
                messages: {
                    where: { isInternal: false }, // Hide internal notes from customers
                    orderBy: { createdAt: 'asc' },
                    include: {
                        author: { select: { id: true, name: true, email: true } },
                        attachments: true,
                    },
                },
            },
        });

        if (!ticket) {
            return next(createError('Ticket not found', 404, 'NOT_FOUND'));
        }

        res.json(ticket);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/tickets/:id/messages
 * Add a message to a ticket
 */
router.post('/:id/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        // Verify ticket exists and belongs to tenant
        const ticket = await prisma.ticket.findFirst({
            where: {
                id: req.params.id,
                tenantId,
            },
        });

        if (!ticket) {
            return next(createError('Ticket not found', 404, 'NOT_FOUND'));
        }

        const data = addMessageSchema.parse(req.body);

        const message = await prisma.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                authorId: req.user!.id,
                content: data.content,
                isInternal: data.isInternal || false,
            },
            include: {
                author: { select: { id: true, name: true, email: true } },
            },
        });

        // Update ticket status if it was waiting
        if (ticket.status === 'waiting') {
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: { status: 'in_progress' },
            });
        }

        res.status(201).json(message);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(createError('Invalid input', 400, 'VALIDATION_ERROR'));
        }
        next(error);
    }
});

/**
 * POST /v1/tickets/:id/attachments
 * Get a signed URL for uploading an attachment
 */
router.post('/:id/attachments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // For now, return a placeholder - Azure Blob integration will be added later
        res.json({
            message: 'Attachment upload not yet implemented',
            uploadUrl: null,
        });
    } catch (error) {
        next(error);
    }
});

export { router as ticketsRouter };
