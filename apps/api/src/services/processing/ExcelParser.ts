import * as XLSX from 'xlsx';
import { excelSerialToDate, parseDateToDDMMYYYY } from './parsers/shared.js';

export interface ExcelTransaction {
    Date: string;
    Type: string;
    'Type and Description': string;
    'Money in': string;
    'Money out': string;
    Balance: string;
}

// Phase 1: Schema detection — identify which column maps to which canonical field
const SCHEMA_DETECTION_PROMPT = `You are a bank statement column header detector. Analyze the provided spreadsheet rows and return a JSON object identifying which column index (0-based) maps to each canonical field.

Canonical fields and synonyms:
- "Transaction Date": Date, Booking Date, Value Date, Transaction Date, Дата, Entry Date, Processing Date, Post Date, Settlement Date, Trade Date, Invoice Date, Inv.Date, Дата на фактура
- "Transaction Description": Description, Details, Narrative, Memo, Explanation, Particolari, Reference, Remarks, Particulars, Transaction Details, Payment Details, Beneficiary, Counterparty, Дата описание
- "Transaction Type": Type, Code, Reference, Entry Type, Inv.No, Transaction Type, Category, Payment Type, Ttype, Ref, Doc No, Document Number
- "Credit Amount": Credit, Deposit, Paid In, Money In, Credit Amount, Received, Amount In, Additions, CR, In, Incoming, Plus, Кредит
- "Debit Amount": Debit, Withdrawal, Paid Out, Money Out, Debit Amount, Sent, Amount Out, DR, Out, Outgoing, Minus, Дебит, Charges
- "Balance": Balance, Closing Balance, Running Balance, Available Balance, End Balance, Ledger Balance, Account Balance, Салдо
- "Signed Amount": Amount, Net Amount, Transaction Amount, Value, Sum, Net, Turnover, Сума

Priority rules:
- Return column index as a string, or "" if not found
- Only ONE date column, ONE description column
- If two columns both look like dates, prefer the one labeled "Transaction Date" or "Date" over "Value Date" or "Booking Date"
- If BOTH Credit/Debit AND Signed Amount columns exist, ALWAYS prefer Credit/Debit pair; set "Signed Amount": ""
- If only one amount column exists (no separate credit/debit), use "Signed Amount" for it
- Never map the same column index to two canonical fields
- "Balance" column is usually the rightmost numeric column
- For VAT/invoice sheets: "Inv.Date" → Transaction Date, "Explanation" → Transaction Description, "Inv.No" → Transaction Type, "Gross Amount" → Debit Amount — ignore Net Amount and VAT Amount columns
- If a sheet has "Total Amount" and "Amount" columns, prefer "Total Amount" for the amount field
- Return ONLY valid JSON, no markdown, no explanations

Output format:
{
  "Transaction Date": "0",
  "Transaction Description": "1",
  "Transaction Type": "",
  "Credit Amount": "3",
  "Debit Amount": "4",
  "Balance": "5",
  "Signed Amount": ""
}`;

// Phase 2: Row extraction — normalize all transaction rows
const ROW_EXTRACTION_PROMPT = `You are a bank statement row extractor. Given spreadsheet rows and a column mapping, extract all valid transaction rows as a JSON array.

Rules:
- Output ONLY a JSON array, no markdown, no explanations, no wrapping object
- Date normalization: DD/MM/YYYY format, 2-digit day and month, 4-digit year
- Excel serial dates: base = 1899-12-30 (NOT 1900-01-01). Serial 45795 = 18/05/2025. Columns annotated with "(serial)" contain Excel serial dates — apply the base conversion
- Two-digit years: 00-69 → 2000-2069, 70-99 → 1900-1999
- Day-first for ambiguous dates (e.g., 01/02/2024 = 1 Feb, not 1 Jan)
- Invalid or missing date → skip row entirely
- Rows where date column is empty → skip (even if amounts are present)
- Money: strip £ $ € symbols AND letter prefixes like "GBP", "USD", "EUR"; remove spaces; commas as thousands separators; handle EU format (1.234,56 → 1234.56)
- Handle negative values written as (1234.56) — parentheses = negative
- Output amounts as positive strings with exactly 2 decimal places (e.g., "1234.56")
- For Signed Amount column: if value contains "-" prefix or "()" wrapping → Money out; otherwise → Money in
- If BOTH a "Total Amount" and "Amount" column exist and their values differ, use Total Amount
- For Balance column: if value ends in "OD" or "DR" (e.g. "1,234.56 OD"), strip suffix and treat as negative — output as negative value
- VAT/invoice rows: Gross Amount → Money out, Balance → leave empty ""
- Skip rows that are: headers, empty, totals/summaries, banner/title rows
- Opening balance rows (text contains "opening", "brought forward", "b/f", "balance b/d") → skip
- Closing balance rows (text contains "closing", "carried forward", "c/f", "balance c/d") → skip
- Rows where ALL amount columns are empty → skip
- If a description cell contains only dashes, asterisks, or equals signs → skip (separator row)
- "Type and Description": if Type column exists and is non-empty, concatenate as "TYPE DESC"; if Type is empty or not mapped, use Description only
- Must return ALL valid transaction rows (not just the first)
- If no valid rows: return []

Output per row:
{
  "Date": "DD/MM/YYYY",
  "Type": "",
  "Type and Description": "",
  "Money in": "",
  "Money out": "",
  "Balance": ""
}

IMPORTANT: Your response must start with "[" and end with "]". Do not wrap in an object. Do not add any text before "[" or after "]".`;

