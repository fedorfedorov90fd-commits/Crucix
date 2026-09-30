#!/usr/bin/env node
/**
 * Crucix: check-urls.mjs — классификация RSS-URL по каналам доступа.
 * Версия 2.0.0.
 *
 * Назначение: проверить URL из выбранного источника (feeds.opml по умолчанию
 * или urls-to-check.txt) через 2 канала (direct + Tor), классифицировать по
 * 3 категориям (direct / tor / dead), записать в urls-classified.json и 3 txt-файла.
 *
 * Использует стандарт: параллелизм 10, timeout 5 сек, прогресс-лог каждые 10.
 *
 * CLI:
 *   node check-urls.mjs                          полная проверка из feeds.opml
 *   node check-urls.mjs --source=urls-to-check   из urls-to-check.txt
 *   node check-urls.mjs --source=unified         из feeds-unified.opml (210 лент)
 *   node check-urls.mjs --limit=30               первые 30
 *   node check-urls.mjs --timeout=4000           таймаут 4 сек
 *   node check-urls.mjs --verbose                подробный вывод
 *   node check-urls.mjs --only=direct            только direct
 *
 * Выход:
 *   data/feeds/urls-classified.json    полный отчёт
 *   data/feeds/urls-direct.txt         прямые
 *   data/feeds/urls-tor.txt            через Tor
 *   data/feeds/urls-dead.txt           недоступные
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const CONFIG = {
  opmlPath: join(ROOT, 'data', 'feeds', 'feeds.opml'),
  opmlUnifiedPath: join(ROOT, 'data', 'feeds', 'feeds-unified.opml'),
  urlsToCheckPath: join(ROOT, 'data', 'feeds', 'urls-to-check.txt'),
  outClassified: join(ROOT, 'data', 'feeds', 'urls-classified.json'),
  outDirect: join(ROOT, 'data', 'feeds', 'urls-direct.txt'),
  outTor: join(ROOT, 'data', 'feeds', 'urls-tor.txt'),
  outDead: join(ROOT, 'data', 'feeds', 'urls-dead.txt'),
  parallel: 10,
  timeoutMs: 5000,
  torProbeMs: 8000,
  torPort: 9050,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  acceptHeader: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
};

const WESTERN_HINTS = [
  'bbc.', 'dw.com', 'reuters', 'nytimes', 'theguardian', 'economist',
  'aljazeera', 'france24', 'wsj.com', 'foxnews', 'skynews', 'scmp.com',
  'politico', 'cnn.com', 'washingtonpost', 'iiss.org', 'cfr.org',
  'csis.org', 'understandingwar', 'chathamhouse', 'carnegieendowment',
  'rusi.org', 'bloomberg', 'ft.com',
];

function parseArgs(argv) {
  const args = { limit: null, timeout: null, verbose: false, only: null, source: 'opml' };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--timeout=')) args.timeout = parseInt(a.split('=')[1], 10);
    else if (a === '--verbose') args.verbose = true;
    else if (a.startsWith('--only=')) args.only = a.split('=')[1];
    else if (a.startsWith('--source=')) args.source = a.split('=')[1];
  }
  return args;
}
const ARGS = parseArgs(process.argv);
if (ARGS.timeout) CONFIG.timeoutMs = ARGS.timeout;

function progress(msg) { process.stdout.write(msg + '\n'); }

async function parseOpml() {
  const xml = await fs.readFile(CONFIG.opmlPath, 'utf-8');
  const feeds = [];
  const regex = /<outline[^>]*?xmlUrl="([^"]+)"[^>]*?\/?>/g;
  let match;
  const seen = new Set();
  while ((match = regex.exec(xml)) !== null) {
    const block = match[0];
    const url = match[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const text = (block.match(/text="([^"]*)"/) || [])[1] || '';
    const category = (block.match(/category="([^"]*)"/) || [])[1] || 'news';
    const pole = (block.match(/pole="([^"]*)"/) || [])[1] || 'unknown';
    feeds.push({ url, text, category, pole });
  }
  return feeds;
}

async function parseOpmlFromFile(filePath) {
  const xml = await fs.readFile(filePath, 'utf-8');
  const feeds = [];
  const regex = /<outline[^>]*?xmlUrl="([^"]+)"[^>]*?\/?>/g;
  let match;
  const seen = new Set();
  while ((match = regex.exec(xml)) !== null) {
    const block = match[0];
    const url = match[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const text = (block.match(/text="([^"]*)"/) || [])[1] || '';
    const category = (block.match(/category="([^"]*)"/) || [])[1] || 'news';
    const pole = (block.match(/pole="([^"]*)"/) || [])[1] || 'unknown';
    feeds.push({ url, text, category, pole });
  }
  return feeds;
}

async function parseUrlsToCheck() {
  const content = await fs.readFile(CONFIG.urlsToCheckPath, 'utf-8');
  const lines = content.split('\n');
  const urls = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (!line.startsWith('http')) continue;
    urls.push({ url: line, text: '', category: 'news', pole: 'unknown' });
  }
  return urls;
}

function isWestern(domain) {
  const d = domain.toLowerCase();
  return WESTERN_HINTS.some((h) => d.includes(h));
}

async function checkUrl(url, timeoutMs, agent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const opts = {
      method: 'GET',
      headers: { 'User-Agent': CONFIG.userAgent, 'Accept': CONFIG.acceptHeader },
      signal: controller.signal,
      redirect: 'follow',
    };
    if (agent) opts.agent = agent;
    const res = await fetch(url, opts);
    const elapsed = Date.now() - t0;
    return { ok: res.ok, status: res.status, elapsed_ms: elapsed };
  } catch (e) {
    const elapsed = Date.now() - t0;
    return { ok: false, status: 0, elapsed_ms: elapsed, error: String(e.message || e).slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

let SocksProxyAgent = null;
let torAgent = null;
let torAvailable = false;
let torReason = '';

async function detectTor() {
  try {
    const mod = await import('socks-proxy-agent');
    SocksProxyAgent = mod.SocksProxyAgent;
  } catch {
    torReason = 'socks-proxy-agent не установлен';
    return false;
  }
  const portOk = await new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port: CONFIG.torPort });
    const t = setTimeout(() => { sock.destroy(); resolve(false); }, 2000);
    sock.once('connect', () => { clearTimeout(t); sock.destroy(); resolve(true); });
    sock.once('error', () => { clearTimeout(t); resolve(false); });
  });
  if (portOk === false) {
    torReason = 'порт ' + CONFIG.torPort + ' не слушает';
    return false;
  }
  try {
    torAgent = new SocksProxyAgent('socks5h://127.0.0.1:' + CONFIG.torPort);
    torAvailable = true;
    return true;
  } catch (e) {
    torReason = 'SocksProxyAgent создать не удалось: ' + e.message;
    return false;
  }
}

async function processInParallel(items, parallelism, worker) {
  const results = [];
  let idx = 0;
  let processed = 0;
  const total = items.length;
  const tStart = Date.now();
  async function run() {
    while (idx < total) {
      const myIdx = idx++;
      const item = items[myIdx];
      const result = await worker(item);
      results.push({ ...result, index: myIdx });
      processed++;
      if (processed % 10 === 0 || processed === total) {
        const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        progress(`[${processed}/${total}] ${elapsed}s`);
      }
    }
  }
  const workers = Array.from({ length: Math.min(parallelism, total) }, () => run());
  await Promise.all(workers);
  return results;
}

export async function checkUrls() {
  progress('=== check-urls.mjs v2.0.0 ===');
  progress(`Источник: ${ARGS.source}`);
  progress(`Опции: limit=${ARGS.limit || 'none'} timeout=${CONFIG.timeoutMs}ms parallel=${CONFIG.parallel}`);

  let feeds;
  if (ARGS.source === 'urls-to-check') {
    feeds = await parseUrlsToCheck();
  } else if (ARGS.source === 'unified') {
    feeds = await parseOpmlFromFile(CONFIG.opmlUnifiedPath);
  } else {
    feeds = await parseOpml();
  }
  progress(`Найдено URL: ${feeds.length}`);

  if (ARGS.limit) {
    feeds = feeds.slice(0, ARGS.limit);
    progress(`Ограничено до ${feeds.length}`);
  }

  const ok = await detectTor();
  progress(`Tor: ${ok ? `OK (порт ${CONFIG.torPort})` : `нет (${torReason})`}`);

  const t0 = Date.now();
  const results = await processInParallel(feeds, CONFIG.parallel, async (feed) => {
    const domain = feed.url.replace(/^https?:\/\//, '').split('/')[0];
    const direct = await checkUrl(feed.url, CONFIG.timeoutMs, null);
    let torResult = null;
    if (torAvailable && !direct.ok) {
      torResult = await checkUrl(feed.url, CONFIG.torProbeMs, torAgent);
    }
    let category = 'dead';
    if (direct.ok) category = 'direct';
    else if (torResult && torResult.ok) category = 'tor';
    else if (!direct.ok && isWestern(domain)) category = 'tor';
    return { feed, direct, tor: torResult, category };
  });

  const counts = { direct: 0, tor: 0, dead: 0 };
  for (const r of results) counts[r.category]++;

  const durationMs = Date.now() - t0;
  const generatedAt = new Date().toISOString();

  const classified = {
    generated_at: generatedAt,
    duration_ms: durationMs,
    source: ARGS.source,
    total: feeds.length,
    counts,
    tor_available: torAvailable,
    tor_port: torAvailable ? CONFIG.torPort : null,
    results: results.map((r) => ({
      url: r.feed.url,
      text: r.feed.text,
      pole: r.feed.pole,
      category: r.category,
      direct: r.direct,
      tor: r.tor,
    })),
  };

  await fs.writeFile(CONFIG.outClassified, JSON.stringify(classified, null, 2), 'utf-8');

  const directLines = ['# Прямой список (direct)', `# Обновлено: ${generatedAt}`, '# Сгенерировано: check-urls.mjs v2.0.0', ''];
  const torLines = ['# Западный список (Tor-only)', `# Обновлено: ${generatedAt}`, '# Сгенерировано: check-urls.mjs v2.0.0', ''];
  const deadLines = ['# Отбраковка (не работает нигде)', `# Обновлено: ${generatedAt}`, '# Сгенерировано: check-urls.mjs v2.0.0', ''];
  for (const r of results) {
    if (r.category === 'direct') directLines.push(r.feed.url);
    else if (r.category === 'tor') torLines.push(r.feed.url);
    else deadLines.push(r.feed.url);
  }

  await fs.writeFile(CONFIG.outDirect, directLines.join('\n') + '\n', 'utf-8');
  await fs.writeFile(CONFIG.outTor, torLines.join('\n') + '\n', 'utf-8');
  await fs.writeFile(CONFIG.outDead, deadLines.join('\n') + '\n', 'utf-8');

  progress('');
  progress('=== ИТОГ ===');
  progress(`direct: ${counts.direct}`);
  progress(`tor:    ${counts.tor}`);
  progress(`dead:   ${counts.dead}`);
  progress(`Всего:  ${feeds.length}`);
  progress(`Время:  ${(durationMs / 1000).toFixed(1)}s`);

  return classified;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkUrls().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e); process.exit(1); });
}
