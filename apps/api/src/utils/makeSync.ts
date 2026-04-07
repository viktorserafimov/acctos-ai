import axios from 'axios';
import { PrismaClient, Prisma } from '@prisma/client';

export interface MakeSyncResult {
    credits: number;
    ops: number;
    days: number;
}

/**
 * Syncs Make.com scenario usage for a single tenant and persists it into
 * the UsageAggregate table (source = 'make').
 *
 * Returns null if the tenant has no Make.com API key configured.
 */
export async function syncMakeUsageForTenant(
    prisma: PrismaClient,
    tenantId: string
): Promise<MakeSyncResult | null> {
    const tenant = await (prisma.tenant as any).findUnique({
        where: { id: tenantId },
        select: { makeApiKey: true, makeFolderId: true, makeOrgId: true },
    });

    if (!tenant?.makeApiKey) return null;

    const axiosConfig = {
        headers: { Authorization: `Token ${tenant.makeApiKey}` },
        timeout: 10000,
    };

    // Resolve organization ID
    let organizationId: string | undefined = tenant.makeOrgId || undefined;

    if (!organizationId) {
        try {
            const profileRes = await axios.get('https://eu2.make.com/api/v2/users/me', axiosConfig);
            const userData = profileRes.data.authUser || profileRes.data.user;
            organizationId = userData?.organizationId || profileRes.data?.organizationId;
            if (!organizationId && userData?.organization?.id) {
                organizationId = userData.organization.id;
            }
        } catch {
            console.warn(`[makeSync] /users/me failed for tenant ${tenantId}`);
        }
    }

    if (!organizationId) {
        try {
            const orgsRes = await axios.get('https://eu2.make.com/api/v2/organizations', axiosConfig);
            const orgs = orgsRes.data.organizations || [];
            if (orgs.length > 0) organizationId = orgs[0].id;
        } catch (e: any) {
            console.error(`[makeSync] Could not get org for tenant ${tenantId}: ${e.message}`);
            return null;
        }
    }

    if (!organizationId) return null;

    // Fetch scenarios
    let scenariosUrl = `https://eu2.make.com/api/v2/scenarios?organizationId=${organizationId}&limit=200`;
    if (tenant.makeFolderId) scenariosUrl += `&folderId=${tenant.makeFolderId}`;

    const scenariosRes = await axios.get(scenariosUrl, axiosConfig);
    const scenarios: any[] = scenariosRes.data.scenarios || [];

    // Fetch last-30-days usage for each scenario
    const usageByDate: Record<string, { ops: number; data: number; centicredits: number }> = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const fromStr = thirtyDaysAgo.toISOString().split('T')[0];
    const toStr = now.toISOString().split('T')[0];

    for (const scenario of scenarios) {
        try {
            const usageRes = await axios.get(
                `https://eu2.make.com/api/v2/scenarios/${scenario.id}/usage?from=${fromStr}&to=${toStr}&interval=daily`,
                axiosConfig
            );
            const history: any[] = usageRes.data.data || [];
            if (!Array.isArray(history)) continue;

            for (const point of history) {
                let dateStr: string;
                if (point.date?.includes('-')) {
                    const parts = point.date.split('-');
                    dateStr = parts.length === 3
                        ? `${parts[2]}-${parts[1]}-${parts[0]}`
                        : new Date(point.date).toISOString().split('T')[0];
                } else {
                    dateStr = new Date(point.date).toISOString().split('T')[0];
                }
                if (!usageByDate[dateStr]) usageByDate[dateStr] = { ops: 0, data: 0, centicredits: 0 };
                usageByDate[dateStr].ops += point.operations || 0;
                usageByDate[dateStr].data += point.dataTransfer || 0;
                usageByDate[dateStr].centicredits += point.centicredits || 0;
            }
        } catch (err: any) {
            console.warn(`[makeSync] Scenario ${scenario.id} failed: ${err.message}`);
        }
    }

    // Persist to DB
    const datesToUpdate = Object.keys(usageByDate);
    if (datesToUpdate.length > 0) {
        const minDate = new Date(datesToUpdate.sort()[0]);
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.usageAggregate.deleteMany({
                where: { tenantId, source: 'make', date: { gte: minDate } },
            });
            for (const dateStr of datesToUpdate) {
                const stats = usageByDate[dateStr];
                if (stats.ops === 0 && stats.data === 0 && stats.centicredits === 0) continue;
                await tx.usageAggregate.create({
                    data: {
                        tenantId,
                        source: 'make',
                        date: new Date(dateStr),
                        eventCount: stats.ops,
                        totalCost: stats.centicredits / 100,
                        totalTokens: 0,
                    },
                });
            }
        });
    }

    return {
        credits: Object.values(usageByDate).reduce((s, d) => s + d.centicredits, 0) / 100,
        ops: Object.values(usageByDate).reduce((s, d) => s + d.ops, 0),
        days: datesToUpdate.length,
    };
}
