import { Router, Response, NextFunction } from 'express';
import axios from 'axios';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { PrismaClient } from '@prisma/client';
import { checkAndPauseIfNeeded, pauseAllScenarios, resumeAllScenarios } from '../utils/usageLimits.js';

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
        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: { makeApiKey: true, makeOrgId: true, makeFolderId: true }
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
        if (!userData || !userData.id) {
            console.warn('[Make.com Check] Unexpected response structure:', dataPreview);
            return next(createError(`Unexpected API response structure. Received: ${dataPreview}`, 502, 'INVALID_RESPONSE_STRUCTURE'));
        }

        // 3. Determine Organization ID (Stored or Discovered)
        let organizationId = tenant.makeOrgId;
        if (!organizationId) {
            organizationId = response.data?.authUser?.organizationId || response.data?.organizationId;
        }

        // 4. Return success
        res.json({
            status: 'connected',
            user: {
                id: userData.id,
                name: userData.name || 'Unknown',
                email: userData.email || 'Unknown',
                organizationId: organizationId || 'unknown',
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

        // 1. Get API Key and folder/org configuration
        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: { makeApiKey: true, makeFolderId: true, makeOrgId: true }
        });

        if (!tenant?.makeApiKey) {
            return next(createError('Make.com API Key is not configured', 400, 'NO_API_KEY'));
        }

        const axiosConfig = {
            headers: { 'Authorization': `Token ${tenant.makeApiKey}` },
            timeout: 10000
        };

        // 2a. Use stored Organization ID if available, otherwise discover it
        let organizationId: string | undefined = tenant.makeOrgId || undefined;

        if (!organizationId) {
            // Fallback: Fetch User Profile to get Organization ID
            try {
                const profileRes = await axios.get('https://eu2.make.com/api/v2/users/me', axiosConfig);
                console.log('[Make Sync] Profile Response:', JSON.stringify(profileRes.data, null, 2));

                const userData = profileRes.data.authUser || profileRes.data.user;
                organizationId = userData?.organizationId || profileRes.data?.organizationId;

                if (!organizationId && userData?.organization?.id) {
                    organizationId = userData.organization.id;
                }
            } catch (e) {
                console.warn('[Make Sync] /users/me failed, trying /organizations...', e);
            }

            // 2b. Fallback: List Organizations if not found in profile
            if (!organizationId) {
                console.log('[Make Sync] Organization ID not found in profile. Fetching /organizations...');
                try {
                    const orgsRes = await axios.get('https://eu2.make.com/api/v2/organizations', axiosConfig);
                    console.log('[Make Sync] Orgs Response:', JSON.stringify(orgsRes.data, null, 2));

                    const orgs = orgsRes.data.organizations || [];
                    if (orgs.length > 0) {
                        organizationId = orgs[0].id;
                        console.log(`[Make Sync] Using first organization: ${organizationId} (${orgs[0].name})`);
                    }
                } catch (err: any) {
                    console.error('[Make Sync] Failed to list organizations:', err.message);
                }
            }
        } else {
            console.log(`[Make Sync] Using stored Organization ID: ${organizationId}`);
        }

        if (!organizationId) {
            console.warn('[Make Sync] Could not determine Organization ID from profile or listing.');
            return next(createError('Could not determine Make.com Organization ID. Please check API Key permissions (need organizations:read) or set your Organization ID in Settings.', 502, 'INVALID_RESPONSE'));
        }

        // 2c. Fetch Scenarios (optionally filtered by folder)
        let scenariosUrl = `https://eu2.make.com/api/v2/scenarios?organizationId=${organizationId}&limit=200`;
        if (tenant.makeFolderId) {
            scenariosUrl += `&folderId=${tenant.makeFolderId}`;
            console.log(`[Make Sync] Filtering scenarios by folder ID: ${tenant.makeFolderId}`);
        }
        const scenariosRes = await axios.get(scenariosUrl, axiosConfig);
        const scenarios = scenariosRes.data.scenarios;

        console.log(`[Make Sync] Found ${scenarios.length} scenarios${tenant.makeFolderId ? ` in folder ${tenant.makeFolderId}` : ''}. Fetching usage...`);

        // 3. Fetch Usage for each scenario (Last 30 days)
        const usageByDate: Record<string, { ops: number; data: number; centicredits: number }> = {};

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const fromDateStr = thirtyDaysAgo.toISOString().split('T')[0];
        const toDateStr = now.toISOString().split('T')[0];

        console.log(`[Make Sync] Syncing usage from ${fromDateStr} to ${toDateStr}`);

        // Run in sequence to avoid rate limits and capture detailed errors
        let firstScenario = true;
        for (const scenario of scenarios) {
            try {
                console.log(`[Make Sync] Fetching usage for: ${scenario.name} (${scenario.id})`);
                const usageRes = await axios.get(`https://eu2.make.com/api/v2/scenarios/${scenario.id}/usage?from=${fromDateStr}&to=${toDateStr}&interval=daily`, axiosConfig);

                const history = usageRes.data.data || [];
                console.log(`[Make Sync] Received ${Array.isArray(history) ? history.length : 'non-array'} usage data points for ${scenario.id}`);

                if (!Array.isArray(history)) {
                    console.log(`[Make Sync] Warning: history for ${scenario.id} is not an array: ${JSON.stringify(history)}`);
                    continue;
                }

                for (const point of history) {
                    // Make.com API v2 returns DD-MM-YYYY
                    let dateStr: string;
                    if (point.date && point.date.includes('-')) {
                        const parts = point.date.split('-');
                        if (parts.length === 3) {
                            dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
                        } else {
                            dateStr = new Date(point.date).toISOString().split('T')[0];
                        }
                    } else {
                        dateStr = new Date(point.date).toISOString().split('T')[0];
                    }

                    if (!usageByDate[dateStr]) {
                        usageByDate[dateStr] = { ops: 0, data: 0, centicredits: 0 };
                    }
                    usageByDate[dateStr].ops += (point.operations || 0);
                    usageByDate[dateStr].data += (point.dataTransfer || 0);
                    usageByDate[dateStr].centicredits += (point.centicredits || 0);
                }
            } catch (err: any) {
                const errMsg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
                console.warn(`[Make Sync] Failed for scenario ${scenario.id} (${scenario.name}): ${errMsg}`);
            }
        }

        // 4. Update Database
        const datesToUpdate = Object.keys(usageByDate);
        if (datesToUpdate.length > 0) {
            const minDate = new Date(datesToUpdate.sort()[0]);

            await prisma.$transaction(async (tx) => {
                // Clear existing 'make' aggregates for this range
                await tx.usageAggregate.deleteMany({
                    where: {
                        tenantId,
                        source: 'make',
                        date: { gte: minDate }
                    }
                });

                // Insert new aggregates with actual credit values
                for (const dateStr of datesToUpdate) {
                    const stats = usageByDate[dateStr];
                    if (stats.ops === 0 && stats.data === 0 && stats.centicredits === 0) continue;

                    // Convert centicredits to credits (1 credit = 100 centicredits)
                    const credits = stats.centicredits / 100;

                    await tx.usageAggregate.create({
                        data: {
                            tenantId,
                            source: 'make',
                            date: new Date(dateStr),
                            eventCount: stats.ops,
                            totalCost: credits, // Actual Make.com credits (not EUR estimate)
                            totalTokens: 0
                        }
                    });
                }
            });
        }

        // Calculate totals for response
        const totalCredits = Object.values(usageByDate).reduce(
            (sum, day) => sum + day.centicredits, 0
        ) / 100;
        const totalOps = Object.values(usageByDate).reduce(
            (sum, day) => sum + day.ops, 0
        );

        console.log(`[Make Sync] Complete. ${scenarios.length} scenarios, ${datesToUpdate.length} days, ${totalCredits} credits, ${totalOps} operations`);

        // Check usage limits after sync and pause scenarios if exceeded
        const newlyPaused = await checkAndPauseIfNeeded(prisma, tenantId);

        res.json({
            status: 'success',
            scenariosProcessed: scenarios.length,
            recordsUpdated: datesToUpdate.length,
            totalCredits,
            totalOperations: totalOps,
            folderFiltered: !!tenant.makeFolderId,
            scenariosPaused: newlyPaused,
        });

    } catch (error: any) {
        console.error('[Make Sync] Failed:', error);
        if (error.response?.status === 401) {
            return next(createError('Unauthorized. Check API Key.', 401, 'INVALID_KEY'));
        }
        next(createError('Sync failed.', 500, 'SYNC_FAILED'));
    }
});

