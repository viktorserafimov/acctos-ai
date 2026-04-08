import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { generateDailyReportForTenant } from '../utils/reportGenerator.js';

const router = Router();

router.use(authenticateToken);

/**
 * GET /v1/reports
 *
 * Returns all daily AI-generated reports for the authenticated tenant,
 * ordered most recent first.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const reports = await (prisma as any).dailyReport.findMany({
            where: { tenantId },
            orderBy: { date: 'desc' },
            select: { id: true, date: true, content: true, createdAt: true },
        });

        res.json({
            reports: reports.map((r: any) => ({
                id: r.id,
                date: r.date.toISOString().split('T')[0],
                content: r.content,
                createdAt: r.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/reports/generate-now
 *
 * Admin-only. Manually triggers report generation for yesterday (or today if
 * ?date=YYYY-MM-DD is provided). Useful for testing without waiting for midnight.
 */
router.post(
    '/generate-now',
    requireRole('ORG_OWNER', 'ADMIN'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const prisma: PrismaClient = req.app.locals.prisma;
            const tenantId = req.user!.tenantId;

            if (!tenantId) {
                return next(createError('No tenant selected', 400, 'NO_TENANT'));
            }

            // Default to yesterday; allow ?date=YYYY-MM-DD override
            const dateParam = req.query.date as string | undefined;
            const target = dateParam ? new Date(dateParam) : (() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                return d;
            })();
            target.setUTCHours(0, 0, 0, 0);

            await generateDailyReportForTenant(prisma, tenantId, target);

            res.json({ success: true, date: target.toISOString().split('T')[0] });
        } catch (error) {
            next(error);
        }
    }
);

export { router as reportsRouter };
