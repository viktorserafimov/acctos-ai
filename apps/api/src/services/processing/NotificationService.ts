/**
 * Notification service — two alert channels:
 *
 *  1. notifyParserError  → operator/team alert
 *     Triggered when verification fails: parsed totals don't match the bank's
 *     declared totals or the opening→closing balance chain breaks.
 *     Set ALERT_TEAM_WEBHOOK_URL to receive a JSON POST.
 *
 *  2. notifyChainGap     → client alert
 *     Triggered when all individual files pass their own checks but the overall
 *     opening→closing balance across the batch doesn't close — the client is
 *     missing one or more bank statement files.
 *     Set ALERT_CLIENT_WEBHOOK_URL for now; replace with email send once a
 *     provider (Resend / SendGrid) is wired up.
 *
 * Both functions are fire-and-forget: they never throw and never delay processing.
 * If no env var is configured they log to console only.
 */

export interface ParserErrorAlert {
    jobId:    string;
    tenantId?: string;
    /** Human-readable label: filename for single-file, "batch (N files)" for multi. */
    label:    string;
    failedFiles: Array<{
        filename:     string;
        parsedIn:     number;
        parsedOut:    number;
        declaredIn?:  number;
        declaredOut?: number;
        /** Positive = parsed more than declared; negative = parsed less. */
        inDiff?:      number;
        outDiff?:     number;
        /** Set when failure is an opening→closing balance mismatch within one file. */
        balanceDiff?: number;
    }>;
}

export interface ChainGapAlert {
    jobId:    string;
    tenantId?: string;
    fileCount:            number;
    chainOpeningBalance:  number;
    chainClosingBalance:  number;
    expectedClosing:      number;
    /** actualClosing - expectedClosing. Non-zero means at least one file is missing. */
    diff:                 number;
}

// ── Team alert ────────────────────────────────────────────────────────────────

export function notifyParserError(alert: ParserErrorAlert): void {
    const lines = alert.failedFiles.map(f => {
        const parts: string[] = [`  • ${f.filename}`];
        if (f.inDiff != null)      parts.push(`In diff: ${f.inDiff >= 0 ? '+' : ''}${f.inDiff.toFixed(2)}`);
        if (f.outDiff != null)     parts.push(`Out diff: ${f.outDiff >= 0 ? '+' : ''}${f.outDiff.toFixed(2)}`);
        if (f.balanceDiff != null) parts.push(`Balance diff: ${f.balanceDiff >= 0 ? '+' : ''}${f.balanceDiff.toFixed(2)}`);
        return parts.join('  ');
    });

    console.error(
        `[ALERT:parser_error] Job ${alert.jobId} | tenant ${alert.tenantId ?? 'unknown'} | ${alert.label}\n` +
        lines.join('\n')
    );

    postWebhook(process.env.ALERT_TEAM_WEBHOOK_URL, { type: 'parser_error', ...alert });

    // TODO: when email provider is ready, uncomment:
    // sendEmail({
    //   to: process.env.ALERT_TEAM_EMAIL,
    //   subject: `[acctos] Parser verification failed — ${alert.label}`,
    //   text: `Job ${alert.jobId}\n\n${lines.join('\n')}`,
    // });
}

// ── Client alert ──────────────────────────────────────────────────────────────

export function notifyChainGap(alert: ChainGapAlert): void {
    const absDiff = Math.abs(alert.diff).toFixed(2);
    const direction = alert.diff < 0 ? 'shortfall' : 'surplus';

    console.warn(
        `[ALERT:chain_gap] Job ${alert.jobId} | tenant ${alert.tenantId ?? 'unknown'} | ` +
        `${alert.fileCount} files — gap £${absDiff} (${direction}). ` +
        `Opening: ${alert.chainOpeningBalance.toFixed(2)}, ` +
        `Expected closing: ${alert.expectedClosing.toFixed(2)}, ` +
        `Actual closing: ${alert.chainClosingBalance.toFixed(2)}`
    );

    postWebhook(process.env.ALERT_CLIENT_WEBHOOK_URL, { type: 'chain_gap', ...alert });

    // TODO: when per-tenant notification email is available, uncomment:
    // const clientEmail = await getTenantNotificationEmail(alert.tenantId);
    // if (clientEmail) {
    //   sendEmail({
    //     to: clientEmail,
    //     subject: 'Missing bank statement detected',
    //     text: `We detected a gap of £${absDiff} across your ${alert.fileCount} uploaded files.\n` +
    //           `This usually means one or more monthly statements are missing.\n` +
    //           `Please upload the complete sequence and re-process.`,
    //   });
    // }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function postWebhook(url: string | undefined, body: object): void {
    if (!url) return;
    fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    }).then(res => {
        if (!res.ok) res.text().then(t => console.error(`[Notifications] Webhook ${url} returned ${res.status}: ${t}`));
    }).catch(err => {
        console.error(`[Notifications] Webhook ${url} failed:`, err.message);
    });
}