/**
 * GET /v1/integrations/azure/check
 *
 * Verifies the connection to Azure Document Intelligence using the stored
 * API key and endpoint by calling the Document Models list endpoint.
 */
router.get('/azure/check', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: { azureApiKey: true, azureEndpoint: true },
        });

        if (!tenant?.azureApiKey || !tenant?.azureEndpoint) {
            return next(createError(
                'Azure credentials not configured. Please add your API key and endpoint in Settings.',
                400,
                'NO_CREDENTIALS'
            ));
        }

        const endpoint = tenant.azureEndpoint.replace(/\/$/, '');

        console.log('[Azure Check] Testing connectivity to:', endpoint);

        const response = await axios.get(
            `${endpoint}/documentintelligence/documentModels?api-version=2024-11-30`,
            {
                headers: { 'Ocp-Apim-Subscription-Key': tenant.azureApiKey },
                timeout: 8000,
            }
        );

        const modelCount = response.data?.value?.length ?? 0;
        console.log('[Azure Check] Connected. Models available:', modelCount);

        res.json({
            status: 'connected',
            endpoint,
            modelsAvailable: modelCount,
        });

    } catch (error: any) {
        console.error('[Azure Check] Failed:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });

        if (error.response?.status === 401 || error.response?.status === 403) {
            return next(createError(
                'Invalid API key or unauthorized. Please check your Azure credentials.',
                401,
                'INVALID_KEY'
            ));
        }

        if (error.response?.status === 404) {
            return next(createError(
                'Endpoint not found. Please verify your Azure endpoint URL.',
                400,
                'INVALID_ENDPOINT'
            ));
        }

        next(createError(
            `Connection failed: ${error.response?.data?.error?.message || error.message}`,
            502,
            'CONNECTION_FAILED'
        ));
    }
});

