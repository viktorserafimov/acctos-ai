// Adapted from Make scenario 8458511, code:ExecuteCode module id 1248
import { Cell, ParsedTransaction, ParseResult, TRANSACTION_CODES, normStr, parseDateToDDMMYYYY, formatMoney } from './shared.js';

interface Row {
    c0: string; c1: string; c2: string; c3: string; c4: string; c5: string; c6: string;
    maxCol: number;
}

function emptyRow(): Row {
    return { c0:'', c1:'', c2:'', c3:'', c4:'', c5:'', c6:'', maxCol:-1 };
}

function rowHasData(row: Row): boolean {
    return [row.c0,row.c1,row.c2,row.c3,row.c4,row.c5,row.c6].some(v => v && v.trim() !== '');
}

function extractDate(val: string): string {
    if (!val) return '';
    const m = String(val).match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/);
    return m ? parseDateToDDMMYYYY(m[1]) : '';
}

function findCode(row: Row): string {
    const c1 = (row.c1 || '').trim();
    for (const code of TRANSACTION_CODES) {
        if (c1 === code) return code;
    }
    const c0 = (row.c0 || '').trim();
    for (const code of TRANSACTION_CODES) {
        if (c0.startsWith(code + ' ') || c0 === code) return code;
    }
    return '';
}

export function parse(cells: Cell[]): ParseResult {
    const hasCol5 = cells.some(c => c.columnIndex === 5);

    // Group cells into rows: a new row starts when columnIndex === 0
    const rawRows: Row[] = [];
    let currentRow = emptyRow();

    // Sort by rowIndex then columnIndex
    const sorted = [...cells].sort((a, b) => a.rowIndex !== b.rowIndex ? a.rowIndex - b.rowIndex : a.columnIndex - b.columnIndex);

    let lastRowIndex = -1;
    for (const cell of sorted) {
        const col = cell.columnIndex;
        const content = normStr(cell.content);

        if (cell.rowIndex !== lastRowIndex) {
            // New table row
            if (lastRowIndex !== -1 && rowHasData(currentRow)) {
                rawRows.push(currentRow);
                currentRow = emptyRow();
            }
            lastRowIndex = cell.rowIndex;
        }

        if (col > currentRow.maxCol) currentRow.maxCol = col;

        if (col === 0) {
            currentRow.c0 = content;
        } else if (col >= 1 && col <= 6) {
            // If col 1 has a transaction code and row already has data, start new logical row
            if (col === 1 && content && TRANSACTION_CODES.includes(content.trim()) && rowHasData(currentRow)) {
                rawRows.push(currentRow);
                currentRow = emptyRow();
                currentRow.c1 = content.trim();
                continue;
            }
            const key = `c${col}` as keyof Row;
            const existing = currentRow[key] as string;
            (currentRow as any)[key] = existing ? `${existing} ${content}`.trim() : content;
        }
    }
    if (rowHasData(currentRow)) rawRows.push(currentRow);

    const transactions: ParsedTransaction[] = [];

    for (const row of rawRows) {
        const date = extractDate(row.c0) || extractDate(row.c1);
        if (!date) continue;

        const type = findCode(row);

        let description = '';
        if (row.c1 && !TRANSACTION_CODES.includes(row.c1.trim())) {
            description = row.c1;
        } else if (row.c2) {
            description = row.c2;
        }
        if (row.c3 && hasCol5) description = `${description} ${row.c3}`.trim();

        let moneyOut = '', moneyIn = '', balance = '';
        if (hasCol5) {
            moneyOut = row.c3 || '';
            moneyIn  = row.c4 || '';
            balance  = row.c5 || '';
        } else {
            moneyOut = row.c2 || '';
            moneyIn  = row.c3 || '';
            balance  = row.c4 || '';
        }

        transactions.push({
            date,
            type,
            description,
            moneyOut: moneyOut.replace(/,/g, ''),
            moneyIn:  moneyIn.replace(/,/g, ''),
            balance:  balance.replace(/,/g, ''),
        });
    }

    return { transactions };
}
