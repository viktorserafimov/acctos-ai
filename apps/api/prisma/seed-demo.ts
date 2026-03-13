/**
 * seed-demo.ts
 *
 * Populates the database with realistic example data so you can explore
 * every area of the dashboard:
 *   - DocumentUsageAggregate  → Document Usage tab charts & monthly history
 *   - DocumentUsageEvent      → raw event rows
 *   - MonthlyUsageSnapshot    → permanent monthly history table (Infrastructure tab)
 *   - UsageAggregate          → Infrastructure tab (Make / Azure / OpenAI charts)
 *   - UsageEvent              → raw infra event rows
 *   - Subscription            → billing status
 *   - Ticket + TicketMessage  → support section
 *
 * Run:  npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function dateUTC(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
}

function rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
    // 1. Find tenant
    let tenant = await prisma.tenant.findFirst({ where: { name: 'AI Assist BG' } });
    if (!tenant) tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.error('No tenant found. Run the base seed first.');
        process.exit(1);
    }
    console.log(`Using tenant: ${tenant.name} (${tenant.id})`);
    const tenantId = tenant.id;

    // 2. Find or create an admin user to attach to tickets / events
    let adminUser = await prisma.user.findFirst({
        where: { memberships: { some: { tenantId, role: 'ORG_OWNER' } } },
    });
    if (!adminUser) adminUser = await prisma.user.findFirst();
    if (!adminUser) {
        console.error('No user found. Run the base seed first.');
        process.exit(1);
    }
    console.log(`Using user: ${adminUser.email}`);

    // ── 3. Subscription ───────────────────────────────────────────────────────
    const subExists = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subExists) {
        await prisma.subscription.create({
            data: {
                tenantId,
                stripeCustomerId: 'cus_demo_example123',
                stripePriceId:    'price_demo_professional',
                status:           'active',
                currentPeriodEnd: dateUTC(2026, 4, 5),
            },
        });
        console.log('Created subscription (active)');
    } else {
        console.log('Subscription already exists — skipped');
    }

    // ── 4. DocumentUsageAggregate (daily rows for last ~90 days) ──────────────
    //
    // Simulates realistic page/row usage with some weekday patterns.
    console.log('Seeding DocumentUsageAggregate …');

    const docAggEntries: {
        customerId: string;
        date: Date;
        pagesSpent: number;
        rowsUsed: number;
        eventCount: number;
    }[] = [];

    for (let d = 89; d >= 0; d--) {
        const date = daysAgo(d);
        const dow  = date.getUTCDay(); // 0=Sun, 6=Sat
        const isWeekend = dow === 0 || dow === 6;
        const pages = isWeekend ? rand(5, 30)  : rand(40, 200);
        const rows  = isWeekend ? rand(2, 15)  : rand(20, 100);
        docAggEntries.push({ customerId: tenantId, date, pagesSpent: pages, rowsUsed: rows, eventCount: rand(1, 10) });
    }

    for (const entry of docAggEntries) {
        await prisma.documentUsageAggregate.upsert({
            where: { customerId_date: { customerId: entry.customerId, date: entry.date } },
            update: { pagesSpent: entry.pagesSpent, rowsUsed: entry.rowsUsed, eventCount: entry.eventCount },
            create: entry,
        });
    }
    console.log(`  → ${docAggEntries.length} DocumentUsageAggregate rows upserted`);

    // ── 5. DocumentUsageEvent (a handful of raw events for today / yesterday) ─
    console.log('Seeding DocumentUsageEvent …');

    const docEventScenarios = [
        { name: 'Bank Statement Parser',   pages: 12, rows: 6  },
        { name: 'Invoice Processor',       pages: 4,  rows: 2  },
        { name: 'Receipt Extractor',       pages: 1,  rows: 1  },
        { name: 'Contract Analyzer',       pages: 18, rows: 9  },
        { name: 'ID Card Verifier',        pages: 2,  rows: 1  },
    ];

    let docEventInserted = 0;
    for (let i = 0; i < 20; i++) {
        const sc  = docEventScenarios[i % docEventScenarios.length];
        const key = `demo-doc-event-${i}`;
        const ts  = new Date(Date.now() - i * 3_600_000); // spread over last 20 hours

        try {
            await prisma.documentUsageEvent.create({
                data: {
                    customerId:     tenantId,
                    idempotencyKey: key,
                    pagesSpent:     sc.pages,
                    rowsUsed:       sc.rows,
                    scenarioId:     `scen-${100 + i}`,
                    scenarioName:   sc.name,
                    jobId:          `job-demo-${i}`,
                    timestamp:      ts,
                    createdAt:      ts,
                },
            });
            docEventInserted++;
        } catch {
            // already exists — skip
        }
    }
    console.log(`  → ${docEventInserted} DocumentUsageEvent rows inserted`);

    // ── 6. MonthlyUsageSnapshot (last 5 complete months) ─────────────────────
    console.log('Seeding MonthlyUsageSnapshot …');

    const now = new Date();
    const currentYear  = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    const snapshots = [];
    for (let offset = 1; offset <= 5; offset++) {
        let m = currentMonth - offset;
        let y = currentYear;
        if (m <= 0) { m += 12; y -= 1; }
        snapshots.push({
            tenantId,
            year:       y,
            month:      m,
            pagesSpent: rand(2000, 6000),
            rowsUsed:   rand(800, 3000),
        });
    }

    let snapInserted = 0;
    for (const snap of snapshots) {
        await (prisma as any).monthlyUsageSnapshot.upsert({
            where: { tenantId_year_month: { tenantId: snap.tenantId, year: snap.year, month: snap.month } },
            update: { pagesSpent: snap.pagesSpent, rowsUsed: snap.rowsUsed },
            create: snap,
        });
        snapInserted++;
    }
    console.log(`  → ${snapInserted} MonthlyUsageSnapshot rows upserted`);

    // ── 7. UsageAggregate (infra: Make / Azure / OpenAI, last 30 days) ────────
    console.log('Seeding UsageAggregate …');

    const sources = ['make', 'azure', 'openai'] as const;
    const docTypes = ['bank_statement', 'invoice', 'receipt', 'contract'];
    const fileTypes = ['pdf', 'jpg', 'png', 'docx'];
    const steps = ['extract', 'classify', 'validate', 'export'];

    // Build all rows first, then insert with skipDuplicates (avoids null-in-unique issues)
    const aggRows: {
        tenantId: string; date: Date; source: string;
        documentType: string; fileType: string; step: string; bankCode: null;
        eventCount: number; totalCost: string; totalTokens: number;
    }[] = [];

    for (let d = 29; d >= 0; d--) {
        const date = daysAgo(d);
        for (const source of sources) {
            for (const docType of docTypes) {
                const isWeekend = [0, 6].includes(date.getUTCDay());
                const events  = isWeekend ? rand(1, 5)  : rand(5, 30);
                const cost    = (events * rand(2, 8) * 0.001).toFixed(4);
                const tokens  = events * rand(200, 800);
                aggRows.push({
                    tenantId, date, source,
                    documentType: docType, fileType: 'pdf', step: 'extract', bankCode: null,
                    eventCount: events, totalCost: cost, totalTokens: tokens,
                });
            }
        }
    }

    const aggResult = await prisma.usageAggregate.createMany({
        data: aggRows,
        skipDuplicates: true,
    });
    console.log(`  → ${aggResult.count} UsageAggregate rows inserted`);

    // ── 8. UsageEvent (raw infra events, last 7 days sample) ─────────────────
    console.log('Seeding UsageEvent …');

    let usageEvInserted = 0;
    for (let i = 0; i < 50; i++) {
        const source   = sources[i % sources.length];
        const docType  = docTypes[i % docTypes.length];
        const fileType = fileTypes[i % fileTypes.length];
        const step     = steps[i % steps.length];
        const key      = `demo-usage-ev-${i}`;
        const ts       = new Date(Date.now() - i * 2_700_000);

        try {
            await prisma.usageEvent.create({
                data: {
                    tenantId,
                    source,
                    idempotencyKey: key,
                    documentType:   docType,
                    fileType,
                    step,
                    bankCode:       null,
                    cost:           (rand(1, 20) * 0.001).toFixed(4),
                    tokens:         rand(150, 1200),
                    timestamp:      ts,
                },
            });
            usageEvInserted++;
        } catch {
            // duplicate — skip
        }
    }
    console.log(`  → ${usageEvInserted} UsageEvent rows inserted`);

    // ── 9. Tickets ────────────────────────────────────────────────────────────
    console.log('Seeding Tickets …');

    const ticketSeeds = [
        {
            subject:  'Bank statement parsing returns wrong totals',
            status:   'open',
            priority: 'high',
            messages: [
                'Hello, we noticed the extracted totals are off by ~5% on statements from UniCredit. Can you investigate?',
                'We reproduced this on our end — it looks like the currency conversion step is applying twice. A fix is in progress.',
            ],
        },
        {
            subject:  'How do I add extra page credits?',
            status:   'resolved',
            priority: 'normal',
            messages: [
                'We are running low on pages this month. How can we add more?',
                'You can purchase add-on page packs from the Billing section in your dashboard. Let us know if you need help.',
                'Found it — thank you!',
            ],
        },
        {
            subject:  'Make.com scenarios paused unexpectedly',
            status:   'open',
            priority: 'urgent',
            messages: [
                'Our Make.com scenarios stopped running this morning. The dashboard shows "Scenarios paused". We have not exceeded our limits.',
                'Checking now — this can sometimes happen after a billing-period reset. We will resume your scenarios manually.',
            ],
        },
    ];

    let ticketInserted = 0;
    for (const t of ticketSeeds) {
        const existing = await prisma.ticket.findFirst({ where: { tenantId, subject: t.subject } });
        if (existing) continue;

        const ticket = await prisma.ticket.create({
            data: { tenantId, subject: t.subject, status: t.status, priority: t.priority },
        });

        for (let mi = 0; mi < t.messages.length; mi++) {
            await prisma.ticketMessage.create({
                data: {
                    ticketId:  ticket.id,
                    authorId:  adminUser.id,
                    content:   t.messages[mi],
                    isInternal: false,
                    createdAt: new Date(Date.now() - (t.messages.length - mi) * 3_600_000),
                },
            });
        }
        ticketInserted++;
    }
    console.log(`  → ${ticketInserted} Tickets inserted`);

    // ── 10. Update tenant limits for demo ─────────────────────────────────────
    await (prisma.tenant as any).update({
        where: { id: tenantId },
        data: {
            pagesLimit:      5000,
            rowsLimit:       5000,
            addonPagesLimit: 500,
            addonRowsLimit:  250,
            lastResetAt:     dateUTC(2026, 3, 5), // last reset on 5 Mar 2026
        },
    });
    console.log('Updated tenant limits for demo');

    console.log('\n✓ Demo seed complete!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
