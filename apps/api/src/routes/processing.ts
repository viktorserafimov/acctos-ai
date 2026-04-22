import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { jobStore } from '../services/processing/JobStore.js';
import { ADMIN_ROLES } from '../utils/roles.js';

const router = Router();
router.use(authenticateToken);
router.use(requireRole(...ADMIN_ROLES));

/**
 * GET /v1/processing/:jobId
 * Poll job status. Returns job metadata (no outputBuffer).
 */
router.get('/:jobId', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const job = jobStore.get(req.params.jobId);
    if (!job) return next(createError('Job not found', 404, 'NOT_FOUND'));

    const { outputBuffer, ...safe } = job as any;
    res.json({ job: safe });
});

/**
 * GET /v1/processing/:jobId/download
 * Download the processed Excel file for a completed job.
 */
router.get('/:jobId/download', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const job = jobStore.get(req.params.jobId);
    if (!job) return next(createError('Job not found', 404, 'NOT_FOUND'));
    if (job.status !== 'completed') return next(createError('Processing not yet complete', 400, 'NOT_READY'));
    if (!job.outputBuffer) return next(createError('Output file unavailable', 500, 'NO_OUTPUT'));

    const baseName = job.filename.replace(/\.[^.]+$/, '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}_processed.xlsx"`);
    res.send(job.outputBuffer);
});

export { router as processingRouter };
