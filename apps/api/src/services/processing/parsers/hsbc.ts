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

// ── Text-content fallback (used when Azure DI finds no table cells) ──────────
// The HSBC Kinetic layout is not recognised as a table by Azure DI's
// prebuilt-layout model, so we parse directly from result.content text.
// The orchestrator injects the full combined-page text as a synthetic cell
// at rowIndex:-1 / columnIndex:-1.

const TEXT_DATE_RE = /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s*/;
const AMOUNT_END_1 = /([\d,]+\.\d{2})$/;
const AMOUNT_END_2 = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;

function splitAmounts(text: string): { rest: string; amt1: string } {
    const m2 = text.match(AMOUNT_END_2);
    if (m2) return { rest: text.slice(0, text.length - m2[0].length).trim(), amt1: m2[1] };
    const m1 = text.match(AMOUNT_END_1);
    if (m1) return { rest: text.slice(0, text.length - m1[0].length).trim(), amt1: m1[1] };
    return { rest: text, amt1: '' };
}

function parseFromContent(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let inSection = false;
    let currentDate = '';
    let pendingType = '';
    let pendingDesc = '';
    let hasPending = false;

    const flush = (moneyOut: string, moneyIn: string) => {
        if (!hasPending || !currentDate) { hasPending = false; return; }
        const desc = pendingDesc.trim();
        const type = pendingType;
        hasPending = false; pendingType = ''; pendingDesc = '';
        if (!desc || /balance\s+(brought|carried)\s+forward/i.test(desc)) return;
        if (!moneyOut && !moneyIn) return;
        transactions.push({
            date: currentDate,
            type,
            description: desc,
            moneyOut: moneyOut.replace(/,/g, ''),
            moneyIn:  moneyIn.replace(/,/g, ''),
            balance:  '',
        });
    };

    for (const line of lines) {
        if (!inSection) {
            if (/^Date\s+Pay/i.test(line)) inSection = true;
            continue;
        }

        // Skip repeated headers and footer lines present on every page
        if (/^Date\s+Pay/i.test(line)) continue;
        if (/you can contact/i.test(line)) continue;
        if (/have a question/i.test(line)) continue;
        if (/^Account Name\b/i.test(line)) continue;
        if (/Sheet\s+Number/i.test(line)) continue;
        if (/^(Credit|Debit)\s+interest/i.test(line)) continue;

        let rest = line;

        // Pull date off the front of the line if present
        const dateMatch = rest.match(TEXT_DATE_RE);
        if (dateMatch) {
            const parsed = parseDateToDDMMYYYY(dateMatch[1]);
            if (parsed) currentDate = parsed;
            rest = rest.slice(dateMatch[0].length).trim();
        }

        // Detect transaction code at start of remaining text
        let foundCode = '';
        for (const code of TRANSACTION_CODES) {
            if (rest === code || rest.startsWith(code + ' ')) {
                foundCode = code;
                rest = rest.slice(code.length).trim();
                break;
            }
        }

        if (foundCode) {
            flush('', '');
            pendingType = foundCode;
            hasPending = true;
            const { rest: descPart, amt1 } = splitAmounts(rest);
            pendingDesc = descPart;
            if (amt1) {
                const isCredit = foundCode === 'CR';
                flush(isCredit ? '' : amt1, isCredit ? amt1 : '');
            }
        } else if (hasPending) {
            // Continuation line: location text and/or amount for the current transaction
            const { rest: locPart, amt1 } = splitAmounts(rest);
            if (locPart) pendingDesc = `${pendingDesc} ${locPart}`.trim();
            if (amt1) {
                const isCredit = pendingType === 'CR';
                flush(isCredit ? '' : amt1, isCredit ? amt1 : '');
            }
        }
    }

    flush('', '');
    return transactions;
}

// ── Table-cell-based parser (primary path) ────────────────────────────────────

export function parse(cells: Cell[]): ParseResult {
    // Azure DI does not detect the HSBC Kinetic layout as a table — fall back
    // to parsing from the text content injected as the synthetic context cell.
    const realCells = cells.filter(c => c.rowIndex >= 0);
    if (realCells.length === 0) {
        const contextCell = cells.find(c => c.rowIndex === -1);
        if (contextCell?.content) {
            return { transactions: parseFromContent(contextCell.content) };
        }
        return { transactions: [] };
    }

    const hasCol5 = realCells.some(c => c.columnIndex === 5);

    // Group cells into rows: a new row starts when columnIndex === 0
    const rawRows: Row[] = [];
    let currentRow = emptyRow();

    // Sort by rowIndex then columnIndex
    const sorted = [...realCells].sort((a, b) => a.rowIndex !== b.rowIndex ? a.rowIndex - b.rowIndex : a.columnIndex - b.columnIndex);

    let lastRowIndex = -1;
    for (const cell of sorted) {
        const col = cell.columnIndex;
        const content = normStr(cell.content);

        if (cell.rowIndex !== lastRowIndex) {
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
