// Starling Bank parser - 5-col and 6-col variants
// Adapted from Make scenario 1.5.3, module id 1174
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow } from './shared.js';

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const transactions: ParsedTransaction[] = [];

    // Detect column layout from header
    // 6-col: DATE | TYPE | TRANSACTION | IN | OUT | BALANCE
    // 5-col: DATE | TYPE | TRANSACTION | AMOUNT | (BALANCE)
    let dateCol = 0, typeCol = 1, descCol = 2, inCol = -1, outCol = -1, amountCol = -1, balCol = -1;

    const header = grid.get(0);
    if (header) {
        for (const [c, v] of header) {
            const lower = v.toLowerCase();
            if (lower.includes('date')) dateCol = c;
            else if (lower.includes('type') || lower.includes('kind')) typeCol = c;
            else if (lower.includes('transaction') || lower.includes('desc') || lower.includes('narrat')) descCol = c;
            else if ((lower.includes('in') || lower.includes('credit')) && !lower.includes('bal')) inCol = c;
            else if ((lower.includes('out') || lower.includes('debit')) && !lower.includes('bal')) outCol = c;
            else if (lower.includes('amount') && !lower.includes('bal')) amountCol = c;
            else if (lower.includes('bal')) balCol = c;
        }
    }

    const is6col = inCol >= 0 && outCol >= 0;
    const startRow = header ? 1 : 0;

    for (let r = startRow; r <= rows; r++) {
        const rawDate = getCell(grid, r, dateCol);
        const date = parseDateToDDMMYYYY(rawDate);
        if (!date) continue;

        const type = getCell(grid, r, typeCol);
        const description = getCell(grid, r, descCol);
        const balance = balCol >= 0 ? getCell(grid, r, balCol).replace(/,/g, '') : '';

        let moneyIn = '', moneyOut = '';

        if (is6col) {
            moneyIn  = getCell(grid, r, inCol).replace(/,/g, '').replace(/[£$€]/g, '');
            moneyOut = getCell(grid, r, outCol).replace(/,/g, '').replace(/[£$€]/g, '');
        } else if (amountCol >= 0) {
            const raw = getCell(grid, r, amountCol).replace(/[£$€\s]/g, '').replace(/,/g, '');
            if (raw.startsWith('-')) moneyOut = raw.replace('-', '');
            else if (raw) moneyIn = raw;
        }

        if (!moneyIn && !moneyOut) continue;

        transactions.push({ date, type, description, moneyIn, moneyOut, balance });
    }

    return { transactions };
}
