import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import {
    applyMonthlyResetIfNeeded,
    getCurrentPeriodUsage,
    getExpectedResetDate,
    getNextResetDate,
    resumeAllScenarios,
    pauseAllScenarios,
    checkAndResumeIfPossible,
} from '../utils/usageLimits.js';

const router = Router();

// Most billing routes require authentication
router.use(authenticateToken);

/**
 * GET /v1/billing/plans
 * List available subscription plans
 */
router.get('/plans', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;

        const plans = await prisma.plan.findMany({
            where: { isActive: true },
            orderBy: { priceMonthly: 'asc' },
        });

        // If no plans exist yet, return default plans
        if (plans.length === 0) {
            res.json({
                plans: [
                    {
                        id: 'starter',
                        name: 'Starter',
                        documentsPerMonth: 100,
                        pagesPerMonth: 1000,
                        storageGb: 5,
                        supportSla: 'standard',
                        priceMonthly: 2900, // €29
                    },
                    {
                        id: 'professional',
                        name: 'Professional',
                        documentsPerMonth: 500,
                        pagesPerMonth: 5000,
                        storageGb: 25,
                        supportSla: 'priority',
                        priceMonthly: 9900, // €99
                    },
                    {
                        id: 'enterprise',
                        name: 'Enterprise',
                        documentsPerMonth: -1, // Unlimited
                        pagesPerMonth: -1,
                        storageGb: 100,
                        supportSla: 'enterprise',
                        priceMonthly: 29900, // €299
                    },
                ],
            });
            return;
        }

        res.json({ plans });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/billing/subscription
 * Get current subscription for tenant
 */
router.get('/subscription', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const subscription = await prisma.subscription.findUnique({
            where: { tenantId },
        });

        if (!subscription) {
            return next(createError('Subscription not found', 404, 'NOT_FOUND'));
        }

        res.json(subscription);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/billing/checkout
 * Create Stripe checkout session (placeholder)
 */
router.post('/checkout', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        // Stripe integration placeholder
        if (!process.env.STRIPE_SECRET_KEY) {
            res.json({
                message: 'Stripe not configured. Set STRIPE_SECRET_KEY to enable billing.',
                checkoutUrl: null,
            });
            return;
        }

        // TODO: Implement Stripe checkout
        res.json({
            message: 'Stripe checkout not yet implemented',
            checkoutUrl: null,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/billing/portal
 * Get Stripe customer portal URL (placeholder)
 */
router.get('/portal', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        // Stripe integration placeholder
        res.json({
            message: 'Stripe portal not yet implemented',
            portalUrl: null,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/billing/raw-usage
 *
 * Returns total pages and rows consumed in the last 30 days from
 * DocumentUsageAggregate. Does not depend on the new Tenant schema fields,
 * so it works before the migration runs.
 */
router.get('/raw-usage', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const from = new Date();
        from.setDate(from.getDate() - 30);
        from.setHours(0, 0, 0, 0);

        const agg = await prisma.documentUsageAggregate.aggregate({
            where: { customerId: tenantId, date: { gte: from } },
            _sum: { pagesSpent: true, rowsUsed: true },
        });

        res.json({
            pages: agg._sum.pagesSpent ?? 0,
            rows: agg._sum.rowsUsed ?? 0,
            from: from.toISOString(),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/billing/entitlements
 * Get current entitlements (what the tenant is allowed to do)
 */
router.get('/entitlements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: { pagesLimit: true, rowsLimit: true, scenariosPaused: true },
        });

        res.json({
            entitlements: {
                pagesPerMonth: tenant?.pagesLimit ?? 5000,
                rowsPerMonth: tenant?.rowsLimit ?? 5000,
                status: subscription?.status || 'trialing',
            },
            scenariosPaused: tenant?.scenariosPaused ?? false,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/billing/usage-status
 *
 * Returns current period usage vs limits, add-on info, pause state, and
 * next reset date. Also lazily applies the monthly reset if due.
 */
router.get('/usage-status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        // Apply monthly reset if the period has rolled over
        await applyMonthlyResetIfNeeded(prisma, tenantId);

        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: {
                pagesLimit: true, rowsLimit: true,
                addonPagesLimit: true, addonRowsLimit: true,
                scenariosPaused: true, lastResetAt: true,
            },
        });

        if (!tenant) return next(createError('Tenant not found', 404, 'NOT_FOUND'));

        // One-time migration: upgrade tenants still on the old 1000 default to 5000
        if (tenant.pagesLimit <= 1000 && tenant.rowsLimit <= 1000) {
            await (prisma.tenant as any).update({
                where: { id: tenantId },
                data: { pagesLimit: 5000, rowsLimit: 5000 },
            });
            tenant.pagesLimit = 5000;
            tenant.rowsLimit  = 5000;
        }

        const periodStart = tenant.lastResetAt
            ? (() => { const d = new Date(tenant.lastResetAt); d.setHours(0, 0, 0, 0); return d; })()
            : getExpectedResetDate();

        const usage = await getCurrentPeriodUsage(prisma, tenantId, periodStart);

        const pagesLimit     = tenant.pagesLimit     ?? 5000;
        const rowsLimit      = tenant.rowsLimit      ?? 5000;
        const addonPages     = tenant.addonPagesLimit ?? 0;
        const addonRows      = tenant.addonRowsLimit  ?? 0;
        const totalPages     = pagesLimit + addonPages;
        const totalRows      = rowsLimit  + addonRows;

        // Add-on usage = overflow beyond the base quota
        const addonPagesUsed = Math.max(0, usage.pages - pagesLimit);
        const addonRowsUsed  = Math.max(0, usage.rows  - rowsLimit);

        const subscription = await prisma.subscription.findUnique({ where: { tenantId } });

        res.json({
            currentPages:     usage.pages,
            currentRows:      usage.rows,
            pagesLimit,
            rowsLimit,
            addonPagesLimit:  addonPages,
            addonRowsLimit:   addonRows,
            addonPagesUsed,
            addonRowsUsed,
            totalPagesLimit:  totalPages,
            totalRowsLimit:   totalRows,
            scenariosPaused:  tenant.scenariosPaused ?? false,
            lastResetAt:      periodStart.toISOString(),
            nextResetAt:      getNextResetDate().toISOString(),
            subscriptionStatus: subscription?.status || 'trialing',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/billing/stripe-webhook
 *
 * Handles Stripe checkout.session.completed events for add-on purchases.
 *
 * Expected metadata on the Stripe payment link / checkout session:
 *   - tenantId:       tenant CUID
 *   - addonType:      "pages" | "rows"
 *   - addonQuantity:  number (e.g. 1000)
 *
 * Configure this in the Stripe Dashboard under the payment link's metadata,
 * and point the webhook to this endpoint with the STRIPE_WEBHOOK_SECRET.
 */
router.post('/stripe-webhook', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const sig  = req.headers['stripe-signature'] as string;
        const secret = process.env.STRIPE_WEBHOOK_SECRET;

        let event: any = req.body;

        // Verify signature when configured
        if (secret && sig) {
            try {
                // Dynamic import so the app starts even if stripe package is absent
                const Stripe = (await import('stripe')).default;
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-01-27.acacia' as any });
                event = stripe.webhooks.constructEvent(
                    (req as any).rawBody ?? req.body,
                    sig,
                    secret
                );
            } catch (err: any) {
                console.warn('[Stripe Webhook] Signature verification failed:', err.message);
                return res.status(400).json({ error: 'Invalid signature' });
            }
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const meta    = session.metadata || {};
            const tenantId      = meta.tenantId as string | undefined;
            const addonType     = meta.addonType as 'pages' | 'rows' | undefined;
            const addonQuantity = meta.addonQuantity ? parseInt(meta.addonQuantity) : 0;

            if (tenantId && addonType && addonQuantity > 0) {
                console.log(`[Stripe Webhook] Add-on purchase: tenant=${tenantId}, type=${addonType}, qty=${addonQuantity}`);

                const updateData: any = {};
                if (addonType === 'pages') {
                    const current = await (prisma.tenant as any).findUnique({
                        where: { id: tenantId }, select: { addonPagesLimit: true },
                    });
                    updateData.addonPagesLimit = (current?.addonPagesLimit ?? 0) + addonQuantity;
                } else {
                    const current = await (prisma.tenant as any).findUnique({
                        where: { id: tenantId }, select: { addonRowsLimit: true },
                    });
                    updateData.addonRowsLimit = (current?.addonRowsLimit ?? 0) + addonQuantity;
                }

                await (prisma.tenant as any).update({ where: { id: tenantId }, data: updateData });

                // Auto-resume scenarios if the new quota brings usage within limits
                try {
                    await checkAndResumeIfPossible(prisma, tenantId);
                } catch (e) {
                    console.warn('[Stripe Webhook] Auto-resume check failed:', e);
                }
            } else {
                console.warn('[Stripe Webhook] checkout.session.completed missing tenantId/addonType/addonQuantity metadata');
            }
        }

        res.json({ received: true });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/billing/webhooks
 * Handle Stripe webhooks (placeholder)
 */
router.post('/webhooks', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Stripe webhook handling placeholder
        // TODO: Verify signature and process events
        res.json({ received: true });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/billing/reset-usage
 *
 * Admin-only. Deletes ALL DocumentUsageEvent and DocumentUsageAggregate
 * records for this tenant, resetting pages and rows to 0 everywhere
 * (Billing page 30-day view, Document Usage tab, usage-status).
 * Make.com credits, Azure, and OpenAI usage are NOT affected.
 *
 * Also clears scenariosPaused and sets lastResetAt to now.
 */
router.post(
    '/reset-usage',
    requireRole('ORG_OWNER', 'ADMIN'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;
            const tenantId = req.user!.tenantId;

            if (!tenantId) {
                return next(createError('No tenant selected', 400, 'NO_TENANT'));
            }

            // Delete every raw event for this tenant (all time)
            const { count: deletedEvents } = await prisma.documentUsageEvent.deleteMany({
                where: { customerId: tenantId },
            });

            // Delete every daily aggregate for this tenant (all time)
            const { count: deletedAggregates } = await prisma.documentUsageAggregate.deleteMany({
                where: { customerId: tenantId },
            });

            // Start a fresh billing period at midnight (to align with aggregate dates)
            const resetDate = new Date();
            resetDate.setHours(0, 0, 0, 0);

            await (prisma.tenant as any).update({
                where: { id: tenantId },
                data: {
                    lastResetAt: resetDate,
                    scenariosPaused: false,
                },
            });

            // Actually resume Make.com scenarios (DB flag alone is not enough)
            try {
                await resumeAllScenarios(prisma, tenantId);
            } catch (e) {
                console.warn('[Reset Usage] Auto-resume failed:', e);
            }

            console.log(
                `[Reset Usage] Admin reset for tenant ${tenantId}: ` +
                `${deletedEvents} events, ${deletedAggregates} aggregates deleted.`
            );

            res.json({ deletedEvents, deletedAggregates });
        } catch (error) {
            next(error);
        }
    }
);

export { router as billingRouter };
