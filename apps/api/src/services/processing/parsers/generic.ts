// Generic / fallback parser - used for unknown banks and assistant path
import { Cell, ParsedTransaction, ParseResult, normStr, parseDateToDDMMYYYY, buildGrid, getCell, maxRow, maxCol } from './shared.js';

const DATE_RE = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})/;

function looksLikeDate(s: string): boolean {
    return DATE_RE.test(s);
}

function looksLikeAmount(s: string): boolean {
    return /^\s*[-+]?[\d,]+\.?\d{0,2}\s*$/.test(s.replace(/[£$€]/g, ''));
}

export function parse(cells: Cell[]): ParseResult {
    if (cells.length === 0) return { transactions: [] };

    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const cols = maxCol(cells);

    // Detect column assignments from header row (row 0)
    let dateCol = -1, descCol = -1, inCol = -1, outCol = -1, balCol = -1, typeCol = -1;

    const headerRow = grid.get(0);
    if (headerRow) {
        for (const [c, v] of headerRow) {
            const lower = v.toLowerCase();
            if (dateCol < 0 && (lower.includes('date') || lower.includes('datum'))) dateCol = c;
            else if (descCol < 0 && (lower.includes('desc') || lower.includes('detail') || lower.includes('narrat') || lower.includes('memo') || lower.includes('explain'))) descCol = c;
            else if (typeCol < 0 && (lower.includes('type') || lower.includes('code') || lower.includes('ref'))) typeCol = c;
            else if (inCol < 0 && (lower.includes('in') || lower.includes('credit') || lower.includes('deposit') || lower.includes('paid in') || lower.includes('money in'))) inCol = c;
            else if (outCol < 0 && (lower.includes('out') || lower.includes('debit') || lower.includes('withdraw') || lower.includes('paid out') || lower.includes('money out'))) outCol = c;
            else if (balCol < 0 && lower.includes('bal')) balCol = c;
        }
    }

    // Fallback: guess by position if header not found
    if (dateCol < 0) dateCol = 0;
    if (descCol < 0) descCol = 1;

    const startRow = headerRow ? 1 : 0;
    const transactions: ParsedTransaction[] = [];

    for (let r = startRow; r <= rows; r++) {
        const rawDate = getCell(grid, r, dateCol);
        if (!rawDate || !looksLikeDate(rawDate)) continue;

        const date = parseDateToDDMMYYYY(rawDate);
        if (!date) continue;

        const type = typeCol >= 0 ? getCell(grid, r, typeCol) : '';
        const description = descCol >= 0 ? getCell(grid, r, descCol) : '';
        const moneyIn  = inCol >= 0 ? getCell(grid, r, inCol).replace(/,/g, '') : '';
        const moneyOut = outCol >= 0 ? getCell(grid, r, outCol).replace(/,/g, '') : '';
        const balance  = balCol >= 0 ? getCell(grid, r, balCol).replace(/,/g, '') : '';

        // Skip rows with no amount data
        if (!moneyIn && !moneyOut && !balance) continue;

        transactions.push({ date, type, description, moneyIn, moneyOut, balance });
    }

    return { transactions };
}
