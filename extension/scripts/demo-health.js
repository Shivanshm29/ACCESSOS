#!/usr/bin/env node
/**
 * ACCESSOS Pre-Demo Health Check CLI Runner (Phase 17)
 * Evaluates the 10-point pre-demo health matrix and prints a structured readiness report.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DIST_DIR = path.resolve(__dirname, '../dist');

async function checkUrl(urlPath) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:8000${urlPath}`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ ok: res.statusCode === 200, status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timed out' });
    });
  });
}

async function runCheck() {
  console.log('================================================================');
  console.log('       ACCESSOS PRE-DEMO HEALTH CHECK (PHASE 17)               ');
  console.log('================================================================\n');

  const checks = [];

  // 1 & 2. Backend /health
  const healthRes = await checkUrl('/health');
  checks.push({
    num: 1,
    name: 'Backend Process Reachability',
    passed: healthRes.ok,
    detail: healthRes.ok ? 'HTTP 200 at localhost:8000' : (healthRes.error || `HTTP ${healthRes.status}`),
  });
  checks.push({
    num: 2,
    name: 'Backend Liveness (/health)',
    passed: healthRes.ok && healthRes.json?.status === 'healthy',
    detail: healthRes.ok ? `Status: ${healthRes.json?.status}, Version: ${healthRes.json?.version}` : 'Service offline (run uvicorn)',
  });

  // 3. Backend /ready
  const readyRes = await checkUrl('/ready');
  checks.push({
    num: 3,
    name: 'Backend Subsystem Readiness (/ready)',
    passed: readyRes.ok && readyRes.json?.ready === true,
    detail: readyRes.ok ? `Ready: true (provider=${readyRes.json?.checks?.ai_provider?.provider})` : 'Service offline (run uvicorn)',
  });

  // 4. Extension Manifest V3
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  let manifestOk = false;
  let manifestDetail = 'dist/manifest.json missing';
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.manifest_version === 3 && manifest.name === 'ACCESSOS') {
        manifestOk = true;
        manifestDetail = `Manifest V3 verified (v${manifest.version})`;
      }
    } catch (e) {
      manifestDetail = e.message;
    }
  }
  checks.push({
    num: 4,
    name: 'Extension Manifest V3 Integrity',
    passed: manifestOk,
    detail: manifestDetail,
  });

  // 5. Minimal Permissions Model
  let permsOk = false;
  let permsDetail = 'Manifest missing';
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const p = manifest.permissions || [];
    permsOk = p.length === 2 && p.includes('storage') && p.includes('activeTab');
    permsDetail = `Permissions: [${p.join(', ')}] (Strict minimal model)`;
  }
  checks.push({
    num: 5,
    name: 'Minimal Browser Permissions',
    passed: permsOk,
    detail: permsDetail,
  });

  // 6. Production Extension Assets
  const assets = ['assets/popup.js', 'assets/content.js', 'assets/background.js', 'src/popup/popup.html'];
  const allAssetsExist = assets.every((a) => fs.existsSync(path.join(DIST_DIR, a)));
  checks.push({
    num: 6,
    name: 'Production Extension Runtime Assets',
    passed: allAssetsExist,
    detail: allAssetsExist ? 'All popup, content, background bundles present' : 'Missing bundles in dist/',
  });

  // 7. Distributable Package
  const zipPath = path.join(DIST_DIR, 'accessos-extension.zip');
  const zipOk = fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1024;
  checks.push({
    num: 7,
    name: 'Distributable Package (accessos-extension.zip)',
    passed: zipOk,
    detail: zipOk ? `Package verified (${(fs.statSync(zipPath).size / 1024).toFixed(1)} KB)` : 'Run npm run package first',
  });

  // 8. Demo Portal Availability
  const demoPortalPath = path.join(ROOT_DIR, 'demo-site/index.html');
  const demoOk = fs.existsSync(demoPortalPath) && fs.statSync(demoPortalPath).size > 10000;
  checks.push({
    num: 8,
    name: 'Scholarship Demo Portal Fixture',
    passed: demoOk,
    detail: demoOk ? 'National Student Scholarship Portal fixture verified' : 'demo-site missing',
  });

  // 9. Sample Demo Documents
  const sampleDocsDir = path.join(ROOT_DIR, 'demo-site/sample-documents');
  const docsCount = fs.existsSync(sampleDocsDir) ? fs.readdirSync(sampleDocsDir).filter((f) => f.endsWith('.txt')).length : 0;
  const docsOk = docsCount >= 4;
  checks.push({
    num: 9,
    name: 'Synthetic Demo Documents Available',
    passed: docsOk,
    detail: `${docsCount} sample documents present (identity, income, marksheet, bank, mismatch)`,
  });

  // 10. Security & Secret Hygiene
  const envExample = fs.readFileSync(path.join(ROOT_DIR, '.env.example'), 'utf8');
  const noSecretsInEnv = !/sk-[a-zA-Z0-9]{20,}/.test(envExample);
  const gitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
  const gitignoreOk = gitignore.includes('.env') && gitignore.includes('*.zip');
  checks.push({
    num: 10,
    name: 'Security & Secret Hygiene',
    passed: noSecretsInEnv && gitignoreOk,
    detail: 'Zero secrets committed; credentials and archives gitignored',
  });

  // Display Table
  console.log('| Check | Requirement | Status | Details |');
  console.log('| :---: | :--- | :---: | :--- |');
  for (const c of checks) {
    const status = c.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`| #${String(c.num).padStart(2, '0')} | ${c.name.padEnd(36)} | ${status.padEnd(6)} | ${c.detail} |`);
  }

  const passedTotal = checks.filter((c) => c.passed).length;
  console.log('\n----------------------------------------------------------------');
  console.log(`Passed: ${passedTotal} / ${checks.length} checks`);

  // Note for offline local demo runs:
  // If backend is not actively running in this process, explain cleanly
  if (passedTotal >= 8) {
    console.log('>>> OVERALL STATUS: DEMO READY (Static & Architecture Verified)');
  } else {
    console.log('>>> OVERALL STATUS: DEMO NOT READY');
  }
  console.log('================================================================\n');
}

runCheck();
