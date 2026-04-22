import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { Cell } from './parsers/shared.js';

let client: DocumentAnalysisClient | null = null;

function getClient(): DocumentAnalysisClient {
    if (!client) {
        const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
        const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
        if (!endpoint || !key) {
            throw new Error('Azure Document Intelligence credentials not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY environment variables.');
        }
        client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
    }
    return client;
}

/** Analyze a single-page PDF buffer with Azure prebuilt-layout model.
 *  Returns all table cells across all detected tables for that page. */
export async function analyzePage(pageBuffer: Buffer): Promise<Cell[]> {
    const azureClient = getClient();

    const poller = await azureClient.beginAnalyzeDocument('prebuilt-layout', pageBuffer);
    const result = await poller.pollUntilDone();

    const cells: Cell[] = [];

    if (!result.tables || result.tables.length === 0) {
        return cells;
    }

    // Collect cells from all tables, offsetting rowIndex so tables don't overlap
    let rowOffset = 0;
    for (const table of result.tables) {
        for (const cell of table.cells) {
            cells.push({
                rowIndex: (cell.rowIndex ?? 0) + rowOffset,
                columnIndex: cell.columnIndex ?? 0,
                content: (cell.content ?? '').trim(),
            });
        }
        // Advance offset past this table's rows
        const maxRow = table.cells.reduce((m, c) => Math.max(m, c.rowIndex ?? 0), 0);
        rowOffset += maxRow + 2; // +2 to leave a gap between tables
    }

    return cells;
}

/** Analyze multiple pages with a concurrency limit of 3 (matching Make's rate limit). */
export async function analyzePages(pageBuffers: Buffer[]): Promise<Array<Cell[] | null>> {
    const CONCURRENCY = 3;
    const results: Array<Cell[] | null> = new Array(pageBuffers.length).fill(null);

    for (let i = 0; i < pageBuffers.length; i += CONCURRENCY) {
        const batch = pageBuffers.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(async (buf, batchIdx) => {
                const pageIdx = i + batchIdx;
                try {
                    return await analyzePage(buf);
                } catch (err: any) {
                    console.error(`[AzureExtractor] Page ${pageIdx + 1} failed: ${err.message}`);
                    return null;
                }
            })
        );
        for (let j = 0; j < batchResults.length; j++) {
            results[i + j] = batchResults[j];
        }
    }

    return results;
}
