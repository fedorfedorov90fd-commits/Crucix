#!/usr/bin/env node
/**
 * server/verify.mjs — ВЕРИФИКАТОР CRUCIX (v5)
 * v5: использует http.request (нативный Node), НЕ fetch.
 * Причина: undici (Node fetch) зависает на AbortSignal + Connection close.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const BASE = getArg('--base', 'http://127.0.0.1:3117');
const TIMEOUT = parseInt(getArg('--timeout', '5000'), 10);
const PARALLEL = parseInt(getArg('--parallel', '1'), 10);
const LIMIT = parseInt(getArg('--limit', '0'), 10);

const MODE_ALL   = args.includes('--all');
const MODE_API   = args.includes('--api')   || MODE_ALL;
const MODE_PAGES = args.includes('--pages') || MODE_ALL;
const MODE_CYR   = args.includes('--cyr')   || MODE_ALL;

// ============================================================
//  probe через http.request
// ============================================================
function probe(path) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const url = BASE + path;
    
    const req = http.get(url, { timeout: TIMEOUT }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const status = res.statusCode;
        let bodyType = 'unknown';
        if (status === 200) {
          if (body.includes('"not_found"') || body.includes('"unknown_basket"')) {
            bodyType = 'not_found';
          } else {
            bodyType = 'data';
          }
        }
        const ok = status === 200 || status === 301 || status === 400;  // 301 — валидный редирект
        resolve({ path, status, ok, bodyType, ms: Date.now() - t0 });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ path, status: 0, ok: false, error: 'timeout', ms: Date.now() - t0 });
    });
    
    req.on('error', (e) => {
      resolve({ path, status: 0, ok: false, error: e.message, ms: Date.now() - t0 });
    });
  });
}

async function collectApiPaths() {
  const paths = new Set();
  try {
    const reg = JSON.parse(await fs.readFile(join(__dirname, 'registry.generated.json'), 'utf8'));
    for (const p of Object.keys(reg.routes || {})) {
      if (!p.endsWith('/*')) paths.add(p);
    }
  } catch {}
  try {
    const la = JSON.parse(await fs.readFile(join(__dirname, 'legacy-aliases.generated.json'), 'utf8'));
    for (const k of Object.keys(la)) paths.add(k + '/');
  } catch {}
  return [...paths];
}

async function collectPagePaths() {
  const arr = JSON.parse(await fs.readFile(join(__dirname, 'routes-pages.json'), 'utf8'));
  return arr.map(pg => pg.route || ('/' + pg.id));
}

async function collectCyrPaths() {
  const arr = JSON.parse(await fs.readFile(join(__dirname, 'routes-pages.json'), 'utf8'));
  return arr
    .filter(pg => /[а-яёА-ЯЁ]/.test(pg.route || pg.id || ''))
    .map(pg => pg.route || ('/' + pg.id));
}

async function runGroup(name, allPaths) {
  const paths = LIMIT > 0 ? allPaths.slice(0, LIMIT) : allPaths;
  console.log(`\n=== ${name} === (${paths.length}, parallel=${PARALLEL}, timeout=${TIMEOUT}ms, http.request)`);

  const results = [];
  for (let i = 0; i < paths.length; i += PARALLEL) {
    const batch = paths.slice(i, i + PARALLEL);
    results.push(...await Promise.all(batch.map(probe)));
    if ((i + PARALLEL) % 20 === 0 || i + PARALLEL >= paths.length) {
      const ok = results.filter(r => r.ok).length;
      console.log(`  ... ${results.length}/${paths.length} (OK: ${ok})`);
    }
  }

  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  const notFound = results.filter(r => r.bodyType === 'not_found').length;
  const realFail = results.filter(r => !r.ok && r.status !== 400);

  console.log(`\n  Итого: ${results.length}, OK: ${ok} (not_found: ${notFound}), FAIL: ${fail}`);
  if (realFail.length > 0) {
    console.log(`  Реальные провалы (${realFail.length}):`);
    for (const r of realFail.slice(0, 20)) {
      console.log(`    ❌ ${r.path} → ${r.status}${r.error ? ' (' + r.error + ')' : ''} ${r.ms}ms`);
    }
  }
  return { name, total: results.length, ok, fail: realFail.length, notFound };
}

async function main() {
  console.log(`=== CRUCIX VERIFY v5 @ ${BASE} ===\n`);

  try {
    const r = await probe('/');
    if (r.status !== 200) {
      console.error(`❌ Сервер не отвечает (${r.status}).`);
      process.exit(2);
    }
    console.log('✅ Сервер жив\n');
  } catch (e) {
    console.error(`❌ Сервер: ${e.message}`);
    process.exit(2);
  }

  const results = [];
  if (MODE_API) results.push(await runGroup('API', await collectApiPaths()));
  if (MODE_PAGES) results.push(await runGroup('PAGES', await collectPagePaths()));
  if (MODE_CYR) {
    const cyr = await collectCyrPaths();
    if (cyr.length) results.push(await runGroup('CYRILLIC', cyr));
  }

  const totalFail = results.reduce((s, r) => s + r.fail, 0);
  console.log(`\n=== ИТОГО ===`);
  for (const r of results) {
    console.log(`  ${r.name}: OK=${r.ok}, not_found=${r.notFound}, FAIL=${r.fail}, total=${r.total}`);
  }
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
