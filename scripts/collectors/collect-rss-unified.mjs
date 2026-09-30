#!/usr/bin/env node
/**
 * Crucix Collector: rss-unified — единый RSS-сборщик Contract-v3 pipeline.
 * Версия 3.1.0.
 *
 * Назначение: читает feeds-unified.opml (210 URL), использует urls-classified.json
 * для маршрутизации direct/Tor, собирает новости, пишет через saveRaw.
 *
 * ПРИНАДЛЕЖИТ: Contract-v3 pipeline (docs/architecture/rss-pipelines.md).
 * НЕ ПРИНАДЛЕЖИТ: SmartScroll pipeline.
 *
 * Ключевое:
 *   - backwardCompat: false (не обнуляет basket, правило #14.1)
 *   - без slice(0, 500) — сохраняет все items (как collect-feeds.mjs)
 *   - маршрутизация: direct → fetch напрямую, tor → SocksProxyAgent
 *   - детекция кодировки cp1251/koi8-r/utf-8 из XML declaration
 *   - circuit breaker из feeds-status.json (2 ошибки → cooldown 5 мин)
 *   - параллелизм: direct 10, tor 5
 *   - timeout 8000 мс (увеличен после аномалии с 301-редиректами)
 *   - дедупликация по md5(link + pubDate)
 *   - прогресс-лог каждые 10
 *
 * CLI:
 *   node collect-rss-unified.mjs                     полный прогон 210 URL
 *   node collect-rss-unified.mjs --limit=30          первые 30
 *   node collect-rss-unified.mjs --only=direct       только direct
 *   node collect-rss-unified.mjs --timeout=10000     таймаут 10 сек
 *   node collect-rss-unified.mjs --dry               без записи в raw
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const CONFIG = {
  opmlPath: join(ROOT, 'data', 'feeds', 'feeds-unified.opml'),
  classifiedPath: join(ROOT, 'data', 'feeds', 'urls-classified.json'),
  statusPath: join(ROOT, 'data', 'feeds', 'feeds-status.json'),
  logsDir: join(ROOT, 'logs', 'collectors'),
  logFile: join(ROOT, 'logs', 'collectors', 'collect-rss-unified.log'),
  parallelDirect: 10,
  parallelTor: 5,
  timeoutMs: 8000,
  torPort: 9050,
  cooldownMs: 5 * 60 * 1000,
  maxFailures: 2,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  acceptHeader: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
};

function parseArgs(argv) {
  const args = { limit: null, timeout: null, verbose: false, only: null, dry: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--timeout=')) args.timeout = parseInt(a.split('=')[1], 10);
    else if (a === '--verbose') args.verbose = true;
    else if (a.startsWith('--only=')) args.only = a.split('=')[1];
    else if (a === '--dry') args.dry = true;
  }
  return args;
}
const ARGS = parseArgs(process.argv);
if (ARGS.timeout) CONFIG.timeoutMs = ARGS.timeout;

async function log(msg, level = 'INFO') {
  const line = '[' + new Date().toISOString() + '] [' + level + '] ' + msg + '\n';
  try {
    await fs.mkdir(CONFIG.logsDir, { recursive: true });
    await fs.appendFile(CONFIG.logFile, line);
  } catch {}
  if (ARGS.verbose || level !== 'INFO') process.stdout.write(line);
}

function progress(msg) { process.stdout.write(msg + '\n'); }

// ─── OPML ────────────────────────────────────────────────────
async function parseOpml() {
  const xml = await fs.readFile(CONFIG.opmlPath, 'utf-8');
  const feeds = [];
  const regex = /<outline[^>]*?xmlUrl="([^"]+)"[^>]*?\/?>/g;
  let m;
  const seen = new Set();
  while ((m = regex.exec(xml)) !== null) {
    const block = m[0];
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const text = (block.match(/text="([^"]*)"/) || [])[1] || '';
    const category = (block.match(/category="([^"]*)"/) || [])[1] || 'news';
    const pole = (block.match(/pole="([^"]*)"/) || [])[1] || 'unknown';
    feeds.push({ url, text, category, pole });
  }
  return feeds;
}

// ─── КЛАССИФИКАЦИЯ ───────────────────────────────────────────
async function loadClassification() {
  try {
    const raw = await fs.readFile(CONFIG.classifiedPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const map = new Map();
    for (const r of (parsed.results || [])) {
      if (r.url && r.category) map.set(r.url, r.category);
    }
    return map;
  } catch {
    return new Map();
  }
}

// ─── CIRCUIT BREAKER ────────────────────────────────────────
async function loadStatus() {
  try {
    const raw = await fs.readFile(CONFIG.statusPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.feeds || {};
  } catch { return {}; }
}

async function saveStatus(status) {
  const payload = {
    generated_at: new Date().toISOString(),
    total: Object.keys(status).length,
    feeds: status,
  };
  await fs.writeFile(CONFIG.statusPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function urlKey(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function shouldSkip(url, status) {
  const key = urlKey(url);
  const s = status[key];
  if (!s) return false;
  if (s.cooldown_until && new Date(s.cooldown_until) > new Date()) return true;
  if (s.consecutive_failures >= CONFIG.maxFailures) return true;
  return false;
}

function recordSuccess(url, status, elapsed, itemsCount, meta) {
  const key = urlKey(url);
  const prev = status[key] || {};
  status[key] = {
    url,
    text: meta.text || prev.text || '',
    pole: meta.pole || prev.pole || 'unknown',
    category: meta.category || prev.category || 'news',
    last_success_at: new Date().toISOString(),
    last_failure_at: prev.last_failure_at || null,
    consecutive_failures: 0,
    total_successes: (prev.total_successes || 0) + 1,
    total_failures: prev.total_failures || 0,
    cooldown_until: null,
    last_status: 200,
    last_items_count: itemsCount,
    avg_elapsed_ms: prev.avg_elapsed_ms
      ? Math.round((prev.avg_elapsed_ms * (prev.total_successes || 0) + elapsed) / ((prev.total_successes || 0) + 1))
      : elapsed,
  };
}

function recordFailure(url, status, error, meta) {
  const key = urlKey(url);
  const prev = status[key] || {};
  const failures = (prev.consecutive_failures || 0) + 1;
  const now = new Date();
  const cooldown = failures >= CONFIG.maxFailures
    ? new Date(now.getTime() + CONFIG.cooldownMs).toISOString()
    : null;
  status[key] = {
    url,
    text: meta.text || prev.text || '',
    pole: meta.pole || prev.pole || 'unknown',
    category: meta.category || prev.category || 'news',
    last_success_at: prev.last_success_at || null,
    last_failure_at: now.toISOString(),
    consecutive_failures: failures,
    total_successes: prev.total_successes || 0,
    total_failures: (prev.total_failures || 0) + 1,
    cooldown_until: cooldown,
    last_status: 0,
    last_error: String(error).slice(0, 200),
    avg_elapsed_ms: prev.avg_elapsed_ms || null,
  };
}

// ─── TOR ────────────────────────────────────────────────────
let torAgent = null;
let torAvailable = false;

async function detectTor() {
  try {
    const mod = await import('socks-proxy-agent');
    const portOk = await new Promise((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port: CONFIG.torPort });
      const t = setTimeout(() => { sock.destroy(); resolve(false); }, 2000);
      sock.once('connect', () => { clearTimeout(t); sock.destroy(); resolve(true); });
      sock.once('error', () => { clearTimeout(t); resolve(false); });
    });
    if (portOk === false) return false;
    torAgent = new mod.SocksProxyAgent('socks5h://127.0.0.1:' + CONFIG.torPort);
    torAvailable = true;
    return true;
  } catch { return false; }
}

// ─── ENCODING ───────────────────────────────────────────────
function detectEncoding(buffer) {
  const head = buffer.slice(0, 256).toString('ascii').toLowerCase();
  const m = head.match(/encoding=["']([^"']+)["']/);
  if (!m) return 'utf-8';
  const enc = m[1].toLowerCase();
  if (enc === 'windows-1251' || enc === 'cp1251') return 'windows-1251';
  if (enc === 'koi8-r' || enc === 'koi8r') return 'koi8-r';
  return 'utf-8';
}

function decodeBuffer(buffer) {
  const enc = detectEncoding(buffer);
  try {
    const decoder = new TextDecoder(enc, { fatal: false });
    return decoder.decode(buffer);
  } catch {
    return buffer.toString('utf-8');
  }
}

// ─── FETCH ──────────────────────────────────────────────────
async function fetchWithTimeout(url, timeoutMs, agent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts = {
      method: 'GET',
      headers: { 'User-Agent': CONFIG.userAgent, 'Accept': CONFIG.acceptHeader },
      signal: controller.signal,
      redirect: 'follow',
    };
    if (agent) opts.agent = agent;
    const res = await fetch(url, opts);
    if (res.ok === false) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    return decodeBuffer(buf);
  } finally {
    clearTimeout(timer);
  }
}

// ─── RSS PARSER (regex fallback) ────────────────────────────
function parseRss(xml) {
  const items = [];
  const clean = xml.replace(/<!--[\s\S]*?-->/g, '');
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const atomRe = /<entry[\s\S]*?<\/entry>/gi;
  let raw = clean.match(itemRe) || [];
  if (raw.length === 0) raw = clean.match(atomRe) || [];
  for (const block of raw) {
    const get = (tag) => {
      const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
      const m = block.match(re);
      if (!m) return '';
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    };
    const title = get('title');
    const link = get('link') || (block.match(/<link[^>]*href="([^"]*)"/i) || [])[1] || '';
    const pubDate = get('pubDate') || get('published') || get('updated') || '';
    const description = get('description') || get('summary') || get('content') || '';
    if (title === '' && description === '') continue;
    items.push({ title, link, pubDate, description: description.slice(0, 1000) });
  }
  return items;
}

// ─── PROCESS FEED ───────────────────────────────────────────
async function fetchFeed(feed, category) {
  const t0 = Date.now();
  const useTor = category === 'tor';
  const agent = useTor ? torAgent : null;
  try {
    const xml = await fetchWithTimeout(feed.url, CONFIG.timeoutMs, agent);
    const items = parseRss(xml);
    const elapsed = Date.now() - t0;
    const mapped = items.map((it) => {
      const id = createHash('md5').update((it.link || '') + '|' + (it.pubDate || '') + '|' + it.title).digest('hex');
      return {
        id,
        title: (it.title || '').trim(),
        link: (it.link || '').trim(),
        pubDate: it.pubDate || '',
        description: (it.description || '').trim(),
        source: feed.text || feed.url,
        pole: feed.pole || 'unknown',
        category: feed.category || 'news',
        channel: category,
      };
    });
    return { items: mapped, elapsed, meta: feed, category };
  } catch (e) {
    return { items: [], elapsed: Date.now() - t0, error: e, meta: feed, category };
  }
}

// ─── BATCH ──────────────────────────────────────────────────
async function processInParallel(feeds, parallelism, status) {
  const results = [];
  let idx = 0;
  let processed = 0;
  let okCount = 0;
  let failCount = 0;
  let itemsTotal = 0;
  const total = feeds.length;
  const tStart = Date.now();

  async function worker() {
    while (idx < total) {
      const myIdx = idx++;
      const { feed, category } = feeds[myIdx];
      const r = await fetchFeed(feed, category);
      if (r.error) {
        failCount++;
        recordFailure(feed.url, status, r.error.message, feed);
        await log('FAIL [' + category + '] ' + (feed.text || feed.url) + ': ' + r.error.message, 'ERROR');
      } else {
        okCount++;
        itemsTotal += r.items.length;
        recordSuccess(feed.url, status, r.elapsed, r.items.length, feed);
      }
      results.push(r);
      processed++;
      if (processed % 10 === 0 || processed === total) {
        const el = ((Date.now() - tStart) / 1000).toFixed(1);
        progress('[' + processed + '/' + total + '] OK:' + okCount + ' FAIL:' + failCount + ' items:' + itemsTotal + ' (' + el + 's)');
      }
    }
  }

  const workers = Array.from({ length: Math.min(parallelism, total) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── MAIN ───────────────────────────────────────────────────
export async function collectRssUnified() {
  const t0 = Date.now();
  progress('=== collect-rss-unified v3.1.0 ===');
  progress('Contract-v3 pipeline');

  const feeds = await parseOpml();
  progress('OPML: ' + feeds.length + ' лент');
  await log('OPML: ' + feeds.length + ' лент');

  const classification = await loadClassification();
  progress('Классификация: ' + classification.size + ' записей');

  const torOk = await detectTor();
  progress('Tor: ' + (torOk ? 'OK (порт ' + CONFIG.torPort + ')' : 'НЕТ'));

  const status = await loadStatus();

  const directFeeds = [];
  const torFeeds = [];
  let skippedUnavailable = 0;
  let skippedCooldown = 0;

  for (const f of feeds) {
    const cls = classification.get(f.url);
    if (cls === 'dead') { skippedUnavailable++; continue; }
    if (shouldSkip(f.url, status)) { skippedCooldown++; continue; }
    if (cls === 'tor' && torOk === false) { skippedUnavailable++; continue; }
    if (cls === 'tor') torFeeds.push({ feed: f, category: 'tor' });
    else directFeeds.push({ feed: f, category: 'direct' });
  }

  if (ARGS.only === 'direct') torFeeds.length = 0;
  if (ARGS.only === 'tor') directFeeds.length = 0;

  let allFeeds = ARGS.only
    ? (ARGS.only === 'direct' ? directFeeds : torFeeds)
    : directFeeds.concat(torFeeds);

  if (ARGS.limit && allFeeds.length > ARGS.limit) {
    allFeeds = allFeeds.slice(0, ARGS.limit);
  }

  progress('К опросу: ' + allFeeds.length + ' (direct:' + directFeeds.length + ' tor:' + torFeeds.length + ' unavailable:' + skippedUnavailable + ' cooldown:' + skippedCooldown + ')');

  const directList = allFeeds.filter((f) => f.category === 'direct');
  const torList = allFeeds.filter((f) => f.category === 'tor');

  progress('Обработка direct (' + directList.length + ', parallel=' + CONFIG.parallelDirect + ')...');
  const directResults = directList.length > 0 ? await processInParallel(directList, CONFIG.parallelDirect, status) : [];

  progress('Обработка tor (' + torList.length + ', parallel=' + CONFIG.parallelTor + ')...');
  const torResults = torList.length > 0 ? await processInParallel(torList, CONFIG.parallelTor, status) : [];

  const results = directResults.concat(torResults);

  await saveStatus(status);

  const allItems = [];
  let successCount = 0;
  let failCount = 0;
  for (const r of results) {
    if (r.error) failCount++;
    else {
      successCount++;
      for (const it of r.items) allItems.push(it);
    }
  }

  const unique = new Map();
  for (const it of allItems) {
    if (unique.has(it.id) === false) unique.set(it.id, it);
  }
  const finalItems = Array.from(unique.values())
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

  const durationMs = Date.now() - t0;

  progress('');
  progress('=== ИТОГ ===');
  progress('Всего items: ' + finalItems.length + ' (raw ' + allItems.length + ')');
  progress('Успешно: ' + successCount + '/' + allFeeds.length);
  progress('Ошибок: ' + failCount);
  progress('Время: ' + (durationMs / 1000).toFixed(1) + 's');

  await log('Финал: ' + finalItems.length + ' items, ' + successCount + '/' + allFeeds.length + ' OK, ' + failCount + ' FAIL, ' + durationMs + 'ms');

  if (ARGS.dry) {
    progress('--dry: без записи в raw');
    return { total: finalItems.length, items: finalItems, dry: true };
  }

  const { saveRaw } = await import('./lib/collector-helper.mjs');
  const result = await saveRaw('rss', {
    collectedAt: new Date().toISOString(),
    total: finalItems.length,
    raw_total: allItems.length,
    sources_total: feeds.length,
    sources_fetched: allFeeds.length,
    success: successCount,
    failed: failCount,
    skipped_unavailable: skippedUnavailable,
    skipped_cooldown: skippedCooldown,
    duration_ms: durationMs,
    items: finalItems,
  }, {
    collector: 'collect-rss-unified.mjs',
    source: 'RSS via feeds-unified.opml (Contract-v3)',
    source_url: 'file://data/feeds/feeds-unified.opml',
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'event',
    period: null,
    record_count: finalItems.length,
    notes: successCount + '/' + allFeeds.length + ' OK, ' + failCount + ' FAIL, dedup ' + allItems.length + '→' + finalItems.length,
    backwardCompat: false,
  });

  progress('raw: ' + result.raw_file);
  if (result.incoming_file) progress('накладная: ' + result.incoming_file);

  return { total: finalItems.length, items: finalItems, raw_file: result.raw_file };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRssUnified().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e); process.exit(1); });
}
