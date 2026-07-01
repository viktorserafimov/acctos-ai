/**
 * fetch-supabase-cache.mjs
 *
 * Downloads Azure DI cache from Supabase for every PDF in a folder and saves
 * local .azure-cache.json files so batch-process-folder.ts can run offline
 * (without calling Azure DI again).
 *
 * Usage:
 *   node apps/api/fetch-supabase-cache.mjs "<folder path>"
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in apps/api/.env
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = join(__dirname, '.env');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
    const m = line.match(/^([^=]+)="?([^"]*)"?\s*$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const FOLDER = process.argv[2];
if (!FOLDER) {
    console.error('Usage: node apps/api/fetch-supabase-cache.mjs "<folder path>"');
    process.exit(1);
}

// ── PostgREST query via plain fetch (no Supabase client — avoids WebSocket issue on Node 20) ──
async function fetchFromCache(hash) {
    const url = `${SUPABASE_URL}/rest/v1/azure_di_cache?file_hash=eq.${hash}&select=pages&limit=1`;
    const res = await fetch(url, {
        headers: {
            apikey:        SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Accept:        'application/json',
        },
    });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    return rows.length > 0 ? rows[0] : null;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
const pdfs = readdirSync(FOLDER)
    .filter(f => /\.pdf(\.pdf)?$/i.test(f))
    .sort();

console.log(`Found ${pdfs.length} PDFs in: ${FOLDER}\n`);

let fetched = 0, skipped = 0, missing = 0;

for (const fname of pdfs) {
    const pdfPath   = join(FOLDER, fname);
    const cachePath = pdfPath.replace(/\.pdf$/i, '') + '.azure-cache.json';

    if (existsSync(cachePath)) {
        console.log(`  SKIP (already cached): ${fname}`);
        skipped++;
        continue;
    }

    const hash = createHash('sha256').update(readFileSync(pdfPath)).digest('hex');
    process.stdout.write(`  ${fname} (${hash.slice(0, 8)}…) → `);

    let row;
    try {
        row = await fetchFromCache(hash);
    } catch (err) {
        console.log(`ERROR: ${err.message}`);
        missing++;
        continue;
    }

    if (!row) {
        console.log('NOT IN CACHE — run via API first to populate');
        missing++;
        continue;
    }

    writeFileSync(cachePath, JSON.stringify(row.pages, null, 2), 'utf8');
    const pageCount = Array.isArray(row.pages) ? row.pages.length : '?';
    console.log(`✓ ${pageCount} page(s) saved`);
    fetched++;
}

console.log(`\nDone: ${fetched} fetched, ${skipped} skipped, ${missing} not in cache`);
if (missing > 0) {
    console.log('\nFor files not in cache, upload them via the Acctos UI or Gmail to populate Supabase,');
    console.log('then re-run this script.');
}
console.log('\nNext step:');
console.log(`  npx tsx apps/api/batch-process-folder.ts "${FOLDER}"`);
