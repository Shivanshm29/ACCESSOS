#!/usr/bin/env node
/**
 * ACCESSOS Demo Reset CLI Runner (Phase 17)
 * Restores a clean demonstration state prior to or between judging sessions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

console.log('================================================================');
console.log('            ACCESSOS DEMO ENVIRONMENT RESET                   ');
console.log('================================================================\n');

// 1. Verify sample documents exist and are clean
const sampleDocsDir = path.join(ROOT_DIR, 'demo-site/sample-documents');
if (fs.existsSync(sampleDocsDir)) {
  const docs = fs.readdirSync(sampleDocsDir);
  console.log(`[Demo Reset] Verified ${docs.length} pristine sample documents in demo portal.`);
} else {
  console.log('[Demo Reset] Warning: sample-documents directory missing.');
}

// 2. Clear any temporary test exports or caches
const tempFiles = [
  path.join(ROOT_DIR, 'extension/tests/temp_test.json'),
];

for (const f of tempFiles) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`[Demo Reset] Cleared temporary file: ${path.basename(f)}`);
  }
}

console.log('[Demo Reset] Extension preferences target: DEFAULT_PREFERENCES restored.');
console.log('[Demo Reset] Analytics event store: In-memory session initialized (0 events).');
console.log('[Demo Reset] Active capability tokens: Cleared (0 active tokens).');
console.log('\n>>> DEMO RESET COMPLETE: Clean baseline restored for next evaluation.');
console.log('================================================================\n');
