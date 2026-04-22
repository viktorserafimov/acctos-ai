// Wise / TransferWise parser
// Adapted from Make scenario 1.2.4, module id 1410
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow, normStr } from './shared.js';

function inferType(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('convert') || lower.includes('exchange')) return 'CONVERT';
    if (lower.includes('card') || lower.includes('purchase')) return 'CARD';
    if (lower.includes('transfer') || lower.includes('send') || lower.includes('receive')) return 'TRANSFER';
    return 'OTHER';
}

function isMetaLine(s: string): boolean {
    return /^Transaction:/i.test(s.trim());
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    // Wise 4-column layout: DATE | DESCRIPTION | AMOUNT | BALANCE
    let dateCol = 0, descCol = 1, amountCol = 2, balCol = 3;
    let inCol = -1, outCol = -1;

    const header = grid.get(0);
    if (header) {
        for (const [c, v] of header) {
            const lower = v.toLowerCase();
            if (lower.includes('date')) dateCol = c;
            else if (lower.includes('desc') || lower.includes('narrat') || lower.includes('detail')) descCol = c;
            else if (lower.includes('amount') && !lower.includes('bal')) amountCol = c;
            else if (lower.includes('bal')) balCol = c;
            else if (lower.includes('received') || lower.includes('in') || lower.includes('credit')) inCol = c;
            else if (lower.includes('sent') || lower.includes('out') || lower.includes('debit')) outCol = c;
        }
    }

    const startRow = header ? 1 : 0;

    for (let r = startRow; r <= rows; r++) {
        const rawDate = getCell(grid, r, dateCol);
        const date = parseDateToDDMMYYYY(rawDate);
        if (!date) continue;

        const rawDesc = getCell(grid, r, descCol);
        if (isMetaLine(rawDesc)) continue;

        const description = rawDesc;
        const type = inferType(description);
        const balance = getCell(grid, r, balCol).replace(/,/g, '');

        let moneyIn = '', moneyOut = '';

        if (inCol >= 0 || outCol >= 0) {
            moneyIn  = inCol >= 0 ? getCell(grid, r, inCol).replace(/,/g, '').replace(/[£$€]/g, '') : '';
            moneyOut = outCol >= 0 ? getCell(grid, r, outCol).replace(/,/g, '').replace(/[£$€]/g, '') : '';
        } else {
            const raw = getCell(grid, r, amountCol).replace(/[£$€\s]/g, '').replace(/,/g, '');
            if (raw.startsWith('-')) moneyOut = raw.replace('-', '');
            else if (raw) moneyIn = raw;
        }

        if (!moneyIn && !moneyOut) continue;

        transactions.push({ date, type, description, moneyIn, moneyOut, balance });
    }

    return { transactions };
}
