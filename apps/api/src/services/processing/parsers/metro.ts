// Metro Bank parser - 7-column format with date forward-fill and balance backfill
// Adapted from Make scenario 1.1, module id 1349
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow } from './shared.js';

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    // Metro Bank 7-column: DATE | TYPE | DESC | EXTRA_DESC | OUT | IN | BALANCE
    let dateCol = 0, typeCol = 1, descCol = 2, extraDescCol = 3, outCol = 4, inCol = 5, balCol = 6;

    const header = grid.get(0);
    if (header) {
        for (const [c, v] of header) {
            const lower = v.toLowerCase();
            if (lower.includes('date')) dateCol = c;
            else if (lower.includes('type') || lower.includes('kind')) typeCol = c;
            else if (lower.includes('desc') || lower.includes('narrat') || lower.includes('detail')) descCol = c;
            else if (lower.includes('out') || lower.includes('debit') || lower.includes('withdrawn')) outCol = c;
            else if (lower.includes('in') || lower.includes('credit') || lower.includes('deposit')) inCol = c;
            else if (lower.includes('bal')) balCol = c;
        }
    }

    const startRow = header ? 1 : 0;
    let lastDate = '';
    const rawTxns: ParsedTransaction[] = [];

    for (let r = startRow; r <= rows; r++) {
        const rawDate = getCell(grid, r, dateCol);
        const date = parseDateToDDMMYYYY(rawDate);

        // Metro Bank date format: "01 MAY 2025"
        if (date) lastDate = date;
        const effectiveDate = date || lastDate;
        if (!effectiveDate) continue;

        const type = getCell(grid, r, typeCol);
        const desc1 = getCell(grid, r, descCol);
        const desc2 = extraDescCol >= 0 ? getCell(grid, r, extraDescCol) : '';
        const description = [desc1, desc2].filter(Boolean).join(' ').trim();

        const moneyOut = getCell(grid, r, outCol).replace(/[£$€,\s]/g, '');
        const moneyIn  = getCell(grid, r, inCol).replace(/[£$€,\s]/g, '');
        const balance  = getCell(grid, r, balCol).replace(/[£$€,\s]/g, '');

        if (!moneyOut && !moneyIn) continue;

        rawTxns.push({ date: effectiveDate, type, description, moneyIn, moneyOut, balance });
    }

    // Balance backfill: if last balance is missing, carry forward from next row
    let lastBalance = '';
    for (let i = rawTxns.length - 1; i >= 0; i--) {
        if (rawTxns[i].balance) {
            lastBalance = rawTxns[i].balance;
        } else {
            rawTxns[i].balance = lastBalance;
        }
    }

    return { transactions: rawTxns };
}
