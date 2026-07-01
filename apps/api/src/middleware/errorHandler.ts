import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
    statusCode?: number;
    code?: string;
}

export function errorHandler(
    err: AppError,
    req: Request,
    res: Response,
    next: NextFunction
) {
    const statusCode = err.statusCode || 500;

    // 401/403 are expected auth failures — don't pollute logs
    if (statusCode >= 500) {
        console.error('Error:', err.message);
    }
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
        error: {
            message,
            code: err.code || 'INTERNAL_ERROR',
        },
    });
}

export function createError(message: string, statusCode: number, code?: string): AppError {
    const error: AppError = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}
