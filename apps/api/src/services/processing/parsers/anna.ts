// ANNA Money parser
// Column layout (7 columns): c0=ProcessedDate, c1=CreatedDate, c2=Type, c3=Description,
//                             c4=PaidOut, c5=PaidIn, c6=Balance
// Header row: c0="Processed on" (repeats on every page)
// Page-1 summary rows: c0 in {"Closing balance","Payments in","Payments out"}
import {
    Cell, ParseResult,
    normStr, parseMoney as parseMoneyVal, formatMoney, parseDateToDDMMYYYY,
    buildGrid, getCell, maxRow,
} from './shared.js';

export function parse(cells: Cell[]): ParseResult {
    const grid  = buildGrid(cells);
    const rows  = maxRow(cells);

    let statementIn:     number | undefined;
    let statementOut:    number | undefined;
    let closingBalance:  number | undefined;

    const transactions = [];

    for (let r = 0; r <= rows; r++) {
        const c0 = (getCell(grid, r, 0) || '').trim();
        const c1 = (getCell(grid, r, 1) || '').trim();

        if (c0 === 'Processed on') continue;

        if (c0 === 'Payments in')     { statementIn  = parseMoneyVal(c1) ?? undefined; continue; }
        if (c0 === 'Payments out')    { statementOut  = parseMoneyVal(c1) ?? undefined; continue; }
        if (c0 === 'Closing balance') { closingBalance = parseMoneyVal(c1) ?? undefined; continue; }

        const date = parseDateToDDMMYYYY(c0);
        if (!date) continue;

        const type    = normStr(getCell(grid, r, 2));
        const desc    = normStr(getCell(grid, r, 3));
        const outAmt  = parseMoneyVal(getCell(grid, r, 4));
        const inAmt   = parseMoneyVal(getCell(grid, r, 5));
        const balAmt  = parseMoneyVal(getCell(grid, r, 6));

        const moneyOut = outAmt != null && outAmt > 0 ? formatMoney(outAmt) : '';
        const moneyIn  = inAmt  != null && inAmt  > 0 ? formatMoney(inAmt)  : '';
        const balance  = balAmt !== null ? formatMoney(balAmt) : '';

        if (!moneyOut && !moneyIn) continue;

        transactions.push({ date, type, description: desc, moneyIn, moneyOut, balance });
    }

    let statementTotals: ParseResult['statementTotals'];
    if (statementIn !== undefined || statementOut !== undefined) {
        const opening =
            closingBalance !== undefined &&
            statementIn    !== undefined &&
            statementOut   !== undefined
                ? Math.round((closingBalance - statementIn + statementOut) * 100) / 100
                : undefined;
        statementTotals = {
            moneyIn:        statementIn  ?? 0,
            moneyOut:       statementOut ?? 0,
            openingBalance: opening,
            closingBalance,
        };
    }

    return { transactions, statementTotals };
}
