import {
    Cell, ParsedTransaction, ParseResult,
    normStr, parseMoney, formatMoney, buildGrid,
    extractYearsFromCells
} from './shared.js';

interface ColLayout {
    date: number;
    desc: number;
    moneyIn: number;
    moneyOut: number;
    balance: number;
    amount: number;
}

const MONTH_MAP: Record<string, number> = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

interface DateParts {
    day: number;
    month: number;
    year: number | null;
    explicitYear: boolean;
}

function extractDateParts(val: string): DateParts | null {
    const s = normStr(val);
    if (!s) return null;

    // DD/MM/YYYY or DD-MM-YYYY
    let m = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (m) return { day: +m[1], month: +m[2], year: +m[3], explicitYear: true };

    // D Mon YYYY or D Mon (no year)
    m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?\b/i);
    if (m) {
        return {
            day: +m[1],
            month: MONTH_MAP[m[2].slice(0, 3).toLowerCase()],
            year: m[3] ? +m[3] : null,
            explicitYear: !!m[3],
        };
    }

    return null;
}

function isHeaderRow(rowCells: Map<number, string>): boolean {
    const txt = [...rowCells.values()].join(' ').toLowerCase();
    return (
        txt.includes('date') &&
        txt.includes('description') &&
        txt.includes('balance') &&
        (txt.includes('money in') || txt.includes('money out') || txt.includes('credit') || txt.includes('debit'))
    );
}

function detectColumns(headerCells: Map<number, string>): ColLayout {
    const COL: ColLayout = { date: -1, desc: -1, moneyIn: -1, moneyOut: -1, balance: -1, amount: -1 };

    for (const [c, v] of headerCells) {
        const val = v.toLowerCase();
        if (val.includes('date')) COL.date = c;
        if (val.includes('description')) COL.desc = c;
        if (val.includes('money in')  || (val.includes('credit') && !val.includes('debit')))  COL.moneyIn  = c;
        if (val.includes('money out') || (val.includes('debit')  && !val.includes('credit'))) COL.moneyOut = c;
        if (val.includes('balance')) COL.balance = c;
    }

    // Both in/out map to same column (merged header) → single amount column
    if (COL.moneyIn !== -1 && COL.moneyIn === COL.moneyOut) {
        COL.amount = COL.moneyIn;
        COL.moneyIn = -1;
        COL.moneyOut = -1;
    }

    // Misdetection guard: date=0, desc=1, moneyIn=1, moneyOut=2, balance=3 → amount=2
    if (COL.date === 0 && COL.desc === 1 && COL.moneyIn === 1 && COL.moneyOut === 2 && COL.balance === 3) {
        COL.moneyIn = -1;
        COL.moneyOut = -1;
        COL.amount = 2;
    }

    // Only moneyOut detected → single amount column
    if (COL.amount === -1 && COL.moneyIn === -1 && COL.moneyOut >= 0 && COL.balance >= 0) {
        COL.amount = COL.moneyOut;
        COL.moneyOut = -1;
    }

    if (COL.date    === -1) COL.date    = 0;
    if (COL.desc    === -1) COL.desc    = 1;
    if (COL.balance === -1) COL.balance = 3;
    if (COL.amount === -1 && COL.moneyIn === -1 && COL.moneyOut === -1) COL.amount = 2;

    return COL;
}

function isAmountOnly(val: string): boolean {
    return /^£?\s*-?\d[\d,]*\.?\d{0,2}$/.test(val);
}

function isStatementBalanceRow(desc: string): boolean {
    const d = desc.toLowerCase();
    return (
        d.includes('previous statement balance') ||
        d.includes('current statement balance')  ||
        d.includes('balance brought forward')    ||
        d.includes('balance carried forward')
    );
}

function looksLikeMoneyIn(desc: string): boolean {
    const d = desc.toLowerCase();
    return (
        d.includes('receipt')               ||
        d.includes('received')              ||
        d.includes('credit')                ||
        d.includes('incoming')              ||
        d.includes('faster payments receipt') ||
        d.includes('salary')                ||
        d.includes('payment from')          ||
        d.includes('transfer from')         ||
        d.includes('bank giro credit')      ||
        d.includes('credit from')
    );
}