async function callOpenAI(systemPrompt: string, userContent: string, jsonMode: boolean): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const body: any = {
        model: process.env.OPENAI_MODEL_EXTRACT || 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
        ],
        temperature: 0,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${err}`);
    }
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || '';
}

function rowsToText(rows: any[][]): string {
    return rows.map((row, i) => {
        const cols = row.map((cell, j) => {
            let val = cell ?? '';
            // Annotate Excel serial dates so the model knows to apply the 1899-12-30 base conversion
            if (typeof val === 'number' && val > 25000 && val < 60000) {
                val = `${val} (serial)`;
            }
            return `col${j}: ${val}`;
        }).join(', ');
        return `row${i + 1}: ${cols}`;
    }).join('\n');
}

export async function parseExcel(fileBuffer: Buffer): Promise<ExcelTransaction[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: true,
    }) as any[][];

    if (rawRows.length === 0) return [];

    // Phase 1: schema detection on first 20 rows
    const first20Text = rowsToText(rawRows.slice(0, 20));
    const schemaRaw = await callOpenAI(SCHEMA_DETECTION_PROMPT, first20Text, true);

    let schemaMap: Record<string, string> = {};
    try {
        schemaMap = JSON.parse(schemaRaw);
        const hasDate = schemaMap['Transaction Date'] !== '';
        const hasAmount = schemaMap['Credit Amount'] !== '' ||
                          schemaMap['Debit Amount'] !== '' ||
                          schemaMap['Signed Amount'] !== '';
        if (!hasDate || !hasAmount) {
            console.warn('[ExcelParser] Schema detection found no date or amount columns:', schemaMap);
            return [];
        }
    } catch {
        console.warn('[ExcelParser] Schema detection returned invalid JSON');
        return [];
    }

    // Phase 2: row extraction in batches of 50
    const allTransactions: ExcelTransaction[] = [];
    const batchSize = 50;

    for (let i = 0; i < rawRows.length; i += batchSize) {
        const batch = rawRows.slice(i, i + batchSize);
        const batchText = rowsToText(batch);
        const prompt = `
Column mapping (0-based column indices):
- Transaction Date is in column: ${schemaMap['Transaction Date'] || 'not found'}
- Transaction Description is in column: ${schemaMap['Transaction Description'] || 'not found'}
- Transaction Type is in column: ${schemaMap['Transaction Type'] || 'not found'}
- Credit Amount (Money in) is in column: ${schemaMap['Credit Amount'] || 'not found'}
- Debit Amount (Money out) is in column: ${schemaMap['Debit Amount'] || 'not found'}
- Signed Amount is in column: ${schemaMap['Signed Amount'] || 'not found'}
- Balance is in column: ${schemaMap['Balance'] || 'not found'}

Rows to extract:
${batchText}
`.trim();
        const resultRaw = await callOpenAI(ROW_EXTRACTION_PROMPT, prompt, false);

        const cleaned = resultRaw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                allTransactions.push(...parsed);
            }
        } catch {
            console.warn('[ExcelParser] Batch extraction returned invalid JSON for rows', i, '-', i + batchSize);
        }
    }

    return allTransactions;
}
