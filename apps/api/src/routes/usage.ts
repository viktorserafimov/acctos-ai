import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { ADMIN_ROLES } from '../utils/roles.js';

const router = Router();

// All usage routes require authentication
router.use(authenticateToken);

/**
 * GET /v1/usage/summary
 * 
 * Returns aggregated usage summary for the current tenant.
 */
router.get('/summary', requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const period = (req.query.period as string) || '30d';
        const days = parseInt(period.replace('d', '')) || 30;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        fromDate.setHours(0, 0, 0, 0); // Normalize to start of day

        // Get aggregated data
        const aggregates = await prisma.usageAggregate.groupBy({
            by: ['source'],
            where: {
                tenantId,
                date: { gte: fromDate },
            },
            _sum: {
                eventCount: true,
                totalCost: true,
                totalTokens: true,
            },
        });

        // Format response
        const summary: Record<string, {
            eventCount: number;
            totalCost: string;
            totalTokens: number;
        }> = {};

        for (const agg of aggregates) {
            summary[agg.source] = {
                eventCount: agg._sum.eventCount || 0,
                totalCost: (agg._sum.totalCost?.toNumber() || 0).toFixed(4),
                totalTokens: agg._sum.totalTokens || 0,
            };
        }

        // Calculate totals
        const totalCost = aggregates.reduce(
            (sum: number, agg: any) => sum + (agg._sum.totalCost?.toNumber() || 0),
            0
        );
        const totalEvents = aggregates.reduce(
            (sum: number, agg: any) => sum + (agg._sum.eventCount || 0),
            0
        );

        res.json({
            period: `${days}d`,
            from: fromDate.toISOString(),
            to: new Date().toISOString(),
            summary,
            totals: {
                events: totalEvents,
                cost: totalCost.toFixed(4),
                currency: 'EUR',
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/usage/timeseries
 * 
 * Returns daily usage data for charts.
 */
router.get('/timeseries', requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const days = parseInt(req.query.days as string) || 30;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        fromDate.setHours(0, 0, 0, 0); // Normalize to start of day

        const aggregates = await prisma.usageAggregate.findMany({
            where: {
                tenantId,
                date: { gte: fromDate },
            },
            orderBy: { date: 'asc' },
        });

        // Group by date
        const byDate: Record<string, {
            date: string;
            make: { events: number; cost: number };
            azure: { events: number; cost: number };
            openai: { events: number; cost: number };
            total: { events: number; cost: number };
        }> = {};

        for (const agg of aggregates) {
            const dateKey = agg.date.toISOString().split('T')[0];

            if (!byDate[dateKey]) {
                byDate[dateKey] = {
                    date: dateKey,
                    make: { events: 0, cost: 0 },
                    azure: { events: 0, cost: 0 },
                    openai: { events: 0, cost: 0 },
                    total: { events: 0, cost: 0 },
                };
            }

            const source = agg.source as 'make' | 'azure' | 'openai';
            if (byDate[dateKey][source]) {
                byDate[dateKey][source].events += agg.eventCount;
                byDate[dateKey][source].cost += agg.totalCost.toNumber();
            }
            byDate[dateKey].total.events += agg.eventCount;
            byDate[dateKey].total.cost += agg.totalCost.toNumber();
        }

        res.json({
            data: Object.values(byDate),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/usage/exports
 * 
 * Export usage data as CSV.
 */
router.get('/exports', requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const days = parseInt(req.query.days as string) || 30;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        const events = await prisma.usageEvent.findMany({
            where: {
                tenantId,
                timestamp: { gte: fromDate },
            },
            orderBy: { timestamp: 'desc' },
            take: 10000, // Limit for safety
        });

        // Generate CSV
        const headers = ['timestamp', 'source', 'documentType', 'fileType', 'step', 'bankCode', 'cost', 'tokens'];
        const rows = events.map((e: any) => [
            e.timestamp.toISOString(),
            e.source,
            e.documentType || '',
            e.fileType || '',
            e.step || '',
            e.bankCode || '',
            e.cost?.toString() || '0',
            e.tokens?.toString() || '0',
        ]);

        const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=usage-export-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/usage/document-usage
 *
 * Query document usage for the authenticated tenant (JWT-based).
 * This is for dashboard use - no API key required.
 */
router.get('/document-usage', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        // Get query parameters
        const from = req.query.from as string;
        const to = req.query.to as string;

        // Build where clause
        const where: any = { customerId: tenantId };

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
            customerId: tenantId,
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
});

export { router as usageRouter };
