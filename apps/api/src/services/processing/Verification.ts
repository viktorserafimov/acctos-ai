import { ParsedTransaction, parseMoney } from './parsers/shared.js';

export interface VerificationSummary {
    totalIn: number;
    totalOut: number;
    openingBalance: number | null;
    closingBalance: number | null;
    balanceOk: boolean;
    balanceDiff: number | null;
    declaredIn?: number;
    declaredOut?: number;
    declaredOk?: boolean;
}

/**
 * Compute verification summary from parsed transactions.
 * Transactions must be sorted newest-first (descending).
 */
export function computeVerification(
    transactions: ParsedTransaction[],
    declared?: { moneyIn: number; moneyOut: number },
): VerificationSummary | undefined {
    if (!transactions.length) return undefined;

    const totalIn  = transactions.reduce((s, t) => s + (parseMoney(t.moneyIn)  ?? 0), 0);
    const totalOut = transactions.reduce((s, t) => s + (parseMoney(t.moneyOut) ?? 0), 0);

    const first = transactions[0];
    const last  = transactions[transactions.length - 1];
    const closingBal = parseMoney(first.balance);
    const oldestBal  = parseMoney(last.balance);

    let openingBalance: number | null = null;
    let balanceOk = true;
    let balanceDiff: number | null = null;

    if (closingBal !== null && oldestBal !== null) {
        const lastIn  = parseMoney(last.moneyIn)  ?? 0;
        const lastOut = parseMoney(last.moneyOut) ?? 0;
        openingBalance = oldestBal - lastIn + lastOut;
        const expected = openingBalance + totalIn - totalOut;
        balanceDiff = closingBal - expected;
        balanceOk = Math.abs(balanceDiff) <= 0.02;
    }

    let declaredIn: number | undefined;
    let declaredOut: number | undefined;
    let declaredOk: boolean | undefined;

    if (declared) {
        declaredIn = declared.moneyIn;
        declaredOut = declared.moneyOut;
        declaredOk =
            Math.abs(totalIn - declared.moneyIn) <= 0.02 &&
            Math.abs(totalOut - declared.moneyOut) <= 0.02;
    }

    return {
        totalIn, totalOut,
        openingBalance,
        closingBalance: closingBal,
        balanceOk, balanceDiff,
        declaredIn, declaredOut, declaredOk,
    };
}

export function logVerificationSummary(v: VerificationSummary): void {
    console.log(
        `[TotalsCheck] Opening: ${v.openingBalance?.toFixed(2) ?? 'N/A'} | ` +
        `In: ${v.totalIn.toFixed(2)} | Out: ${v.totalOut.toFixed(2)} | ` +
        `Closing: ${v.closingBalance?.toFixed(2) ?? 'N/A'}`
    );
    if (v.balanceOk) {
        console.log(`[TotalsCheck] Balance continuity OK ✓`);
    } else {
        console.warn(`[TotalsCheck] Balance mismatch — diff: ${v.balanceDiff?.toFixed(2)}`);
    }
    if (v.declaredIn != null && v.declaredOut != null) {
        if (v.declaredOk) {
            console.log(`[TotalsCheck] Declared totals match — In: ${v.declaredIn.toFixed(2)}, Out: ${v.declaredOut.toFixed(2)} ✓`);
        } else {
            console.warn(
                `[TotalsCheck] Declared totals mismatch — ` +
                `In diff: ${(v.totalIn - v.declaredIn).toFixed(2)}, ` +
                `Out diff: ${(v.totalOut - v.declaredOut).toFixed(2)}`
            );
        }
    }
}
