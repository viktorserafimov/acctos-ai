// NatWest parser - 5-col and 7-col layouts with auto-detection
// Adapted from Make scenario 1.5.4, modules 1326 + 1333
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow } from './shared.js';

function isOD(s: string): boolean {
    return /\bOD\b/i.test(s);
}

function cleanBalance(s: string): string {
    const n = s.replace(/[£$€,\s]/g, '').replace(/\bOD\b/i, '').trim();
    if (!n) return '';
    const val = parseFloat(n);
    if (!isFinite(val)) return s;
    return isOD(s) ? String(-Math.abs(val)) : String(Math.abs(val));
}

function detectNatWestCols(header: Map<number, string>): { dateCol:number, descCol:number, outCol:number, inCol:number, balCol:number } {
    let dateCol = 0, descCol = 1, outCol = 2, inCol = 3, balCol = 4;
    for (const [c, v] of header) {
        const lower = v.toLowerCase();
        if (lower.includes('date'))                                dateCol = c;
        else if (lower.includes('detail') || lower.includes('desc') || lower.includes('narrat')) descCol = c;
        else if (lower.includes('withdrawn') || lower.includes('out') || lower.includes('debit'))  outCol = c;
        else if (lower.includes('paid in') || lower.includes('in') || lower.includes('credit'))    inCol = c;
        else if (lower.includes('bal'))                            balCol = c;
    }
    return { dateCol, descCol, outCol, inCol, balCol };
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    const header = grid.get(0);
    const cols = header
        ? detectNatWestCols(header)
        : { dateCol:0, descCol:1, outCol:2, inCol:3, balCol:4 };

    const startRow = header ? 1 : 0;

    for (let r = startRow; r <= rows; r++) {
        const rawDate = getCell(grid, r, cols.dateCol);
        const date = parseDateToDDMMYYYY(rawDate);
        if (!date) continue;

        const description = getCell(grid, r, cols.descCol);
        const rawOut = getCell(grid, r, cols.outCol).replace(/[£$€,]/g, '').trim();
        const rawIn  = getCell(grid, r, cols.inCol).replace(/[£$€,]/g, '').trim();
        const rawBal = getCell(grid, r, cols.balCol);

        if (!rawOut && !rawIn) continue;

        transactions.push({
            date,
            type: '',
            description,
            moneyIn:  rawIn,
            moneyOut: rawOut,
            balance:  cleanBalance(rawBal),
        });
    }

    return { transactions };
}
