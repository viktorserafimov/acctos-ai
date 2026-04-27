import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireSuperAdmin } from '../middleware/superadmin.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireSuperAdmin);

const createTenantSchema = z.object({
    tenantName: z.string().min(2),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(8).optional(),
    ownerName: z.string().optional(),
    pagesLimit: z.number().int().positive().optional(),
    rowsLimit: z.number().int().positive().optional(),
});

// POST /v1/superadmin/tenants — create a new tenant and assign an owner.
// If ownerEmail already exists the existing user is linked (no password needed).
// If ownerEmail is new, ownerPassword is required to create the account.
router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const data = createTenantSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({ where: { email: data.ownerEmail } });

        if (!existingUser && !data.ownerPassword) {
            return next(createError('ownerPassword is required when the user does not already exist', 400, 'VALIDATION_ERROR'));
        }

        const slug = data.tenantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const result = await (prisma as any).$transaction(async (tx: any) => {
            const user = existingUser ?? await tx.user.create({
                data: {
                    email: data.ownerEmail,
                    password: await bcrypt.hash(data.ownerPassword!, 10),
                    name: data.ownerName,
                },
            });

            const tenant = await tx.tenant.create({
                data: {
                    name: data.tenantName,
                    slug: `${slug}-${Date.now()}`,
                    pagesLimit: data.pagesLimit ?? 1000,
                    rowsLimit: data.rowsLimit ?? 1000,
                },
            });

            await tx.membership.create({
                data: { userId: user.id, tenantId: tenant.id, role: 'ORG_OWNER' },
            });

            await tx.subscription.create({
                data: { tenantId: tenant.id, status: 'trialing' },
            });

            return { user, tenant };
        });

        res.status(201).json({
            tenantId: result.tenant.id,
            tenantName: result.tenant.name,
            tenantSlug: result.tenant.slug,
            ownerEmail: result.user.email,
            ownerName: result.user.name,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return next(createError('Invalid input: ' + err.errors[0].message, 400, 'VALIDATION_ERROR'));
        }
        next(err);
    }
});

// GET /v1/superadmin/tenants — list all tenants
router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;

        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                memberships: {
                    include: { user: { select: { email: true, name: true } } },
                },
                subscription: { select: { status: true, currentPeriodEnd: true } },
            },
        });

        res.json({
            tenants: tenants.map((t: any) => {
                const owner = t.memberships.find((m: any) => m.role === 'ORG_OWNER');
                return {
                    id: t.id,
                    name: t.name,
                    slug: t.slug,
                    createdAt: t.createdAt,
                    pagesLimit: t.pagesLimit,
                    rowsLimit: t.rowsLimit,
                    memberCount: t.memberships.length,
                    ownerEmail: owner?.user?.email ?? null,
                    ownerName: owner?.user?.name ?? null,
                    subscriptionStatus: t.subscription?.status ?? 'none',
                };
            }),
        });
    } catch (err) {
        next(err);
    }
});

export { router as superadminRouter };
