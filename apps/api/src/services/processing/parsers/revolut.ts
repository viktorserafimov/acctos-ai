// Revolut parser - handles signed amounts and looksLikeMoneyIn heuristic
// Adapted from Make scenario 1.2.2, module id 1181
import { Cell, ParsedTransaction, ParseResult, normStr, parseDateToDDMMYYYY, buildGrid, getCell, maxRow } from './shared.js';

const MONEY_IN_KEYWORDS = ['receipt','received','credit','incoming','salary','refund','cashback','reward','interest','dividend'];

function looksLikeMoneyIn(description: string): boolean {
    const lower = description.toLowerCase();
    return MONEY_IN_KEYWORDS.some(k => lower.includes(k));
}

function extractAmount(s: string): string {
    if (!s) return '';
    const m = s.match(/[£$€]?\s*([\d,]+\.?\d{0,2})/);
    return m ? m[1].replace(/,/g, '') : s.replace(/,/g, '');
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    let dateCol = 0, descCol = 1, amountCol = 2, balCol = 3;
    let hasSepaateInOut = false;
    let inCol = -1, outCol = -1;

    const header = grid.get(0);
    if (header) {
        for (const [c, v] of header) {
            const lower = v.toLowerCase();
            if (lower.includes('date')) dateCol = c;
            else if (lower.includes('desc') || lower.includes('narrat') || lower.includes('type')) descCol = c;
            else if (lower.includes('amount') && !lower.includes('bal')) amountCol = c;
            else if (lower.includes('bal')) balCol = c;
            else if (lower.includes('in') || lower.includes('credit')) { inCol = c; hasSepaateInOut = true; }
            else if (lower.includes('out') || lower.includes('debit')) { outCol = c; hasSepaateInOut = true; }
        }
    }

    const startRow = header ? 1 : 0;

    for (let r = startRow; r <= rows; r++) {
        const rawDate = getCell(grid, r, dateCol);
        const date = parseDateToDDMMYYYY(rawDate);
        if (!date) continue;

        const description = getCell(grid, r, descCol);
        const balance = getCell(grid, r, balCol).replace(/,/g, '');

        let moneyIn = '', moneyOut = '';

        if (hasSepaateInOut) {
            moneyIn  = inCol >= 0 ? extractAmount(getCell(grid, r, inCol)) : '';
            moneyOut = outCol >= 0 ? extractAmount(getCell(grid, r, outCol)) : '';
        } else {
            const raw = getCell(grid, r, amountCol);
            const amount = raw.replace(/[£$€\s]/g, '');
            if (amount.startsWith('-')) {
                moneyOut = amount.replace('-', '').replace(/,/g, '');
            } else if (amount) {
                // Use description heuristic to determine direction
                if (looksLikeMoneyIn(description)) {
                    moneyIn = amount.replace(/,/g, '');
                } else {
                    moneyOut = amount.replace(/,/g, '');
                }
            }
        }

        if (!moneyIn && !moneyOut) continue;

        transactions.push({ date, type: '', description, moneyIn, moneyOut, balance });
    }

    return { transactions };
}
