#!/usr/bin/env node
/**
 * scripts/maintenance/check-urls.mjs — пакетная проверка URL Crucix
 * Версия 1.2.0. Создан 23.09.2026.
 *
 * НАЗНАЧЕНИЕ:
 *   Проверяет список URL через два канала (direct + Tor), классифицирует
 *   каждый адрес и раскладывает по трём файлам:
 *     - urls-direct.txt  — direct=OK
 *     - urls-tor.txt     — direct=FAIL, tor=OK
 *     - urls-dead.txt    — direct=FAIL, tor=FAIL
 *
 * ИСПОЛЬЗОВАНИЕ:
 *   node scripts/maintenance/check-urls.mjs               # полный прогон + раскладка
 *   node scripts/maintenance/check-urls.mjs --dry         # без записи файлов
 *   node scripts/maintenance/check-urls.mjs --channel=direct
 *   node scripts/maintenance/check-urls.mjs --channel=tor
 *
 * ФАЙЛЫ:
 *   data/feeds/urls-to-check.txt       — ВХОД (вручную пополняется)
 *   data/feeds/urls-classified.json    — ПОЛНЫЙ ОТЧЁТ (auto)
 *   data/feeds/urls-direct.txt         — ПРЯМОЙ СПИСОК (auto)
 *   data/feeds/urls-tor.txt            — ЗАПАДНЫЙ СПИСОК (auto)
 *   data/feeds/urls-dead.txt           — отбраковка (auto)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const FEEDS_DIR = join(ROOT, 'data', 'feeds');
const DEFAULT_URLS_FILE = join(FEEDS_DIR, 'urls-to-check.txt');
const OUT_CLASSIFIED = join(FEEDS_DIR, 'urls-classified.json');
const OUT_DIRECT = join(FEEDS_DIR, 'urls-direct.txt');
const OUT_TOR = join(FEEDS_DIR, 'urls-tor.txt');
const OUT_DEAD = join(FEEDS_DIR, 'urls-dead.txt');

const args = process.argv.slice(2);
const getArg = (name) => {
  const a = args.find(x => x.startsWith(`--${name}=`));
  return a ? a.slice(`--${name}=`.length) : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const FILES_ARG = getArg('file');
const CHANNEL_ARG = getArg('channel');
const DRY = hasFlag('dry');
const TIMEOUT_MS = parseInt(getArg('timeout') || '15000', 10);
const CONCURRENCY = parseInt(getArg('concurrency') || '5', 10);

const TOR_AGENT = new SocksProxyAgent('socks5h://127.0.0.1:9050');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function loadUrls() {
  const file = FILES_ARG || DEFAULT_URLS_FILE;
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  } catch (e) {
    console.error(`Не могу прочитать список URL: ${e.message}`);
    process.exit(1);
  }
}

async function checkOne(url, channel) {
  const start = Date.now();
  const opts = {
    method: 'GET',
    timeout: TIMEOUT_MS,
    maxRedirects: 5,
    responseType: 'text',
    transformResponse: [(d) => d],
    validateStatus: () => true,
    headers: { 'User-Agent': UA, 'Accept': '*/*' },
  };
  if (channel === 'tor') {
    opts.httpAgent = TOR_AGENT;
    opts.httpsAgent = TOR_AGENT;
    opts.proxy = false;
  }
  try {
    const res = await axios.request({ url, ...opts });
    const elapsed = Date.now() - start;
    const text = typeof res.data === 'string' ? res.data : String(res.data);
    const ct = (res.headers && res.headers['content-type']) || '';
    return {
      channel,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      elapsed_ms: elapsed,
      content_type: ct,
      size: text.length,
    };
  } catch (e) {
    return {
      channel,
      status: 0,
      ok: false,
      elapsed_ms: Date.now() - start,
      error: (e?.code || e?.name || 'Error') + ': ' + (e?.message || ''),
    };
  }
}

async function classifyUrl(url) {
  const direct = await checkOne(url, 'direct');
  const tor = await checkOne(url, 'tor');
  let category = 'dead';
  if (direct.ok) category = 'direct';
  else if (tor.ok) category = 'tor';
  return { url, category, direct, tor };
}

async function runBatch(urls, concurrency) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx];
      process.stdout.write(`[${idx + 1}/${urls.length}] ${url}\n`);
      const r = await classifyUrl(url);
      out[idx] = r;
      const tag = r.category === 'direct' ? 'DIRECT' : r.category === 'tor' ? 'TOR' : 'DEAD';
      process.stdout.write(`  [${tag.padEnd(6)}] direct=${r.direct.ok ? 'OK' : 'FAIL'} tor=${r.tor.ok ? 'OK' : 'FAIL'}\n`);
    }
  });
  await Promise.all(workers);
  return out;
}

async function writeClassified(results) {
  if (DRY) {
    process.stdout.write('\n[DRY] файлы не перезаписаны\n');
    return;
  }
  await fs.mkdir(FEEDS_DIR, { recursive: true });

  const classified = {
    generated_at: new Date().toISOString(),
    total: results.length,
    counts: {
      direct: results.filter(r => r.category === 'direct').length,
      tor: results.filter(r => r.category === 'tor').length,
      dead: results.filter(r => r.category === 'dead').length,
    },
    results,
  };
  await fs.writeFile(OUT_CLASSIFIED, JSON.stringify(classified, null, 2));

  const direct = results.filter(r => r.category === 'direct').map(r => r.url);
  const tor = results.filter(r => r.category === 'tor').map(r => r.url);
  const dead = results.filter(r => r.category === 'dead').map(r => r.url);

  const header = (title) => `# ${title}\n# Обновлено: ${new Date().toISOString()}\n# Сгенерировано: scripts/maintenance/check-urls.mjs\n\n`;

  await fs.writeFile(OUT_DIRECT, header('Прямой список (direct)') + direct.join('\n') + '\n');
  await fs.writeFile(OUT_TOR, header('Западный список (Tor-only)') + tor.join('\n') + '\n');
  await fs.writeFile(OUT_DEAD, header('Отбраковка (не работает нигде)') + dead.join('\n') + '\n');

  process.stdout.write('\nФайлы записаны:\n');
  process.stdout.write(`  ${OUT_CLASSIFIED}  — полный отчёт\n`);
  process.stdout.write(`  ${OUT_DIRECT}     — ${direct.length} direct\n`);
  process.stdout.write(`  ${OUT_TOR}        — ${tor.length} tor\n`);
  process.stdout.write(`  ${OUT_DEAD}       — ${dead.length} dead\n`);
}

async function main() {
  const urls = await loadUrls();
  if (!urls.length) {
    console.error('Нет URL для проверки');
    process.exit(1);
  }
  process.stdout.write(`Проверка ${urls.length} URL (direct + tor), concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms\n`);
  process.stdout.write('='.repeat(80) + '\n');

  const start = Date.now();
  const results = await runBatch(urls, CONCURRENCY);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const direct = results.filter(r => r.category === 'direct').length;
  const tor = results.filter(r => r.category === 'tor').length;
  const dead = results.filter(r => r.category === 'dead').length;

  process.stdout.write('='.repeat(80) + '\n');
  process.stdout.write(`Итого за ${elapsed}с:\n`);
  process.stdout.write(`  DIRECT: ${direct}\n`);
  process.stdout.write(`  TOR:    ${tor}\n`);
  process.stdout.write(`  DEAD:   ${dead}\n`);

  await writeClassified(results);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
