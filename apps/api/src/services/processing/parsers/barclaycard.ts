// BarclayCard credit card statement parser
//
// Azure DI layout (3–4 columns, varies per row):
//   4-col:  [date | desc          | icon  | £amount]
//   3-col:  [date | desc          | icon_or_£amount_with_icon  ]   (icon merged with amount)
//   3-col:  [date+desc merged     | ''    | icon_or_£amount_with_icon]
//
// All transactions are card purchases (moneyOut) except "Payment, Thank You" rows (moneyIn).
// No running balance column — balance field is left empty.
// Date format: "DD Mon" (no year) — year extracted from document content.
import {
    Cell, ParsedTransaction, ParseResult,
    normStr, parseMoney, formatMoney,
    buildGrid, getCell, maxRow, maxCol,
} from './shared.js';

const MONTH_MAP: Record<string, number> = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function parseDatePrefix(s: string, year: number): { date: string; rest: string } | null {
    const m = s.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
    if (!m) return null;
    const mon = MONTH_MAP[m[2].toLowerCase()];
    if (!mon) return null;
    return {
        date: `${m[1].padStart(2,'0')}/${String(mon).padStart(2,'0')}/${year}`,
        rest: s.slice(m[0].length).trim(),
    };
}

// Extract first £-prefixed amount from cells that may contain "e £8.95" or ")) £10.95"
function extractAmount(s: string): number | null {
    const m = normStr(s).match(/£\s*([\d,]+(?:\.\d{1,2})?)/);
    return m ? parseMoney('£' + m[1]) : null;
}

export function parse(cells: Cell[]): ParseResult {
    const grid = buildGrid(cells);
    const rows = maxRow(cells);
    const cols = maxCol(cells);
    const transactions: ParsedTransaction[] = [];

    // Year from combined content (row -1)
    const content = normStr(getCell(grid, -1, -1));
    const yearMatch = content.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

    for (let r = 0; r <= rows; r++) {
        if (!grid.has(r)) continue;
        const row: string[] = [];
        for (let c = 0; c <= cols; c++) row.push(normStr(getCell(grid, r, c)));

        const parsed = parseDatePrefix(row[0], year);
        if (!parsed) continue;

        const { date, rest } = parsed;

        // Description: rest of col0 (date+desc merged) or col1 (date alone in col0)
        const desc = rest || normStr(row[1]);
        if (!desc) continue;

        // Amount: scan right-to-left for first parseable £ value
        let amtNum: number | null = null;
        for (let c = cols; c >= 0; c--) {
            const v = normStr(row[c]);
            if (!v) continue;
            amtNum = extractAmount(v);
            if (amtNum !== null && amtNum > 0) break;
        }
        if (amtNum === null || amtNum <= 0) continue;

        const isPayment = /payment/i.test(desc);

        transactions.push({
            date,
            type: isPayment ? 'PAY' : 'CAR',
            description: desc,
            moneyIn:  isPayment ? formatMoney(amtNum) : '',
            moneyOut: isPayment ? '' : formatMoney(amtNum),
            balance:  '',
        });
    }

    return { transactions };
}
