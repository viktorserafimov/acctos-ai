import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { generateDailyReportForTenant } from '../utils/reportGenerator.js';

/**
 * Schedules the daily report generation job.
 *
 * Runs at midnight EET every day (Europe/Athens handles EET/EEST DST
 * automatically — no manual UTC offset adjustment needed).
 *
 * For each tenant: syncs Make.com credits, then generates an AI report
 * for the previous day's usage and saves it to the daily_reports table.
 */
export function startDailyReportCron(prisma: PrismaClient): void {
    cron.schedule('0 0 * * *', async () => {
        console.log('[Cron] Starting daily report generation...');

        // Build yesterday's date (UTC midnight) — the day the report covers
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        try {
            const tenants = await prisma.tenant.findMany({ select: { id: true } });
            console.log(`[Cron] Generating reports for ${tenants.length} tenants for ${yesterday.toISOString().split('T')[0]}`);

            for (const tenant of tenants) {
                try {
                    await generateDailyReportForTenant(prisma, tenant.id, yesterday);
                } catch (e: any) {
                    console.error(`[Cron] Report failed for tenant ${tenant.id}: ${e.message}`);
                }
            }

            console.log('[Cron] Daily report generation complete');
        } catch (e: any) {
            console.error('[Cron] Daily report job failed:', e.message);
        }
    }, { timezone: 'Europe/Athens' });

    console.log('[Cron] Daily report job scheduled (midnight EET/Europe/Athens)');
}
