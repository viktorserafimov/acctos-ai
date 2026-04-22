// Barclays parser - auto-detects money in/out from header, handles signed values
// Adapted from Make scenarios, modules 1341 + 1376
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow } from './shared.js';

function fixOCRDate(s: string): string {
    // Fix "14/11 /2025" (space before slash)
    return s.replace(/(\d{2}\/\d{2})\s+(\/\d{4})/, '$1$2').replace(/\s*\/\s*/g, '/');
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
            else if (lower.includes('desc') || lower.includes('narrat') || lower.includes('memo') || lower.includes('detail')) descCol = c;
            else if (lower.includes('out') || lower.includes('debit') || lower.includes('paid out') || lower.includes('withdrawn')) outCol = c;
            else if (lower.includes('in') || lower.includes('credit') || lower.includes('paid in') || lower.includes('deposit')) inCol = c;
            else if (lower.includes('bal')) balCol = c;
        }
    }

    const startRow = header ? 1 : 0;

    for (let r = startRow; r <= rows; r++) {
        let rawDate = getCell(grid, r, dateCol);
        rawDate = fixOCRDate(rawDate);
        const date = parseDateToDDMMYYYY(rawDate);
        if (!date) continue;

        // Skip "Start balance" row
        const rawDesc = getCell(grid, r, descCol);
        if (/start\s+balance/i.test(rawDesc)) continue;

        const description = rawDesc;

        // Handle signed values like "-£35.56"
        let rawOut = getCell(grid, r, outCol).replace(/[£$€,\s]/g, '');
        let rawIn  = getCell(grid, r, inCol).replace(/[£$€,\s]/g, '');
        const rawBal = getCell(grid, r, balCol).replace(/[£$€,\s]/g, '');

        // If there's only one amount column and it has a signed value
        if (!rawIn && rawOut.startsWith('-')) {
            rawIn = rawOut.replace('-', '');
            rawOut = '';
        }

        if (!rawOut && !rawIn) continue;

        transactions.push({
            date,
            type: '',
            description,
            moneyIn:  rawIn,
            moneyOut: rawOut,
            balance:  rawBal,
        });
    }

    return { transactions };
}
