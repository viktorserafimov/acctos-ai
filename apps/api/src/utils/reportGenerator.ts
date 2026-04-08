import { PrismaClient } from '@prisma/client';
import { syncMakeUsageForTenant } from './makeSync.js';

// Update this to the correct GPT-5 model ID once confirmed
const REPORT_MODEL = 'gpt-5.4';

/**
 * Generates a daily AI report for a single tenant for the given date.
 *
 * Steps:
 *  1. Sync Make.com usage so credits are up to date.
 *  2. Read DocumentUsageAggregate for the date.
 *  3. Read UsageAggregate (make) for the date.
 *  4. Call OpenAI Chat Completions.
 *  5. Upsert a DailyReport record.
 */
export async function generateDailyReportForTenant(
    prisma: PrismaClient,
    tenantId: string,
    date: Date,
): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];

    // 1. Sync Make.com credits first
    await syncMakeUsageForTenant(prisma, tenantId).catch((e: any) =>
        console.warn(`[Report] Make sync failed for tenant ${tenantId}: ${e.message}`)
    );

    // 2. Document usage for the date
    const docAgg = await prisma.documentUsageAggregate.findFirst({
        where: { customerId: tenantId, date },
    });

    // 3. Make.com credits for the date
    const makeAgg = await prisma.usageAggregate.findFirst({
        where: { tenantId, source: 'make', date },
    });

    const pagesSpent = docAgg?.pagesSpent ?? 0;
    const rowsUsed = docAgg?.rowsUsed ?? 0;
    const documentsHandled = (docAgg as any)?.documentsHandled ?? 0;
    const makeCredits = makeAgg ? Number(makeAgg.totalCost) : 0;

    // Skip days with no activity at all
    if (pagesSpent === 0 && rowsUsed === 0 && documentsHandled === 0 && makeCredits === 0) {
        console.log(`[Report] No activity for tenant ${tenantId} on ${dateStr}, skipping`);
        return;
    }

    // 4. Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('[Report] OPENAI_API_KEY is not set — cannot generate report');
        return;
    }

    const prompt = `You are writing a daily usage report for a document processing automation platform. Based on the usage data below for ${dateStr}, write a 2–3 paragraph narrative summary of what happened that day. Write in a clear, professional tone as if briefing a business owner. Focus only on facts and observable patterns — do not include recommendations or suggestions. Do not use bullet points or headers, just flowing prose.

Usage data:
- PDF pages processed: ${pagesSpent}
- Excel rows extracted: ${rowsUsed}
- Documents handled: ${documentsHandled}
- Make.com automation credits used: ${makeCredits.toFixed(2)}`;

    let narrative: string;
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: REPORT_MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_completion_tokens: 600,
                temperature: 0.4,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Report] OpenAI error ${response.status}: ${errText}`);
            return;
        }

        const data = await response.json() as any;
        narrative = data.choices?.[0]?.message?.content?.trim();
        if (!narrative) {
            console.error('[Report] Empty response from OpenAI');
            return;
        }
    } catch (e: any) {
        console.error(`[Report] OpenAI call failed: ${e.message}`);
        return;
    }

    // Prepend a structured metrics line so the UI can parse it for the collapsed preview.
    // Format: METRICS:pages=X,rows=Y,docs=Z,credits=W
    const metricsLine = `METRICS:pages=${pagesSpent},rows=${rowsUsed},docs=${documentsHandled},credits=${makeCredits.toFixed(2)}`;
    const content = `${metricsLine}\n---\n${narrative}`;

    // 5. Upsert the report
    await (prisma as any).dailyReport.upsert({
        where: { tenantId_date: { tenantId, date } },
        create: { tenantId, date, content },
        update: { content },
    });

    console.log(`[Report] Generated report for tenant ${tenantId} on ${dateStr}`);
}
