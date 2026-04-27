import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler.js';

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
    const secret = process.env.SUPERADMIN_SECRET;
    if (!secret) {
        return next(createError('Superadmin not configured', 503, 'NOT_CONFIGURED'));
    }
    const provided = req.headers['x-superadmin-secret'];
    if (provided !== secret) {
        return next(createError('Unauthorized', 401, 'UNAUTHORIZED'));
    }
    next();
}
