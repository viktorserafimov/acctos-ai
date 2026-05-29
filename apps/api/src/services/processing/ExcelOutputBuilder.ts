import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CategorizedTransaction } from './AssistantCategorizer.js';
import { ExcelTransaction } from './ExcelParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, 'template-bank-statement.xlsx');

// Category column keys → Excel column indices 4–15 (E–P)
const CAT_COLS: (keyof CategorizedTransaction)[] = [
    'SALARY', 'OTHER', 'INSURANCE', 'LOAN', 'CASH',
    'TRAVEL', 'PHONE', 'CHARGES', 'Bank_Transfer', 'HMRC', 'RENT', 'BILLS',
];

/** "DD/MM/YYYY" → Excel serial number */
function toSerial(ddmmyyyy: string): number | null {
    if (!ddmmyyyy) return null;
    const p = ddmmyyyy.split('/');
    if (p.length !== 3) return null;
    const [dd, mm, yyyy] = p.map(Number);
    if (!yyyy || !mm || !dd) return null;
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return Math.floor((d.getTime() - epoch.getTime()) / 86400000);
}

/** String/number → parsed float, or null if empty/zero */
function toNum(v: unknown): number | null {
    const s = String(v ?? '').replace(/,/g, '').trim();
    if (!s) return null;
    const n = parseFloat(s);
    return isFinite(n) && n !== 0 ? n : null;
}

export async function buildPdfOutputExcel(transactions: CategorizedTransaction[]): Promise<Buffer> {
    const templateBuf = readFileSync(TEMPLATE_PATH);
    const wb = XLSX.read(templateBuf, { cellStyles: true, sheetStubs: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Read column formats from row-3 stubs before clearing
    const colFmts: Record<number, string> = {
        0: 'dd/MM/yyyy',
        2: '#,##0.00', 4: '#,##0.00', 5: '#,##0.00', 6: '#,##0.00',
        7: '#,##0.00', 8: '#,##0.00', 9: '#,##0.00', 10: '#,##0.00',
        11: '#,##0.00', 12: '#,##0.00', 13: '#,##0.00', 14: '#,##0.00',
        15: '#,##0.00', 16: '#,##0.00',
    };
    for (let c = 0; c <= 16; c++) {
        const addr = XLSX.utils.encode_cell({ r: 2, c });
        const z = (ws[addr] as any)?.z;
        if (z) colFmts[c] = z;
    }

    // Clear all data rows (row index ≥ 2 = Excel row 3+), preserving column D (yellow fill from template)
    const existingRef = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:Q2');
    for (let r = 2; r <= existingRef.e.r; r++) {
        for (let c = 0; c <= Math.max(existingRef.e.c, 16); c++) {
            if (c === 3) continue; // preserve column D yellow fill
            const addr = XLSX.utils.encode_cell({ r, c });
            if (ws[addr]) delete ws[addr];
        }
    }

    // Write transactions starting at row 3 (index 2)
    transactions.forEach((t, ri) => {
        const r = ri + 2;

        const serial = toSerial(String(t.DATE ?? ''));
        if (serial !== null) {
            (ws as any)[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 'n', v: serial, z: colFmts[0] };
        }

        const name = String(t['Type and Description'] ?? '').trim();
        if (name) {
            (ws as any)[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 's', v: name };
        }

        const income = toNum(t.INCOME);
        if (income !== null) {
            (ws as any)[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 'n', v: income, z: colFmts[2] };
        }

        CAT_COLS.forEach((col, i) => {
            const val = toNum((t as any)[col]);
            if (val !== null) {
                (ws as any)[XLSX.utils.encode_cell({ r, c: 4 + i })] = { t: 'n', v: val, z: colFmts[4 + i] };
            }
        });

        const balance = toNum(t.Balance);
        if (balance !== null) {
            (ws as any)[XLSX.utils.encode_cell({ r, c: 16 })] = { t: 'n', v: balance, z: colFmts[16] };
        }
    });

    // Update sheet range
    const lastRow = Math.max(1, transactions.length + 1);
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 16 } });

    const xlsxBuf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }));

    // xlsx package cannot write freeze panes or cell fills — inject via JSZip XML patch
    return injectXlsxFormatting(xlsxBuf, 2);
}

/** Post-process an xlsx buffer via JSZip to:
 *  1. Freeze the top `freezeRows` rows (xlsx 0.18.x cannot write sheetViews)
 *  2. Apply yellow fill to every data row in column D (xlsx drops cell styles on write)
 */
async function injectXlsxFormatting(buf: Buffer, freezeRows: number): Promise<Buffer> {
    const zip = await JSZip.loadAsync(buf);

    // ── styles.xml: add yellow fill + a cell xf referencing it ─────────────
    const stylesFile = zip.file('xl/styles.xml');
    if (stylesFile) {
        let sx = await stylesFile.async('string');

        // Append yellow fill and bump fills count
        sx = sx.replace(/<fills count="(\d+)">/, (_, n) => `<fills count="${+n + 1}">`);
        sx = sx.replace('</fills>',
            '<fill><patternFill patternType="solid">' +
            '<fgColor rgb="FFFFFF00"/><bgColor rgb="FFFFFF00"/>' +
            '</patternFill></fill></fills>');

        // yellow fill is now at fillId = (original fills count)  = 2 in a fresh output
        // Determine new xf index (= current count) before bumping
        const xfCountMatch = sx.match(/<cellXfs count="(\d+)"/);
        const yellowXfIdx = xfCountMatch ? +xfCountMatch[1] : 3;

        sx = sx.replace(/<cellXfs count="(\d+)"/, (_, n) => `<cellXfs count="${+n + 1}"`);
        sx = sx.replace('</cellXfs>',
            '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/></cellXfs>');

        zip.file('xl/styles.xml', sx);

        // ── sheet1.xml: freeze panes + yellow D cells ───────────────────────
        const sheetFile = zip.file('xl/worksheets/sheet1.xml');
        if (sheetFile) {
            let xml = await sheetFile.async('string');

            // Freeze panes: replace self-closing <sheetView .../> with one containing <pane>
            const freezeInner =
                `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" ` +
                `activePane="bottomLeft" state="frozen"/>` +
                `<selection pane="bottomLeft" activeCell="A${freezeRows + 1}" sqref="A${freezeRows + 1}"/>`;

            xml = xml.replace(
                /<sheetView([^>]*)\/>/,
                `<sheetView$1>${freezeInner}</sheetView>`,
            );

            // Yellow column D: add <c r="DN" s="{idx}"/> to every data row (row > freezeRows)
            xml = xml.replace(
                /<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g,
                (match, rowNum, attrs, content) => {
                    if (+rowNum <= freezeRows) return match;
                    if (content.includes(`r="D${rowNum}"`)) return match;
                    return `<row r="${rowNum}"${attrs}>${content}<c r="D${rowNum}" s="${yellowXfIdx}"/></row>`;
                },
            );

            zip.file('xl/worksheets/sheet1.xml', xml);
        }
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
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
