#!/usr/bin/env node
/**
 * ACCESSOS Extension Packaging Script (Phase 16)
 *
 * Verifies production build assets and packages them into a clean,
 * reproducible Chromium-compatible zip archive (dist/accessos-extension.zip).
 *
 * Enforces:
 * - Manifest V3 integrity
 * - Minimal permissions check (['storage', 'activeTab'])
 * - Zero secrets or credential patterns in bundled JavaScript
 * - Zero .env, .ts, or test files in distribution directory
 * - Standard PKZip archive generation with Deflate compression
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(EXTENSION_ROOT, 'dist');
const OUTPUT_ZIP = path.resolve(DIST_DIR, 'accessos-extension.zip');

function log(msg) {
  console.log(`[ACCESSOS Packager] ${msg}`);
}

function error(msg) {
  console.error(`[ACCESSOS Packager ERROR] ${msg}`);
  process.exit(1);
}

// 1. Verify dist folder exists
if (!fs.existsSync(DIST_DIR)) {
  error(`Distribution directory not found at ${DIST_DIR}. Run 'npm run build' first.`);
}

// 2. Validate manifest.json
const manifestPath = path.join(DIST_DIR, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  error('manifest.json is missing from dist directory.');
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  error(`Failed to parse dist/manifest.json: ${err.message}`);
}

if (manifest.manifest_version !== 3) {
  error(`Expected Manifest V3 (manifest_version: 3), got ${manifest.manifest_version}.`);
}

if (manifest.version !== '0.1.0') {
  error(`Expected release version 0.1.0, got ${manifest.version}.`);
}

const allowedPermissions = ['storage', 'activeTab'];
const manifestPermissions = manifest.permissions || [];
for (const perm of manifestPermissions) {
  if (!allowedPermissions.includes(perm)) {
    error(`Unauthorized permission '${perm}' found in manifest. Minimal model violated.`);
  }
}

// 3. Validate essential runtime assets
const requiredFiles = [
  'manifest.json',
  path.join('assets', 'background.js'),
  path.join('assets', 'content.js'),
  path.join('assets', 'popup.js'),
  path.join('src', 'popup', 'popup.html'),
  path.join('src', 'options', 'options.html'),
  path.join('icons', 'icon16.png'),
  path.join('icons', 'icon48.png'),
  path.join('icons', 'icon128.png'),
];

for (const req of requiredFiles) {
  const fullPath = path.join(DIST_DIR, req);
  if (!fs.existsSync(fullPath)) {
    error(`Required asset missing from distribution: ${req}`);
  }
}

// 4. Collect all distribution files and scan for hygiene & secrets
function collectFiles(dir, base = '') {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      // Ignore any previously generated zip files
      if (entry.name.endsWith('.zip')) {
        continue;
      }
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

const allFiles = collectFiles(DIST_DIR);
log(`Auditing ${allFiles.length} distribution files...`);

const secretPatterns = [
  /sk-[a-zA-Z0-9]{20,}/,
  /AIza[0-9A-Za-z-_]{35}/,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
  /bearer\s+[a-zA-Z0-9_\-\.]{25,}/i,
];

for (const file of allFiles) {
  const normRel = file.relPath.replace(/\\/g, '/');

  // Hygiene checks
  if (normRel.endsWith('.ts') && !normRel.endsWith('.d.ts')) {
    error(`Raw TypeScript source file included in bundle: ${normRel}`);
  }
  if (normRel.includes('.test.') || normRel.includes('.spec.')) {
    error(`Test file included in distribution bundle: ${normRel}`);
  }
  if (normRel.startsWith('.env') || normRel.endsWith('.env')) {
    error(`Environment secret file included in bundle: ${normRel}`);
  }
  if (normRel.includes('.git')) {
    error(`Git metadata included in bundle: ${normRel}`);
  }

  // Secret scanner on text/js files
  if (normRel.endsWith('.js') || normRel.endsWith('.html') || normRel.endsWith('.json')) {
    const content = fs.readFileSync(file.fullPath, 'utf8');
    for (const pat of secretPatterns) {
      if (pat.test(content)) {
        error(`Potential secret detected matching ${pat} in ${normRel}`);
      }
    }
  }
}

// 5. Build PKZip archive
function buildZipArchive(files, outputPath) {
  const localHeaders = [];
  const cdHeaders = [];
  let offset = 0;
  let totalUncompressed = 0;

  for (const file of files) {
    const name = file.relPath.replace(/\\/g, '/');
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = fs.readFileSync(file.fullPath);
    totalUncompressed += dataBuf.length;

    const crc = zlib.crc32(dataBuf);
    const compressed = zlib.deflateRawSync(dataBuf);

    // Local file header (30 bytes + filename)
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // Local header signature
    lh.writeUInt16LE(20, 4);         // Version needed (2.0)
    lh.writeUInt16LE(0, 6);          // Flags
    lh.writeUInt16LE(8, 8);          // Compression: Deflate
    lh.writeUInt16LE(0, 10);         // Last mod time
    lh.writeUInt16LE(0, 12);         // Last mod date
    lh.writeUInt32LE(crc, 14);       // CRC-32
    lh.writeUInt32LE(compressed.length, 18); // Compressed size
    lh.writeUInt32LE(dataBuf.length, 22);    // Uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26);    // Filename length
    lh.writeUInt16LE(0, 28);                 // Extra field length
    nameBuf.copy(lh, 30);

    const localChunk = Buffer.concat([lh, compressed]);
    localHeaders.push(localChunk);

    // Central directory header (46 bytes + filename)
    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0); // CD header signature
    cdh.writeUInt16LE(20, 4);         // Version made by
    cdh.writeUInt16LE(20, 6);         // Version needed
    cdh.writeUInt16LE(0, 8);          // Flags
    cdh.writeUInt16LE(8, 10);         // Compression: Deflate
    cdh.writeUInt16LE(0, 12);         // Time
    cdh.writeUInt16LE(0, 14);         // Date
    cdh.writeUInt32LE(crc, 16);       // CRC-32
    cdh.writeUInt32LE(compressed.length, 20); // Compressed size
    cdh.writeUInt32LE(dataBuf.length, 24);    // Uncompressed size
    cdh.writeUInt16LE(nameBuf.length, 28);    // Filename length
    cdh.writeUInt16LE(0, 30);                 // Extra field length
    cdh.writeUInt16LE(0, 32);                 // Comment length
    cdh.writeUInt16LE(0, 34);                 // Disk number start
    cdh.writeUInt16LE(0, 36);                 // Internal file attributes
    cdh.writeUInt32LE(0, 38);                 // External file attributes
    cdh.writeUInt32LE(offset, 42);            // Relative offset of local header
    nameBuf.copy(cdh, 46);
    cdHeaders.push(cdh);

    offset += localChunk.length;
  }

  const cdBuf = Buffer.concat(cdHeaders);

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Disk with CD
  eocd.writeUInt16LE(files.length, 8);  // Number of entries on this disk
  eocd.writeUInt16LE(files.length, 10); // Total entries
  eocd.writeUInt32LE(cdBuf.length, 12); // CD size
  eocd.writeUInt32LE(offset, 16);       // CD offset
  eocd.writeUInt16LE(0, 20);            // Comment length

  const finalZip = Buffer.concat([...localHeaders, cdBuf, eocd]);
  fs.writeFileSync(outputPath, finalZip);

  return {
    fileCount: files.length,
    uncompressedBytes: totalUncompressed,
    compressedBytes: finalZip.length,
  };
}

log('Building distributable zip package...');
const stats = buildZipArchive(allFiles, OUTPUT_ZIP);

log(`Successfully generated: ${path.relative(process.cwd(), OUTPUT_ZIP)}`);
log(`- Packaged files: ${stats.fileCount}`);
log(`- Uncompressed size: ${(stats.uncompressedBytes / 1024).toFixed(1)} KB`);
log(`- Compressed size: ${(stats.compressedBytes / 1024).toFixed(1)} KB`);
log('Distribution package verification: PASSED');
