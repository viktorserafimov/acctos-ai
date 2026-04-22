import * as XLSX from 'xlsx';
import { CategorizedTransaction } from './AssistantCategorizer.js';
import { ExcelTransaction } from './ExcelParser.js';

const PDF_HEADERS = [
    'DATE', 'Type and Description', 'INCOME', 'SALARY', 'OTHER',
    'INSURANCE', 'LOAN', 'CASH', 'TRAVEL', 'PHONE', 'CHARGES',
    'Bank_Transfer', 'HMRC', 'RENT', 'BILLS', 'Balance',
];

const EXCEL_HEADERS = ['Date', 'Type', 'Type and Description', 'Money in', 'Money out', 'Balance'];

export function buildPdfOutputExcel(transactions: CategorizedTransaction[]): Buffer {
    const rows = transactions.map(t => [
        t.DATE,
        t['Type and Description'],
        t.INCOME,
        t.SALARY,
        t.OTHER,
        t.INSURANCE,
        t.LOAN,
        t.CASH,
        t.TRAVEL,
        t.PHONE,
        t.CHARGES,
        t.Bank_Transfer,
        t.HMRC,
        t.RENT,
        t.BILLS,
        t.Balance,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([PDF_HEADERS, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export function buildExcelOutputExcel(transactions: ExcelTransaction[]): Buffer {
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
