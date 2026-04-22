// Nationwide Building Society parser
// Adapted from Make scenario 1.5.7, module id 1230
// Key: handles split OCR dates ("5 MAR" + "2026" as separate cells)
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow, normStr } from './shared.js';

function isYearOnly(s: string): boolean {
    return /^\d{4}$/.test(s.trim());
}

function isDayMon(s: string): boolean {
    return /^\d{1,2}\s+[A-Za-z]{3,}$/.test(s.trim());
}

// Scan first 5 rows to detect the header
function detectHeader(grid: Map<number, Map<number, string>>, rows: number): number {
    for (let r = 0; r <= Math.min(4, rows); r++) {
        const row = grid.get(r);
        if (!row) continue;
        for (const v of row.values()) {
            if (v.toLowerCase().includes('date') || v.toLowerCase().includes('description')) return r;
        }
    }
    return 0;
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    const headerRow = detectHeader(grid, rows);
    const header = grid.get(headerRow);

    let dateCol = 0, descCol = 1, outCol = 2, inCol = 3, balCol = 4;
    if (header) {
        for (const [c, v] of header) {
            const lower = v.toLowerCase();
            if (lower.includes('date')) dateCol = c;
            else if (lower.includes('desc') || lower.includes('narrat') || lower.includes('transaction')) descCol = c;
            else if (lower.includes('out') || lower.includes('debit') || lower.includes('withdraw') || lower.includes('paid out')) outCol = c;
            else if (lower.includes('in') || lower.includes('credit') || lower.includes('deposit') || lower.includes('paid in')) inCol = c;
            else if (lower.includes('bal')) balCol = c;
        }
    }

    const startRow = headerRow + 1;
    let lastDateStr = '';

    for (let r = startRow; r <= rows; r++) {
        let rawDate = getCell(grid, r, dateCol);

        // Handle split OCR date: "5 MAR" on this row, "2026" on next row
        if (isDayMon(rawDate)) {
            const nextYear = getCell(grid, r + 1, dateCol);
            if (isYearOnly(nextYear)) {
                rawDate = `${rawDate.trim()} ${nextYear.trim()}`;
            }
        }

        const date = rawDate ? parseDateToDDMMYYYY(rawDate) : '';

        // Use last known date for continuation rows (Nationwide sometimes omits date)
        const effectiveDate = date || lastDateStr;
        if (date) lastDateStr = date;
        if (!effectiveDate) continue;

        const description = getCell(grid, r, descCol);
        if (!description && !date) continue;

        const rawOut = getCell(grid, r, outCol).replace(/[£$€,]/g, '').trim();
        const rawIn  = getCell(grid, r, inCol).replace(/[£$€,]/g, '').trim();
        const rawBal = getCell(grid, r, balCol).replace(/[£$€,]/g, '').trim();

        if (!rawOut && !rawIn) continue;

        transactions.push({ date: effectiveDate, type: '', description, moneyIn: rawIn, moneyOut: rawOut, balance: rawBal });
    }

    return { transactions };
}
