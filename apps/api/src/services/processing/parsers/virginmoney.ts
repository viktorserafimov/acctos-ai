// Virgin Money parser
// Layout: date | description | type | debit | credit | balance  (6-col normal)
//      or date | description | type | amount | balance           (5-col compact)
// Date: "DD MMM YY" or "DD MMM YYYY" — may have trailing ▼
// Balance may carry OD/DR suffix (overdraft) or explicit negative sign
import {
    Cell, ParsedTransaction, ParseResult,
    normStr, parseMoney, formatMoney, buildGrid, getCell, maxRow, maxCol,
} from './shared.js';

const MONTH_MAP: Record<string, number> = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function parseDate(raw: string): string {
    const s = normStr(raw).replace(/[▼►▲]/g, '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})$/);
    if (!m) return '';
    const day = Number(m[1]);
    const mon = MONTH_MAP[m[2].toLowerCase()];
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (!mon || day < 1 || day > 31) return '';
    return `${String(day).padStart(2,'0')}/${String(mon).padStart(2,'0')}/${year}`;
}

function isHeaderRow(cols: string[]): boolean {
    const joined = cols.join(' ').toLowerCase();
    return (
        joined.includes('date') &&
        joined.includes('description') &&
        joined.includes('debit') &&
        joined.includes('credit') &&
        joined.includes('balance')
    );
}

function signedBal(raw: string): string {
    const isOD = /\b(OD|DR)\b/i.test(raw);
    const n = parseMoney(raw);
    if (n === null) return '';
    const abs = formatMoney(Math.abs(n));
    return isOD && Math.abs(n) > 0 ? '-' + abs : abs;
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const cols = maxCol(cells);

    const table: { rowIndex: number; cols: string[] }[] = [];
    for (let r = 0; r <= rows; r++) {
        if (!grid.has(r)) continue;
        const row: string[] = [];
        for (let c = 0; c <= cols; c++) {
            row.push(normStr(getCell(grid, r, c)));
        }
        table.push({ rowIndex: r, cols: row });
    }

    if (!table.length) return { transactions: [] };

    let startAt = 0;
    for (let i = 0; i < table.length; i++) {
        if (isHeaderRow(table[i].cols)) {
            startAt = i + 1;
            break;
        }
    }

    const transactions: ParsedTransaction[] = [];
    let lastDate = '';

    for (let i = startAt; i < table.length; i++) {
        const c = table[i].cols;
        if (c.every(v => !normStr(v))) continue;
        if (isHeaderRow(c)) continue;

        const parsedDate = parseDate(c[0]);
        if (parsedDate) lastDate = parsedDate;
        const date = parsedDate || lastDate;
        if (!date) continue;

        const desc = normStr(c[1]);
        if (!desc) continue;

        const type = normStr(c[2]);

        const col3Raw = normStr(c[3] ?? '');
        const col4Raw = normStr(c[4] ?? '');
        const col5Raw = normStr(c[5] ?? '');

        const col3Amt = parseMoney(col3Raw);
        const col4Amt = parseMoney(col4Raw);
        const col5Amt = parseMoney(col5Raw);

        let moneyIn  = '';
        let moneyOut = '';
        let balance  = '';

        if (col5Raw) {
            // Normal 6-col: col3=debit, col4=credit, col5=balance
            if (col4Amt !== null && col4Amt > 0) {
                moneyIn = formatMoney(col4Amt);
            } else if (col3Amt !== null && col3Amt > 0) {
                moneyOut = formatMoney(col3Amt);
            } else {
                continue;
            }
            balance = signedBal(col5Raw);
        } else if (col4Raw && col3Amt !== null && col3Amt > 0) {
            // Compact 5-col: col3=amount, col4=balance — direction from balance delta
            balance = signedBal(col4Raw);
            const curBal = col4Amt;
            const prevTx = transactions.length > 0 ? transactions[transactions.length - 1] : null;
            const prevBal = prevTx ? parseMoney(prevTx.balance) : null;

            if (curBal !== null && prevBal !== null) {
                const delta = curBal - prevBal;
                if (Math.abs(delta - col3Amt) <= 0.01)       moneyIn  = formatMoney(col3Amt);
                else if (Math.abs(delta + col3Amt) <= 0.01)  moneyOut = formatMoney(col3Amt);
                else                                          moneyOut = formatMoney(col3Amt);
            } else {
                moneyOut = formatMoney(col3Amt);
            }
        } else {
            continue;
        }

        if (!moneyIn && !moneyOut) continue;

        transactions.push({ date, type, description: desc, moneyIn, moneyOut, balance });
    }

    return { transactions };
}
