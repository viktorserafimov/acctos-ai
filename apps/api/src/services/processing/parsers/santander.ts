// Santander parser - similar to NatWest plus OCR date fix and DR/OD detection
// Adapted from Make scenario 1.5.5, module id 1355
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow } from './shared.js';

function fixOCRDate(s: string): string {
    // Fix "01/08/20 24" → "01/08/2024"
    return s.replace(/(\d{2}\/\d{2}\/\d{2})\s+(\d{2})/, '$1$2');
}

function isDebitSuffix(s: string): boolean {
    return /\b(DR|OD)\b/i.test(s);
}

function cleanAmount(s: string): string {
    return s.replace(/[£$€,\s]/g, '').replace(/\b(DR|OD)\b/gi, '').trim();
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    let dateCol = 0, descCol = 1, outCol = 2, inCol = 3, balCol = 4;

    const header = grid.get(0);
    if (header) {
        for (const [c, v] of header) {
            const lower = v.toLowerCase();
            if (lower.includes('date')) dateCol = c;
            else if (lower.includes('desc') || lower.includes('narrat') || lower.includes('detail')) descCol = c;
            else if (lower.includes('out') || lower.includes('debit') || lower.includes('paid out')) outCol = c;
            else if (lower.includes('in') || lower.includes('credit') || lower.includes('paid in')) inCol = c;
            else if (lower.includes('bal')) balCol = c;
        }
    }

    const startRow = header ? 1 : 0;

    for (let r = startRow; r <= rows; r++) {
        let rawDate = getCell(grid, r, dateCol);
        rawDate = fixOCRDate(rawDate);
        const date = parseDateToDDMMYYYY(rawDate);
        if (!date) continue;

        const description = getCell(grid, r, descCol);
        const rawOut = getCell(grid, r, outCol);
        const rawIn  = getCell(grid, r, inCol);
        const rawBal = getCell(grid, r, balCol);

        const moneyOut = cleanAmount(rawOut);
        const moneyIn  = cleanAmount(rawIn);

        // DR suffix on the amount means it's a debit
        const drOut = isDebitSuffix(rawOut) || isDebitSuffix(rawBal);

        if (!moneyOut && !moneyIn) continue;

        transactions.push({
            date,
            type: '',
            description,
            moneyIn,
            moneyOut: drOut && !moneyOut ? moneyIn : moneyOut,
            balance: cleanAmount(rawBal),
        });
    }

    return { transactions };
}
