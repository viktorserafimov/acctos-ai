import { randomUUID } from 'crypto';
import { jobStore } from './JobStore.js';
import { classify, detectBankFromContent, BankType } from './DocumentClassifier.js';
import { splitPdf } from './PdfSplitter.js';
import { analyzePages } from './AzureExtractor.js';
import { categorize } from './AssistantCategorizer.js';
import { parseExcel } from './ExcelParser.js';
import { buildPdfOutputExcel, buildExcelOutputExcel } from './ExcelOutputBuilder.js';
import { Cell, ParsedTransaction, ParseResult } from './parsers/shared.js';

import { parse as parseHsbc } from './parsers/hsbc.js';
import { parse as parseRevolut } from './parsers/revolut.js';
import { parse as parseMonzo } from './parsers/monzo.js';
import { parse as parseWise } from './parsers/wise.js';
import { parse as parseStarling } from './parsers/starling.js';
import { parse as parseNatwest } from './parsers/natwest.js';
import { parse as parseNationwide } from './parsers/nationwide.js';
import { parse as parseSantander } from './parsers/santander.js';
import { parse as parseBarclays } from './parsers/barclays.js';
import { parse as parseMetro } from './parsers/metro.js';
import { parse as parseGeneric } from './parsers/generic.js';

type StandardParser = (cells: Cell[]) => ParseResult;

function getParser(bankType: BankType): StandardParser {
    switch (bankType) {
        case 'hsbc':       return parseHsbc;
        case 'revolut':    return parseRevolut;
        case 'wise':       return parseWise;
        case 'starling':   return parseStarling;
        case 'natwest':    return parseNatwest;
        case 'nationwide': return parseNationwide;
        case 'santander':  return parseSantander;
        case 'barclays':   return parseBarclays;
        case 'metro':      return parseMetro;
        default:           return parseGeneric;
    }
}

function parseAllCells(pageCells: Array<Cell[] | null>, bankType: BankType): ParsedTransaction[] {
    const allTransactions: ParsedTransaction[] = [];

    if (bankType === 'monzo') {
        let pendingRow: ParsedTransaction | null | undefined = null;
        for (const cells of pageCells) {
            if (!cells) continue;
            const result = parseMonzo(cells, { pendingFromPrev: pendingRow });
            allTransactions.push(...result.transactions);
            pendingRow = result.pendingRow;
        }
        if (pendingRow) allTransactions.push(pendingRow);
    } else {
        const parser = getParser(bankType);
        for (const cells of pageCells) {
            if (!cells) continue;
            const result = parser(cells);
            allTransactions.push(...result.transactions);
        }
    }

    return allTransactions;
}

export function startProcessingJob(filename: string, mimeType: string, fileBuffer: Buffer): string {
    const jobId = randomUUID();
    jobStore.create(jobId, filename);

    runJob(jobId, filename, mimeType, fileBuffer).catch(err => {
        console.error(`[Orchestrator] Job ${jobId} unhandled crash:`, err);
        jobStore.update(jobId, { status: 'failed', error: String(err?.message ?? err) });
    });

    return jobId;
}

async function runJob(jobId: string, filename: string, mimeType: string, fileBuffer: Buffer): Promise<void> {
    try {
        // ── Stage: classify ──────────────────────────────────────────────────────
        jobStore.update(jobId, { status: 'processing', currentStage: 'classify' });
        const classification = classify(filename, mimeType);
        jobStore.update(jobId, {
            bankType: classification.bankType,
            docType: classification.docType,
            fileFormat: classification.fileFormat,
            currentStage: 'extract',
        });

        let outputBuffer: Buffer;

        if (classification.fileFormat === 'excel') {
            // ── Stage: extract (OpenAI two-pass for Excel) ───────────────────────
            const transactions = await parseExcel(fileBuffer);
            if (transactions.length === 0) throw new Error('No transactions found in spreadsheet');
            jobStore.update(jobId, { transactionCount: transactions.length, currentStage: 'output' });

            // ── Stage: output ────────────────────────────────────────────────────
            outputBuffer = buildExcelOutputExcel(transactions);

        } else {
            // ── Stage: extract (Azure DI page splitting + cell extraction) ───────
            const pageBuffers = await splitPdf(fileBuffer);
            jobStore.update(jobId, { pageCount: pageBuffers.length });
            const pageCells = await analyzePages(pageBuffers);

            // ── Stage: parse (bank-specific parser) ──────────────────────────────
            jobStore.update(jobId, { currentStage: 'parse' });

            let bankType = classification.bankType;
            if (bankType === 'generic') {
                const allText = pageCells.flatMap(c => c ?? []).map(c => c.content).join(' ');
                const detected = detectBankFromContent(allText);
                if (detected !== 'generic') {
                    console.log(`[Orchestrator] Bank detected from content: ${detected} (filename gave generic)`);
                    bankType = detected;
                    jobStore.update(jobId, { bankType: detected });
                }
            }

            const transactions = parseAllCells(pageCells, bankType);
            if (transactions.length === 0) throw new Error('No transactions could be extracted from the document');

            // ── Stage: categorize (OpenAI Assistant) ─────────────────────────────
            jobStore.update(jobId, { currentStage: 'categorize' });
            const categorized = await categorize(transactions);
            jobStore.update(jobId, { transactionCount: categorized.length, currentStage: 'output' });

            // ── Stage: output (build Excel) ───────────────────────────────────────
            outputBuffer = buildPdfOutputExcel(categorized);
        }

        jobStore.update(jobId, { status: 'completed', outputBuffer, completedAt: new Date() });
        console.log(`[Orchestrator] Job ${jobId} completed — ${filename}`);

    } catch (err: any) {
        const stage = jobStore.get(jobId)?.currentStage;
        console.error(`[Orchestrator] Job ${jobId} failed at stage "${stage}":`, err.message);
        jobStore.update(jobId, {
            status: 'failed',
            error: err.message || String(err),
            completedAt: new Date(),
        });
    }
}
