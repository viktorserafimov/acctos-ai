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

Canonical fields:
- "Transaction Date": the date of each transaction (look for: Date, Booking Date, Value Date, Transaction Date, Дата)
- "Transaction Description": description/narrative (look for: Description, Details, Narrative, Memo, Explanation, Particolari)
- "Transaction Type": type/code (look for: Type, Code, Reference, Entry Type, Inv.No, Transaction Type)
- "Credit Amount": money received/in (look for: Credit, Deposit, Paid In, Money In, Credit Amount, Received, Amount In)
- "Debit Amount": money paid/out (look for: Debit, Withdrawal, Paid Out, Money Out, Debit Amount, Sent, Amount Out)
- "Balance": running balance (look for: Balance, Closing Balance, Running Balance, Available Balance)
- "Signed Amount": a single amount column with negative=debit, positive=credit (look for: Amount, Net Amount, Transaction Amount)

Rules:
- Return column index as a string, or "" if not found
- Only ONE date column, ONE description column
- If both Credit/Debit AND Signed Amount exist, prefer Credit/Debit
- For VAT invoices: "Inv.Date" = Transaction Date, "Explanation" = Transaction Description, "Inv.No" = Transaction Type, "Gross Amount" = Debit Amount
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
- Excel serial dates: base = 1899-12-30 (NOT 1900-01-01). Serial 45795 = 18/05/2025
- Two-digit years: 00-69 → 2000-2069, 70-99 → 1900-1999
- Day-first for ambiguous dates (e.g., 01/02/2024 = 1 Feb, not 1 Jan)
- Invalid or missing date → skip row entirely
- Money: remove £, $, €, spaces, commas as thousands separators; handle EU format (1.234,56 → 1234.56)
- Output amounts as positive strings with exactly 2 decimal places (e.g., "1234.56")
- For Signed Amount column: negative value → Money out; positive value → Money in
- Skip rows that are: headers, empty, totals/summaries, banner/title rows, opening/closing balance rows
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
}`;

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
        const cols = row.map((cell, j) => `col${j}: ${cell ?? ''}`).join(', ');
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
    } catch {
        console.warn('[ExcelParser] Schema detection returned invalid JSON, using defaults');
        schemaMap = { 'Transaction Date': '0', 'Transaction Description': '1', 'Credit Amount': '3', 'Debit Amount': '4', 'Balance': '5' };
    }

    // Phase 2: row extraction in batches of 50
    const allTransactions: ExcelTransaction[] = [];
    const batchSize = 50;

    for (let i = 0; i < rawRows.length; i += batchSize) {
        const batch = rawRows.slice(i, i + batchSize);
        const batchText = rowsToText(batch);
        const prompt = `Column mapping: ${JSON.stringify(schemaMap)}\n\nRows:\n${batchText}`;
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