function classifyAmount(
    amount: number,
    balance: number | null,
    prevBalance: number | null,
    desc: string,
    direction: 'oldest_first' | 'newest_first',
): { moneyIn: string; moneyOut: string } {
    if (prevBalance !== null && balance !== null) {
        const expIn  = +(prevBalance + amount).toFixed(2);
        const expOut = +(prevBalance - amount).toFixed(2);
        const actual = +balance.toFixed(2);

        if (direction === 'oldest_first') {
            if (Math.abs(actual - expIn)  < 0.02) return { moneyIn: formatMoney(amount), moneyOut: '' };
            if (Math.abs(actual - expOut) < 0.02) return { moneyIn: '', moneyOut: formatMoney(amount) };
        } else {
            // newest_first: rows go backwards in time, so prevBalance is from the row processed just before (which is chronologically LATER)
            if (Math.abs(actual - expIn)  < 0.02) return { moneyIn: '', moneyOut: formatMoney(amount) };
            if (Math.abs(actual - expOut) < 0.02) return { moneyIn: formatMoney(amount), moneyOut: '' };
        }
    }

    return looksLikeMoneyIn(desc)
        ? { moneyIn: formatMoney(amount), moneyOut: '' }
        : { moneyIn: '', moneyOut: formatMoney(amount) };
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const sortedRows = [...grid.keys()].filter(r => r >= 0).sort((a, b) => a - b);

    const years = extractYearsFromCells(cells);
    const defaultYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();

    // Pass 1: assign years per row and collect ordered date keys for direction detection
    const rowYears  = new Map<number, number>();
    let currentYear = defaultYear;
    let prevMonth: number | null = null;
    let COL: ColLayout | null = null;
    const dateKeys: number[] = [];

    for (const r of sortedRows) {
        const row = grid.get(r)!;
        if (isHeaderRow(row)) { COL = detectColumns(row); continue; }
        if (!COL) COL = { date: 0, desc: 1, moneyIn: -1, moneyOut: -1, balance: 3, amount: 2 };

        const parts = extractDateParts(row.get(COL.date) ?? '');
        if (!parts) continue;

        if (parts.explicitYear && parts.year) {
            currentYear = parts.year;
        } else if (prevMonth !== null) {
            if (prevMonth === 12 && parts.month === 1) currentYear += 1;
            else if (prevMonth === 1 && parts.month === 12) currentYear -= 1;
        }

        rowYears.set(r, currentYear);
        prevMonth = parts.month;
        dateKeys.push(currentYear * 10000 + parts.month * 100 + parts.day);
    }

    const direction: 'oldest_first' | 'newest_first' =
        dateKeys.length >= 2 && dateKeys[0] > dateKeys[dateKeys.length - 1]
            ? 'newest_first'
            : 'oldest_first';

    // Pass 2: build transactions
    const transactions: ParsedTransaction[] = [];
    let current: ParsedTransaction | null = null;
    let prevBalance: number | null = null;
    COL = null;

    function flush() {
        if (!current) return;
        if ((!current.moneyIn && !current.moneyOut) || isStatementBalanceRow(current.description)) {
            current = null;
            return;
        }
        transactions.push(current);
        const b = parseMoney(current.balance);
        if (b !== null) prevBalance = Math.abs(b);
        current = null;
    }

    for (const r of sortedRows) {
        const row = grid.get(r)!;

        if (isHeaderRow(row)) {
            flush();
            COL = detectColumns(row);
            continue;
        }

        if (!COL) COL = { date: 0, desc: 1, moneyIn: -1, moneyOut: -1, balance: 3, amount: 2 };

        const dateCell = normStr(row.get(COL.date)    ?? '');
        const descCell = normStr(row.get(COL.desc)    ?? '');
        const balCell  = normStr(row.get(COL.balance) ?? '');

        const balanceVal = parseMoney(balCell);
        const balanceAbs = balanceVal !== null ? Math.abs(balanceVal) : null;
        const balStr     = balanceAbs !== null ? formatMoney(balanceAbs) : '';

        const parts = extractDateParts(dateCell);

        if (parts) {
            flush();

            const year = (parts.explicitYear && parts.year) ? parts.year : (rowYears.get(r) ?? defaultYear);
            const date = `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${year}`;

            const descIsAmountOnly = isAmountOnly(descCell);
            const moneyInRaw  = COL.moneyIn  >= 0 ? parseMoney(normStr(row.get(COL.moneyIn)  ?? '')) : null;
            const moneyOutRaw = COL.moneyOut >= 0 ? parseMoney(normStr(row.get(COL.moneyOut) ?? '')) : null;
            const amountRaw   = COL.amount   >= 0 ? parseMoney(normStr(row.get(COL.amount)   ?? '')) : null;

            let moneyIn  = '';
            let moneyOut = '';

            if (descIsAmountOnly && moneyInRaw === null && moneyOutRaw === null && balanceAbs !== null) {
                // "Missing description" variant: desc cell contains only an amount → treat as moneyIn
                const descAmt = parseMoney(descCell);
                moneyIn = descAmt !== null ? formatMoney(Math.abs(descAmt)) : '';
            } else if (moneyInRaw !== null || moneyOutRaw !== null) {
                moneyIn  = moneyInRaw  !== null ? formatMoney(Math.abs(moneyInRaw))  : '';
                moneyOut = moneyOutRaw !== null ? formatMoney(Math.abs(moneyOutRaw)) : '';
            } else {
                const amt = amountRaw !== null ? Math.abs(amountRaw) : null;
                if (amt !== null) {
                    const c = classifyAmount(amt, balanceAbs, prevBalance, descCell, direction);
                    moneyIn  = c.moneyIn;
                    moneyOut = c.moneyOut;
                }
            }

            current = {
                date,
                type: '',
                description: descIsAmountOnly ? '' : descCell,
                moneyIn,
                moneyOut,
                balance: balStr,
            };
            continue;
        }

        // Continuation row (no date) — append non-money cells to previous transaction's description
        if (current) {
            const moneyCols = new Set(
                [COL.moneyIn, COL.moneyOut, COL.amount, COL.balance].filter(c => c >= 0)
            );
            const extraParts: string[] = [];
            for (const [c, v] of row) {
                if (!moneyCols.has(c) && v) extraParts.push(v);
            }
            const extra = normStr(extraParts.join(' '));
            if (extra) current.description = normStr(`${current.description} ${extra}`);
            if (!current.balance && balanceAbs !== null) current.balance = formatMoney(balanceAbs);
        }
    }

    flush();
    return { transactions };
}
