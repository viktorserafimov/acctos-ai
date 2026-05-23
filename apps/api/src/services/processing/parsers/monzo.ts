// Monzo parser — 4-col, 5-col, and 6-col table layouts
// Layout detection based on Azure DI column count (maxCol):
//   4-col (maxCol=3): [date, description, amount, balance]       — direction from minus sign
//   5-col (maxCol=4): [date, type, desc, amount, balance]        — direction from balance delta
//   6-col (maxCol=5): [date, type, desc, moneyOut, moneyIn, bal] — explicit in/out columns
import {
    Cell, ParsedTransaction, ParseResult,
    normStr, parseMoney, formatMoney, buildGrid, getCell, maxRow, maxCol,
    parseDateToDDMMYYYY,
} from './shared.js';

// Fix Azure DI OCR glitch: "01/08/20 24" → "01/08/2024"
function fixSplitYear(s: string): string {
    return s.replace(/(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2})\s+(\d{2})$/, '$1$2');
}

function parseDate(raw: string): string {
    return parseDateToDDMMYYYY(fixSplitYear(normStr(raw)));
}

// Extract two £-prefixed amounts from a smashed cell, e.g. "£48.70 £436.68"
function extractTwoAmounts(s: string): [number, number] | null {
    const matches = s.match(/£\s*[\d,]+(?:\.\d{1,2})?/g);
    if (!matches || matches.length < 2) return null;
    const a = parseMoney(matches[0]);
    const b = parseMoney(matches[1]);
    if (a === null || b === null) return null;
    return [a, b];
}

function isHeaderRow(cols: string[]): boolean {
    const joined = cols.join(' ').toLowerCase();
    let hits = 0;
    if (/\bdate\b/.test(joined))               hits++;
    if (/description|transaction/.test(joined)) hits++;
    if (/\bout\b|debit|amount/.test(joined))   hits++;
    if (/\bin\b|credit/.test(joined))          hits++;
    if (/balance/.test(joined))                hits++;
    if (/\btype\b/.test(joined))               hits++;
    return hits >= 3;
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const cols = maxCol(cells);

    // Build flat ordered table from grid (skips gaps from row-offset merging)
    const table: { rowIndex: number; cols: string[] }[] = [];
    for (let r = 0; r <= rows; r++) {
        if (!grid.has(r)) continue;
        const row: string[] = [];
        for (let c = 0; c <= cols; c++) {
            row.push(normStr(getCell(grid, r, c)));
        }
        table.push({ rowIndex: r, cols: row });
    }

    if (!table.length) return { transactions: [] };

    const startAt = isHeaderRow(table[0].cols) ? 1 : 0;

    const isSixCols  = cols === 5;
    const isFiveCols = cols === 4;
    const isFourCols = cols === 3;

    const transactions: ParsedTransaction[] = [];

    for (let i = startAt; i < table.length; i++) {
        const { cols: c } = table[i];

        const date = parseDate(c[0]);
        if (!date) continue;  // skips repeated header rows from subsequent pages

        // ── 4-col: [date, description, amount, balance] ──────────────────────
        if (isFourCols) {
            const description = normStr(c[1]);
            const amountRaw   = normStr(c[2]);
            const balanceRaw  = normStr(c[3]);

            const amountNum = parseMoney(amountRaw);
            const balNum    = parseMoney(balanceRaw);
            if (amountNum === null || amountNum <= 0 || balNum === null) continue;

            const isNegative = /-\s*\d/.test(amountRaw);
            const amt = formatMoney(amountNum);
            const bal = formatMoney(balNum);

            transactions.push({
                date, type: '', description: description || 'Unknown',
                moneyIn:  isNegative ? '' : amt,
                moneyOut: isNegative ? amt : '',
                balance:  bal,
            });
            continue;
        }

        const type = normStr(c[1]);
        const desc = normStr(c[2]);

        // ── 6-col: [date, type, desc, moneyOut, moneyIn, balance] ────────────
        if (isSixCols) {
            const outAmt = parseMoney(c[3]);
            const inAmt  = parseMoney(c[4]);
            const balNum = parseMoney(c[5]);
            const bal    = balNum !== null ? formatMoney(balNum) : '';

            const d = desc.toLowerCase();
            const t = type.toUpperCase();
            const hasFrom = /\bfrom\b/.test(d);

            let moneyIn = '', moneyOut = '';

            if (hasFrom) {
                const amt = (inAmt !== null && inAmt > 0) ? inAmt : outAmt;
                if (amt === null || amt <= 0) continue;
                moneyIn = formatMoney(amt);
            } else if (t === 'MOA' && outAmt !== null && outAmt > 0 && (inAmt === null || inAmt === 0)) {
                moneyIn = formatMoney(outAmt);
            } else if (outAmt !== null && outAmt > 0 && (inAmt === null || inAmt === 0)) {
                moneyOut = formatMoney(outAmt);
            } else if (inAmt !== null && inAmt > 0 && (outAmt === null || outAmt === 0)) {
                moneyIn = formatMoney(inAmt);
            } else if (inAmt !== null && outAmt !== null && inAmt > 0 && outAmt > 0) {
                if (inAmt >= outAmt) moneyIn = formatMoney(inAmt);
                else moneyOut = formatMoney(outAmt);
            } else {
                continue;
            }

            transactions.push({ date, type, description: desc, moneyIn, moneyOut, balance: bal });
            continue;
        }

        // ── 5-col: [date, type, desc, amount, balance] ───────────────────────
        if (isFiveCols) {
            let amountNum = parseMoney(c[3]);
            let balNum    = parseMoney(c[4]);

            // Handle smashed "amount balance" in col 3: e.g. "£48.70 £436.68"
            if (balNum === null) {
                const pair = extractTwoAmounts(normStr(c[3]));
                if (pair) { amountNum = pair[0]; balNum = pair[1]; }
            }

            if (amountNum === null || amountNum <= 0 || balNum === null) continue;

            const bal = formatMoney(balNum);
            const amt = formatMoney(amountNum);
            const d   = desc.toLowerCase();
            const t   = type.toUpperCase();

            // Next table entry — may be a header row (balance will be null → heuristics)
            const nextRow = table[i + 1];
            let nextBalNum: number | null = null;
            if (nextRow) {
                nextBalNum = parseMoney(nextRow.cols[4]);
                if (nextBalNum === null) {
                    const pair = extractTwoAmounts(normStr(nextRow.cols[3]));
                    if (pair) nextBalNum = pair[1];
                }
            }

            let moneyIn = '', moneyOut = '';

            if (/\bfrom\b/.test(d)) {
                moneyIn = amt;
            } else if (nextBalNum === null) {
                // Last row or next row is a header — use type heuristic
                if (t === 'MOA') moneyIn = amt;
                else moneyOut = amt;
            } else {
                // Positive delta = current balance > next balance = money came IN here
                const delta = balNum - nextBalNum;
                if (Math.abs(delta) < 0.000001) continue;
                if (Math.abs(Math.abs(delta) - amountNum) > 0.01) continue;
                if (delta > 0) moneyIn = amt;
                else moneyOut = amt;
            }

            if (!moneyIn && !moneyOut) continue;
            transactions.push({ date, type, description: desc, moneyIn, moneyOut, balance: bal });
        }
    }

    return { transactions };
}