/**
 * POST /v1/integrations/make/pause-all
 *
 * Manually pauses every Make.com scenario in the configured folder/org.
 * Also sets the scenariosPaused flag on the tenant.
 */
router.post('/make/pause-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const result = await pauseAllScenarios(prisma, tenantId);

        res.json({
            status: 'paused',
            scenariosPaused: result.paused,
            scenariosFailed: result.failed,
        });
    } catch (error: any) {
        console.error('[Make Pause All]', error);
        next(createError('Failed to pause scenarios.', 500, 'PAUSE_FAILED'));
    }
});

/**
 * POST /v1/integrations/make/resume-all
 *
 * Manually resumes every Make.com scenario in the configured folder/org.
 * Also clears the scenariosPaused flag on the tenant.
 */
router.post('/make/resume-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const prisma: PrismaClient = req.app.locals.prisma;
        const tenantId = req.user!.tenantId;

        if (!tenantId) {
            return next(createError('No tenant selected', 400, 'NO_TENANT'));
        }

        const result = await resumeAllScenarios(prisma, tenantId);

        res.json({
            status: 'resumed',
            scenariosResumed: result.resumed,
            scenariosFailed: result.failed,
        });
    } catch (error: any) {
        console.error('[Make Resume All]', error);
        next(createError('Failed to resume scenarios.', 500, 'RESUME_FAILED'));
    }
});

export { router as integrationsRouter };
