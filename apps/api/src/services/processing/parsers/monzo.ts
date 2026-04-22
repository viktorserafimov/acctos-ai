// Monzo parser - handles pendingFromPrev for cross-page transaction stitching
// Adapted from Make scenario 1.2.3, module id 1190
import { Cell, ParsedTransaction, ParseResult, normStr, parseDateToDDMMYYYY, buildGrid, getCell, maxRow } from './shared.js';

const DATE_RE = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/;

export function parse(cells: Cell[], options: { pendingFromPrev?: ParsedTransaction | null } = {}): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    // Detect column layout: DATE | TYPE | DESCRIPTION | MONEY_IN | MONEY_OUT | BALANCE
    // Monzo uses DD/MM/YYYY date format
    let dateCol = 0, typeCol = 1, descCol = 2, inCol = 3, outCol = 4, balCol = 5;

    // Check header row
    const header = grid.get(0);
    if (header) {
        for (const [c, v] of header) {
            const lower = v.toLowerCase();
            if (lower.includes('date')) dateCol = c;
            else if (lower.includes('type') || lower.includes('kind')) typeCol = c;
            else if (lower.includes('desc') || lower.includes('narrat')) descCol = c;
            else if ((lower.includes('in') || lower.includes('credit')) && !lower.includes('desc')) inCol = c;
            else if ((lower.includes('out') || lower.includes('debit')) && !lower.includes('desc')) outCol = c;
            else if (lower.includes('bal')) balCol = c;
        }
    }

    const startRow = header ? 1 : 0;
    let pendingRow = options.pendingFromPrev ?? null;

    for (let r = startRow; r <= rows; r++) {
        const rawDate = getCell(grid, r, dateCol);
        const date = parseDateToDDMMYYYY(rawDate);

        if (!date) {
            // Continuation line - append to pending
            if (pendingRow) {
                const extra = getCell(grid, r, descCol);
                if (extra) pendingRow.description = `${pendingRow.description} ${extra}`.trim();
            }
            continue;
        }

        // Commit pending row if we have one
        if (pendingRow) {
            transactions.push(pendingRow);
            pendingRow = null;
        }

        const type = getCell(grid, r, typeCol);
        const description = getCell(grid, r, descCol);
        const moneyIn  = getCell(grid, r, inCol).replace(/,/g, '');
        const moneyOut = getCell(grid, r, outCol).replace(/,/g, '');
        const balance  = getCell(grid, r, balCol).replace(/,/g, '');

        if (!moneyIn && !moneyOut) continue;

        pendingRow = { date, type, description, moneyIn, moneyOut, balance };
    }

    // Don't commit the last pending row yet — it may continue on next page
    return { transactions, pendingRow };
}
