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
        from.setUTCDate(from.getUTCDate() - 30);
        from.setUTCHours(0, 0, 0, 0);

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
            ? new Date(tenant.lastResetAt)
            : getExpectedResetDate();

        const usage = await getCurrentPeriodUsage(prisma, tenantId, periodStart);

        const pagesLimit     = tenant.pagesLimit     ?? 5000;
        const rowsLimit      = tenant.rowsLimit      ?? 5000;
        const addonPages     = tenant.addonPagesLimit ?? 0;
        const addonRows      = tenant.addonRowsLimit  ?? 0;
        const totalPages     = pagesLimit + addonPages;
        const totalRows      = rowsLimit  + addonRows;

        const subscription = await prisma.subscription.findUnique({ where: { tenantId } });

        // ── Low-limit warning webhook ─────────────────────────────────────────────
        // Fire once per billing period when pages or rows remaining drop to <= 500.
        // limitWarningFiredAt is cleared on each reset so it fires again next period.
        const LOW_LIMIT_THRESHOLD = 500;
        const pagesRemaining = totalPages - usage.pages;
        const rowsRemaining  = totalRows  - usage.rows;
        const isLow = pagesRemaining <= LOW_LIMIT_THRESHOLD || rowsRemaining <= LOW_LIMIT_THRESHOLD;
        const warningAlreadySent = tenant.limitWarningFiredAt &&
            tenant.limitWarningFiredAt >= periodStart;
        if (isLow && !warningAlreadySent) {
            // Mark as fired synchronously to prevent duplicate webhooks on concurrent polls
            try {
                await (prisma.tenant as any).update({
                    where: { id: tenantId },
                    data: { limitWarningFiredAt: new Date() },
                });
            } catch (e: any) {
                console.warn('[usage-status] Failed to set limitWarningFiredAt:', e.message?.split('\n')[0]);
            }
            // Fire webhook fire-and-forget
            fetch('https://services.leadconnectorhq.com/hooks/gjXG8jJC010S1aU1N1Le/webhook-trigger/2b5db06c-ff78-4d49-9c02-2ee662148b75', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    tenantName:     (tenant as any).name ?? tenantId,
                    pagesRemaining,
                    rowsRemaining,
                    totalPagesLimit: totalPages,
                    totalRowsLimit:  totalRows,
                    currentPages:   usage.pages,
                    currentRows:    usage.rows,
                }),
            }).catch((e) => console.error('[usage-status] Low-limit webhook failed:', e));
        }

        // ── Auto-pause when limits are exceeded ───────────────────────────────────
        // usage-status is polled every ~60 s by Layout.tsx, making this the
        // reliable heartbeat that catches limit breaches regardless of whether
        // Make.com has pushed any events to /api/usage/document.
        const exceeded = usage.pages >= totalPages || usage.rows >= totalRows;
        if (exceeded && !(tenant.scenariosPaused ?? false)) {
            console.log(
                `[usage-status] Tenant ${tenantId} over limit ` +
                `(pages ${usage.pages}/${totalPages}, rows ${usage.rows}/${totalRows}). Pausing.`
            );
            // Write the DB flag synchronously so THIS response (and all
            // subsequent polls) immediately return scenariosPaused: true —
            // no waiting for the Make.com API round-trips.
            try {
                await (prisma.tenant as any).update({
                    where: { id: tenantId },
                    data: { scenariosPaused: true },
                });
                tenant.scenariosPaused = true;
            } catch (e: any) {
                console.warn('[usage-status] Failed to set scenariosPaused flag:', e.message?.split('\n')[0]);
            }
            // Fire-and-forget: stop the actual Make.com scenarios in the background.
            pauseAllScenarios(prisma, tenantId).catch((e) =>
                console.error('[usage-status] Auto-pause Make.com calls failed:', e)
            );
        }

        res.json({
            currentPages:     usage.pages,
            currentRows:      usage.rows,
            pagesLimit,
            rowsLimit,
            addonPagesLimit:  addonPages,
            addonRowsLimit:   addonRows,
            totalPagesLimit:  totalPages,
            totalRowsLimit:   totalRows,
            pagesRemaining,
            rowsRemaining,
            limitWarning:     isLow,
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
            // tenantId can come from metadata (payment links) or client_reference_id (dynamic links)
            const tenantId      = (meta.tenantId || (session as any).client_reference_id) as string | undefined;
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
 * POST /v1/billing/reset-addon-limits
 *
 * Admin-only. Resets addonPagesLimit and addonRowsLimit to 0 for this tenant.
 * Used to clear stale values left from previous systems.
 */
router.post(
    '/reset-addon-limits',
    requireRole('ORG_OWNER', 'ADMIN'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;
            const tenantId = req.user!.tenantId;

            if (!tenantId) {
                return next(createError('No tenant selected', 400, 'NO_TENANT'));
            }

            await (prisma.tenant as any).update({
                where: { id: tenantId },
                data: { addonPagesLimit: 0, addonRowsLimit: 0 },
            });

            res.json({ success: true, addonPagesLimit: 0, addonRowsLimit: 0 });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /v1/billing/adjust-credits
 *
 * Admin-only. Add or remove spent pages/rows for this tenant by injecting a
 * correction record into DocumentUsageAggregate for today.
 * Accepts { pages?: number, rows?: number } as deltas (positive = add, negative = remove).
 * The total current-period usage is clamped to >= 0.
 */
router.put(
    '/adjust-credits',
    requireRole('ORG_OWNER', 'ADMIN'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;
            const tenantId = req.user!.tenantId;

            if (!tenantId) {
                return next(createError('No tenant selected', 400, 'NO_TENANT'));
            }

            const { pages, rows } = req.body as { pages?: number; rows?: number };

            if (pages === undefined && rows === undefined) {
                return next(createError('Provide pages and/or rows delta', 400, 'VALIDATION_ERROR'));
            }

            // Determine current billing period start
            const tenant = await (prisma.tenant as any).findUnique({
                where: { id: tenantId },
                select: { lastResetAt: true },
            });
            const periodStart = tenant?.lastResetAt
                ? new Date(tenant.lastResetAt)
                : getExpectedResetDate();

            // Get current usage so we can clamp the delta
            const currentUsage = await getCurrentPeriodUsage(prisma as any, tenantId, periodStart);

            const pagesDelta = pages !== undefined ? Math.max(-currentUsage.pages, pages) : 0;
            const rowsDelta  = rows  !== undefined ? Math.max(-currentUsage.rows,  rows)  : 0;

            // Upsert today's correction into DocumentUsageAggregate
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            await prisma.documentUsageAggregate.upsert({
                where: { customerId_date: { customerId: tenantId, date: today } },
                create: { customerId: tenantId, date: today, pagesSpent: pagesDelta, rowsUsed: rowsDelta },
                update: {
                    pagesSpent: { increment: pagesDelta },
                    rowsUsed:   { increment: rowsDelta },
                },
            });

            // Recalculate usage after adjustment and check pause/resume
            const newUsage = await getCurrentPeriodUsage(prisma as any, tenantId, periodStart);
            try {
                await checkAndResumeIfPossible(prisma as any, tenantId);
            } catch (_) {}

            res.json({ success: true, currentPages: newUsage.pages, currentRows: newUsage.rows });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /v1/billing/simulate-addon
 *
 * Admin-only. Runs the same credit logic as the Stripe webhook without
 * requiring an actual Stripe event. Used for testing add-on purchases.
 *
 * Body: { addonType: 'pages' | 'rows', addonQuantity: number }
 */
router.post(
    '/simulate-addon',
    requireRole('ORG_OWNER', 'ADMIN'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;
            const tenantId = req.user!.tenantId;

            if (!tenantId) {
                return next(createError('No tenant selected', 400, 'NO_TENANT'));
            }

            const { addonType, addonQuantity } = req.body as { addonType?: string; addonQuantity?: number };

            if ((addonType !== 'pages' && addonType !== 'rows') || !addonQuantity || addonQuantity <= 0) {
                return next(createError('Provide addonType ("pages" or "rows") and a positive addonQuantity', 400, 'VALIDATION_ERROR'));
            }

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
                console.warn('[Simulate Addon] Auto-resume check failed:', e);
            }

            console.log(`[Simulate Addon] tenant=${tenantId}, type=${addonType}, qty=${addonQuantity}`);
            res.json({ success: true, addonType, addonQuantity, ...updateData });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /v1/billing/remove-addon
 *
 * Admin-only. Decrements addonPagesLimit or addonRowsLimit by the given
 * quantity (clamped to 0). Used for testing.
 *
 * Body: { addonType: 'pages' | 'rows', addonQuantity: number }
 */
router.post(
    '/remove-addon',
    requireRole('ORG_OWNER', 'ADMIN'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;
            const tenantId = req.user!.tenantId;

            if (!tenantId) return next(createError('No tenant selected', 400, 'NO_TENANT'));

            const { addonType, addonQuantity } = req.body as { addonType?: string; addonQuantity?: number };

            if ((addonType !== 'pages' && addonType !== 'rows') || !addonQuantity || addonQuantity <= 0) {
                return next(createError('Provide addonType ("pages" or "rows") and a positive addonQuantity', 400, 'VALIDATION_ERROR'));
            }

            const field = addonType === 'pages' ? 'addonPagesLimit' : 'addonRowsLimit';
            const current = await (prisma.tenant as any).findUnique({ where: { id: tenantId }, select: { [field]: true } });
            const newValue = Math.max(0, (current?.[field] ?? 0) - addonQuantity);

            await (prisma.tenant as any).update({ where: { id: tenantId }, data: { [field]: newValue } });

            console.log(`[Remove Addon] tenant=${tenantId}, type=${addonType}, qty=${addonQuantity}, new=${newValue}`);
            res.json({ success: true, addonType, [field]: newValue });
        } catch (error) {
            next(error);
        }
    }
);

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

            // ── Snapshot by calendar month BEFORE deleting (permanent history) ──
            // Wrapped in try/catch — monthly_usage_snapshots table may not exist yet
            try {
                const aggregatesToSnapshot = await prisma.documentUsageAggregate.findMany({
                    where: { customerId: tenantId },
                });
                const byMonth: Record<string, { year: number; month: number; pages: number; rows: number; docs: number }> = {};
                for (const agg of aggregatesToSnapshot) {
                    const year = agg.date.getUTCFullYear();
                    const month = agg.date.getUTCMonth() + 1;
                    const key = `${year}-${month}`;
                    if (!byMonth[key]) byMonth[key] = { year, month, pages: 0, rows: 0, docs: 0 };
                    byMonth[key].pages += agg.pagesSpent;
                    byMonth[key].rows += agg.rowsUsed;
                    byMonth[key].docs += (agg as any).documentsHandled ?? 0;
                }
                for (const snap of Object.values(byMonth)) {
                    await (prisma as any).monthlyUsageSnapshot.upsert({
                        where: { tenantId_year_month: { tenantId, year: snap.year, month: snap.month } },
                        create: { tenantId, year: snap.year, month: snap.month, pagesSpent: snap.pages, rowsUsed: snap.rows, documentsHandled: snap.docs },
                        update: { pagesSpent: { increment: snap.pages }, rowsUsed: { increment: snap.rows }, documentsHandled: { increment: snap.docs } },
                    });
                }
            } catch (e: any) {
                console.warn('[Reset Usage] Snapshot skipped — DB migration pending?', e.message?.split('\n')[0]);
            }

            // Store the exact reset timestamp so that today's pre-reset
            // aggregate rows (stored as DATE = today midnight) fall *before*
            // this value and are excluded from the new period's usage query.
            const resetDate = new Date();

            // Record the new period start. scenariosPaused is cleared below,
            // only after resumeAllScenarios() has been attempted.
            await (prisma.tenant as any).update({
                where: { id: tenantId },
                data: { lastResetAt: resetDate },
            });

            // Resume Make.com scenarios, then clear the paused flag.
            try {
                await resumeAllScenarios(prisma, tenantId);
            } catch (e) {
                console.warn('[Reset Usage] Auto-resume failed:', e);
            }
            // Always clear the flag after an admin reset — usage is now 0
            // so the notification must disappear regardless of Make.com outcome.
            try {
                await (prisma.tenant as any).update({
                    where: { id: tenantId },
                    data: { scenariosPaused: false, limitWarningFiredAt: null },
                });
            } catch (e: any) {
                console.warn('[Reset Usage] Failed to clear scenariosPaused flag:', e.message?.split('\n')[0]);
            }

            console.log(`[Reset Usage] Admin reset for tenant ${tenantId}: period reset to ${resetDate.toISOString()}.`);

            res.json({ success: true, resetAt: resetDate.toISOString() });
        } catch (error) {
            next(error);
        }
    }
);

export { router as billingRouter };
