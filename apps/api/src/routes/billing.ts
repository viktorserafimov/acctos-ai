import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

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

        const subscription = await prisma.subscription.findUnique({
            where: { tenantId },
        });

        // Default trial entitlements
        const entitlements = {
            documentsPerMonth: 50,
            pagesPerMonth: 500,
            storageGb: 1,
            supportSla: 'standard',
            status: subscription?.status || 'trialing',
        };

        // Get current period usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usage = await prisma.usageAggregate.aggregate({
            where: {
                tenantId,
                date: { gte: startOfMonth },
            },
            _sum: {
                eventCount: true,
            },
        });

        res.json({
            entitlements,
            usage: {
                documentsThisMonth: usage._sum.eventCount || 0,
            },
            quotaRemaining: entitlements.documentsPerMonth - (usage._sum.eventCount || 0),
        });
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

export { router as billingRouter };
