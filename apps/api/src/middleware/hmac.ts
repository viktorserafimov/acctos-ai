import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler.js';

/**
 * Verify HMAC signature for event ingestion from Make.com
 * Header: X-HMAC-Signature: sha256=<signature>
 */
export function verifyHmacSignature(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const signature = req.headers['x-hmac-signature'] as string;

    if (!signature) {
        return next(createError('Missing HMAC signature', 401, 'MISSING_SIGNATURE'));
    }

    const hmacSecret = process.env.HMAC_SECRET;
    if (!hmacSecret) {
        console.error('HMAC_SECRET not configured');
        return next(createError('Server configuration error', 500, 'CONFIG_ERROR'));
    }

    const body = JSON.stringify(req.body);
    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', hmacSecret)
        .update(body)
        .digest('hex');

    const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );

    if (!isValid) {
        return next(createError('Invalid HMAC signature', 401, 'INVALID_SIGNATURE'));
    }

    next();
}

/**
 * Generate HMAC signature for testing
 */
export function generateHmacSignature(body: object, secret: string): string {
    return 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');
}
