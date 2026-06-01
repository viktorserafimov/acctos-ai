import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CategorizedTransaction } from './AssistantCategorizer.js';
import { ExcelTransaction } from './ExcelParser.js';
import { VerificationSummary } from './Verification.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, 'template-bank-statement.xlsx');

// Category column keys → Excel columns E–P (1-based: 5–16)
const CAT_COLS: (keyof CategorizedTransaction)[] = [
    'SALARY', 'OTHER', 'INSURANCE', 'LOAN', 'CASH',
    'TRAVEL', 'PHONE', 'CHARGES', 'Bank_Transfer', 'HMRC', 'RENT', 'BILLS',
];

const YELLOW_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const GRAY_FILL:   ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
const BLUE_FILL:   ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
const GREEN_FILL:  ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
const ORANGE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
const MONEY_FMT = '#,##0.00';
const TOTAL_COLS = 17;

function addVerificationRows(ws: ExcelJS.Worksheet, startRow: number, v: VerificationSummary): void {
    let r = startRow;

    const fillRow = (row: ExcelJS.Row, fill: ExcelJS.Fill) => {
        for (let c = 1; c <= TOTAL_COLS; c++) row.getCell(c).fill = fill;
        row.getCell(4).fill = YELLOW_FILL;
    };

    const dataRow = (label: string, inVal?: number | null, outVal?: number | null) => {
        const row = ws.getRow(r++);
        row.getCell(4).fill = YELLOW_FILL;
        row.getCell(2).value = label;
        if (inVal != null) {
            const cell = row.getCell(3);
            cell.value = inVal;
            cell.numFmt = MONEY_FMT;
        }
        if (outVal != null) {
            const cell = row.getCell(TOTAL_COLS);
            cell.value = outVal;
            cell.numFmt = MONEY_FMT;
        }
        row.commit();
    };

    const statusRow = (label: string, ok: boolean) => {
        const row = ws.getRow(r++);
        fillRow(row, ok ? GREEN_FILL : ORANGE_FILL);
        const cell = row.getCell(2);
        cell.value = label;
        cell.font = { bold: true };
        row.commit();
    };

    // Separator + title
    const sep = ws.getRow(r++);
    fillRow(sep, GRAY_FILL);
    sep.commit();

    const title = ws.getRow(r++);
    fillRow(title, BLUE_FILL);
    const tc = title.getCell(2);
    tc.value = 'VERIFICATION SUMMARY';
    tc.font = { bold: true };
    title.commit();

    // Balance section
    if (v.openingBalance != null) dataRow('Opening balance', null, v.openingBalance);
    dataRow('Total money in',  v.totalIn);
    dataRow('Total money out', null, v.totalOut);
    if (v.closingBalance != null) dataRow('Closing balance', null, v.closingBalance);

    const balLabel = v.balanceOk
        ? '✓ Balance check OK'
        : `⚠ Balance mismatch — diff: ${v.balanceDiff != null ? (v.balanceDiff >= 0 ? '+' : '') + v.balanceDiff.toFixed(2) : 'unknown'}`;
    statusRow(balLabel, v.balanceOk);

    // Declared totals section (Pockit)
    if (v.declaredIn != null && v.declaredOut != null) {
        const sep2 = ws.getRow(r++);
        sep2.getCell(4).fill = YELLOW_FILL;
        sep2.commit();

        dataRow('Declared in (by bank)',  v.declaredIn);
        dataRow('Declared out (by bank)', null, v.declaredOut);

        const declLabel = v.declaredOk
            ? '✓ Declared totals match'
            : `⚠ Declared totals mismatch — In diff: ${(v.totalIn - v.declaredIn).toFixed(2)}, Out diff: ${(v.totalOut - v.declaredOut).toFixed(2)}`;
        statusRow(declLabel, v.declaredOk ?? false);
    }
}

/** "DD/MM/YYYY" → Date (UTC) */
function parseDate(ddmmyyyy: string): Date | null {
    if (!ddmmyyyy) return null;
    const p = ddmmyyyy.split('/');
    if (p.length !== 3) return null;
    const [dd, mm, yyyy] = p.map(Number);
    if (!yyyy || !mm || !dd) return null;
    return new Date(Date.UTC(yyyy, mm - 1, dd));
}

/** String/number → parsed float, or null if empty/zero */
function toNum(v: unknown): number | null {
    const s = String(v ?? '').replace(/,/g, '').trim();
    if (!s) return null;
    const n = parseFloat(s);
    return isFinite(n) && n !== 0 ? n : null;
}

export async function buildPdfOutputExcel(transactions: CategorizedTransaction[], verification?: VerificationSummary): Promise<Buffer> {
    const templateBuf = readFileSync(TEMPLATE_PATH);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuf as unknown as ArrayBuffer);

    const ws = workbook.worksheets[0];

    // Apply yellow to column D (col 4) in header rows before clearing data
    for (let r = 1; r <= 2; r++) {
        ws.getRow(r).getCell(4).fill = YELLOW_FILL;
    }

    // Remove all data rows (row 3 onwards)
    const totalRows = ws.rowCount;
    if (totalRows > 2) {
        ws.spliceRows(3, totalRows - 2);
    }

    // Write transactions starting at row 3
    transactions.forEach((t, ri) => {
        const row = ws.getRow(ri + 3);

        const date = parseDate(String(t.DATE ?? ''));
        if (date !== null) {
            const cell = row.getCell(1);
            cell.value = date;
            cell.numFmt = 'dd/MM/yyyy';
        }

        const name = String(t['Type and Description'] ?? '').trim();
        if (name) row.getCell(2).value = name;

        const income = toNum(t.INCOME);
        if (income !== null) {
            const cell = row.getCell(3);
            cell.value = income;
            cell.numFmt = '#,##0.00';
        }

        // Column D (col 4) — always yellow, no data
        row.getCell(4).fill = YELLOW_FILL;

        CAT_COLS.forEach((col, i) => {
            const val = toNum((t as any)[col]);
            if (val !== null) {
                const cell = row.getCell(5 + i);
                cell.value = val;
                cell.numFmt = '#,##0.00';
            }
        });

        const balance = toNum(t.Balance);
        if (balance !== null) {
            const cell = row.getCell(17);
            cell.value = balance;
            cell.numFmt = '#,##0.00';
        }

        row.commit();
    });

    // Append verification summary if provided
    const lastDataRow = transactions.length + 2;
    if (verification) {
        addVerificationRows(ws, lastDataRow + 1, verification);
    }

    // Fill column D yellow for all remaining rows up to 1000
    const summaryRowCount = verification
        ? 7 + (verification.declaredIn != null ? 4 : 0)
        : 0;
    const fillStart = lastDataRow + 1 + summaryRowCount;
    for (let r = fillStart; r <= 1000; r++) {
        const row = ws.getRow(r);
        row.getCell(4).fill = YELLOW_FILL;
        row.commit();
    }

    // Freeze first 2 rows
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3' }];

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}

export function buildExcelOutputExcel(transactions: ExcelTransaction[]): Buffer {
    const EXCEL_HEADERS = ['Date', 'Type', 'Type and Description', 'Money in', 'Money out', 'Balance'];

    const rows = transactions.map(t => [
        t.Date,
        t.Type,
        t['Type and Description'],
        t['Money in'],
        t['Money out'],
        t.Balance,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
