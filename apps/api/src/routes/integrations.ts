import { Router, Response, NextFunction } from 'express';
import axios from 'axios';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { PrismaClient } from '@prisma/client';

const router = Router();

// Protect all routes
router.use(authenticateToken);

/**
 * GET /v1/integrations/make/check
 * 
 * Verifies the connection to Make.com using the stored API key.
 * Enforces usage of eu2.make.com as requested.
 */
router.get('/make/check', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        // 1. Get stored API Key
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { makeApiKey: true }
        });

        if (!tenant?.makeApiKey) {
            return next(createError('Make.com API Key is not configured', 400, 'NO_API_KEY'));
        }


        // 2. Call Make.com API (EU2 Zone)
        // Using /users/me as a lightweight check
        const response = await axios.get('https://eu2.make.com/api/v2/users/me', {
            headers: {
                'Authorization': `Token ${tenant.makeApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000 // 5s timeout
        });

        // Debug logging (excluding secrets)
        console.log('[Make.com Check] Response Status:', response.status);
        const dataPreview = JSON.stringify(response.data).substring(0, 500);
        console.log('[Make.com Check] Response Body Preview:', dataPreview);

        // Validate response structure
        // Make.com API v2 returns 'authUser' or 'user' depending on the endpoint/version
        const userData = response.data?.authUser || response.data?.user;
        const organizationId = userData?.organizationId || response.data?.organizationId;

        if (!userData || !userData.id) {
            // Sometimes it might return { detail: '...' } or different structure
            console.warn('[Make.com Check] Unexpected response structure:', dataPreview);
            return next(createError(`Unexpected API response structure. Received: ${dataPreview}`, 502, 'INVALID_RESPONSE_STRUCTURE'));
        }

        // 3. Return success
        res.json({
            status: 'connected',
            user: {
                id: userData.id,
                name: userData.name || 'Unknown',
                email: userData.email || 'Unknown',
                organizationId: "1054340", // Use hardcoded organization ID
                timezoneId: userData.timezoneId
            },
            zone: 'eu2'
        });

    } catch (error: any) {
        // Detailed error logging
        console.error('[Make.com Check] Failed:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        if (error.response?.status === 401 || error.response?.status === 403) {
            return next(createError('Invalid API Key or unauthorized access. Please check your credentials.', 401, 'INVALID_KEY'));
        }

        // Handle network/other errors
        next(createError(`Connection failed: ${error.response?.data?.message || error.message}`, 502, 'CONNECTION_FAILED'));
    }
});

/**
 * POST /v1/integrations/make/sync
 * 
 * Fetches usage data from Make.com for all scenarios and populates the database.
 * Strategy:
 * 1. Fetch all scenarios.
 * 2. For each scenario, fetch 30-day usage history.
 * 3. Aggregate daily usage across all scenarios.
 * 4. Overwrite UsageAggregate records for 'make' source in the db.
 */
router.post('/make/sync', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        // 1. Get API Key
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { makeApiKey: true }
        });

        if (!tenant?.makeApiKey) {
            return next(createError('Make.com API Key is not configured', 400, 'NO_API_KEY'));
        }

        const axiosConfig = {
            headers: { 'Authorization': `Token ${tenant.makeApiKey}` },
            timeout: 10000
        };

        // 2a. Use hardcoded Organization ID for reliability
        const organizationId = "1054340";
        console.log(`[Make Sync] Using hardcoded organization ID: ${organizationId}`);

        // 2c. Fetch Scenarios 
        // Must filter by organizationId
        const scenariosRes = await axios.get(`https://eu2.make.com/api/v2/scenarios?organizationId=${organizationId}&limit=200`, axiosConfig);
        const scenarios = scenariosRes.data.scenarios;

        console.log(`[Make Sync] Found ${scenarios.length} scenarios. Fetching usage...`);

        // 3. Fetch Usage for each scenario (Last 30 days)
        // We'll aggregate this by date in memory first
        const usageByDate: Record<string, { ops: number, data: number }> = {};

        // Run in parallel chunks to avoid rate limits if many scenarios
        // For now, simple Promise.all (be careful with rate limits)
        const usagePromises = scenarios.map(async (scenario: any) => {
            try {
                // Determine date range: last 30 days
                // Make.com might just give us the last 30 days by default on this endpoint
                const usageRes = await axios.get(`https://eu2.make.com/api/v2/scenarios/${scenario.id}/usage`, axiosConfig);
                const history = usageRes.data.usage || []; // Array of { date, operations, dataTransfer }

                for (const point of history) {
                    // Normalize date string (API might return timestamp or ISO)
                    // Assuming point.date is something like "2023-10-27" or ISO
                    const dateStr = new Date(point.date).toISOString().split('T')[0];

                    if (!usageByDate[dateStr]) {
                        usageByDate[dateStr] = { ops: 0, data: 0 };
                    }
                    usageByDate[dateStr].ops += (point.operations || 0);
                    usageByDate[dateStr].data += (point.dataTransfer || 0);
                }
            } catch (err: any) {
                console.warn(`[Make Sync] Failed to fetch usage for scenario ${scenario.id}: ${err.message}`);
                // Continue despite individual failure
            }
        });

        await Promise.all(usagePromises);

        // 4. Update Database
        // We will overwrite the 'make' aggregates for the dates we collected
        // To be safe, let's delete 'make' aggregates for the encountered dates and re-insert

        const datesToUpdate = Object.keys(usageByDate);
        if (datesToUpdate.length > 0) {
            const minDate = new Date(datesToUpdate.sort()[0]);

            await prisma.$transaction(async (tx) => {
                // Clear existing aggregates for this range
                await tx.usageAggregate.deleteMany({
                    where: {
                        tenantId,
                        source: 'make',
                        date: { gte: minDate }
                    }
                });

                // Insert new aggregates
                for (const dateStr of datesToUpdate) {
                    const stats = usageByDate[dateStr];
                    if (stats.ops === 0 && stats.data === 0) continue;

                    // Estimated cost: 0.0001 EUR per operation (Placeholder)
                    // You might want to make this configurable in Tenant model
                    const estimatedCost = stats.ops * 0.0001;

                    await tx.usageAggregate.create({
                        data: {
                            tenantId,
                            source: 'make',
                            date: new Date(dateStr),
                            eventCount: stats.ops,
                            totalCost: estimatedCost,
                            totalTokens: 0 // Not applicable for Make
                        }
                    });
                }
            });
        }

        res.json({
            status: 'success',
            scenariosProcessed: scenarios.length,
            recordsUpdated: datesToUpdate.length
        });

    } catch (error: any) {
        console.error('[Make Sync] Failed:', error);
        if (error.response?.status === 401) {
            return next(createError('Unauthorized. Check API Key.', 401, 'INVALID_KEY'));
        }
        next(createError('Sync failed.', 500, 'SYNC_FAILED'));
    }
});

export { router as integrationsRouter };
