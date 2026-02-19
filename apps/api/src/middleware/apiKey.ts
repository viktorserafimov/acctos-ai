import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler.js';

/**
 * Verify API Key from X-API-Key header
 * Checks against USAGE_API_KEY environment variable
 */
export function verifyApiKey(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
        return next(createError('Missing X-API-Key header', 401, 'MISSING_API_KEY'));
    }

    const expectedKey = process.env.USAGE_API_KEY;
    if (!expectedKey) {
        console.error('USAGE_API_KEY not configured');
        return next(createError('Server configuration error', 500, 'CONFIG_ERROR'));
    }

    if (apiKey !== expectedKey) {
        return next(createError('Invalid API Key', 401, 'INVALID_API_KEY'));
    }

    next();
}
