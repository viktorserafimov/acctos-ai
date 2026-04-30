// Barclays parser - auto-detects money in/out from header, handles signed values
// Adapted from Make scenarios, modules 1341 + 1376
import { Cell, ParsedTransaction, ParseResult, parseDateToDDMMYYYY, buildGrid, getCell, maxRow, extractYearsFromCells, extractStatementPeriod, inferYearFromPeriod } from './shared.js';

const MONTH_ABBR: Record<string, number> = {
    jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
};

function fixOCRDate(s: string): string {
    return s.replace(/(\d{2}\/\d{2})\s+(\/\d{4})/, '$1$2').replace(/\s*\/\s*/g, '/');
}

/** Extract 3-letter month number from a raw date string like "6 Dec" or "6 Dec 2025". */
function monthFromRaw(raw: string): number | null {
    const m = raw.match(/\b([A-Za-z]{3,})\b/);
    if (!m) return null;
    return MONTH_ABBR[m[1].slice(0, 3).toLowerCase()] ?? null;
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

    // Prefer explicit period range ("06 Dec 2025 - 05 Jan 2026") for year inference.
    // Fall back to year-rollover tracking when the period header isn't present.
    const period = extractStatementPeriod(cells);
    const availableYears = extractYearsFromCells(cells);
    let fallbackYear = availableYears[0] ?? new Date().getFullYear();
    let prevMonth = -1;

    const startRow = header ? 1 : 0;

    for (let r = startRow; r <= rows; r++) {
        let rawDate = getCell(grid, r, dateCol);
        rawDate = fixOCRDate(rawDate);
        if (!rawDate) continue;

        const currMonth = monthFromRaw(rawDate);
        let yearForRow = fallbackYear;

        if (period && currMonth !== null) {
            const dayMatch = rawDate.match(/^(\d{1,2})/);
            if (dayMatch) {
                const inferred = inferYearFromPeriod(Number(dayMatch[1]), currMonth, period);
                if (inferred !== null) yearForRow = inferred;
            }
        } else if (currMonth !== null && prevMonth > 0 && currMonth < prevMonth && prevMonth >= 11) {
            // Fallback: advance year when month resets (Dec → Jan)
            const nextYear = availableYears.find(y => y > fallbackYear);
            if (nextYear) { fallbackYear = nextYear; yearForRow = nextYear; }
        }

        if (currMonth !== null) prevMonth = currMonth;

        const date = parseDateToDDMMYYYY(rawDate, yearForRow);
        if (!date) continue;

        // Skip summary rows
        const rawDesc = getCell(grid, r, descCol);
        if (/start\s+balance|balance\s+(brought|carried)/i.test(rawDesc)) continue;

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
            description: rawDesc,
            moneyIn:  rawIn,
            moneyOut: rawOut,
            balance:  rawBal,
        });
    }

    return { transactions };
}
