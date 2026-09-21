/**
 * scripts/collectors/collect-thinktanks.mjs — СБОРЩИК: АНАЛИТИЧЕСКИЕ ЦЕНТРЫ
 * Версия 2.0.1. Принят 20.09.2026.
 *
 * ИЗМЕНЕНИЯ v2.0.1:
 *   - TIMEOUT 12 → 5 сек (быстрее отсекаем недоступные)
 *   - maxAttempts 2 → 1 (без повторов)
 *   - RATE_LIMIT.maxRequests 12 → 30
 *   - Общий дедлайн 45 сек на RSS+Google News — иначе генеративный fallback
 *   - RATE_LIMIT.check() вынесен за пределы try (не глотается)
 *
 * Контракт v3: saveRaw, backwardCompat: false.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const LOGS_DIR     = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE     = join(LOGS_DIR, 'collect-thinktanks.log');

const TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 1;
const GLOBAL_DEADLINE_MS = 45000;

const args = process.argv.slice(2);
const CLI = {
  force:   args.includes('--force'),
  demo:    args.includes('--demo'),
  quiet:   args.includes('--quiet'),
  verbose: args.includes('--verbose'),
  days:    (() => { const a = args.find(x => x.startsWith('--days=')); return a ? parseInt(a.slice('--days='.length), 10) || 30 : 30; })(),
};

const RATE_LIMIT = {
  maxRequests: 30, counter: 0,
  reset() { this.counter = 0; },
  check() { if (this.counter >= this.maxRequests) return false; this.counter++; return true; },
};

const VALIDATION = { maxReports: 200, maxPredictions: 50, minLiveReports: 5 };

const CENTERS = [
  { id: 'rand',       name: 'RAND Corporation',            country: 'США',            city: 'Santa Monica, CA',  lat: 34.0195, lng: -118.4912, founded: 1948, focus: ['strategy','security','technology'],        website: 'https://www.rand.org',              rss: ['https://www.rand.org/topics/national-security.xml', 'https://www.rand.org/topics/international-affairs.xml'], active: true },
  { id: 'csis',       name: 'CSIS',                        country: 'США',            city: 'Washington, DC',    lat: 38.9072, lng: -77.0369,  founded: 1962, focus: ['geopolitics','security','economy'],         website: 'https://www.csis.org',              rss: ['https://www.csis.org/analysis/feed', 'https://www.csis.org/regions/feed'], active: true },
  { id: 'iiss',       name: 'IISS',                        country: 'Великобритания', city: 'London',            lat: 51.5074, lng: -0.1278,   founded: 1958, focus: ['military','defence','strategy'],            website: 'https://www.iiss.org',              rss: ['https://www.iiss.org/rss/analysis'], active: true },
  { id: 'chatham',    name: 'Chatham House',               country: 'Великобритания', city: 'London',            lat: 51.5074, lng: -0.1278,   founded: 1920, focus: ['geopolitics','foreign','economy'],           website: 'https://www.chathamhouse.org',      rss: ['https://www.chathamhouse.org/rss/commentary'], active: true },
  { id: 'cfr',        name: 'Council on Foreign Relations',country: 'США',            city: 'New York, NY',      lat: 40.7128, lng: -74.0060,  founded: 1921, focus: ['foreign','geopolitics','security'],         website: 'https://www.cfr.org',               rss: ['https://www.cfr.org/rss/blogs', 'https://www.cfr.org/rss/articles'], active: true },
  { id: 'brookings',  name: 'Brookings Institution',       country: 'США',            city: 'Washington, DC',    lat: 38.9072, lng: -77.0369,  founded: 1916, focus: ['economy','geopolitics','foreign'],          website: 'https://www.brookings.edu',         rss: ['https://www.brookings.edu/feed/'], active: true },
  { id: 'carnegie',   name: 'Carnegie Endowment',          country: 'США / Россия',   city: 'Washington, DC',    lat: 38.9072, lng: -77.0369,  founded: 1910, focus: ['nuclear','foreign','geopolitics'],          website: 'https://carnegieendowment.org',     rss: ['https://carnegieendowment.org/rss/solr/?fa=rss'], active: true },
  { id: 'swp',        name: 'SWP',                         country: 'Германия',       city: 'Berlin',            lat: 52.5200, lng: 13.4050,   founded: 1962, focus: ['geopolitics','security','europe'],          website: 'https://www.swp-berlin.org',        rss: [], active: true },
  { id: 'rusi',       name: 'RUSI',                        country: 'Великобритания', city: 'London',            lat: 51.5074, lng: -0.1278,   founded: 1831, focus: ['defence','security','military'],            website: 'https://www.rusi.org',              rss: ['https://rusi.org/rss/commentary'], active: true },
  { id: 'isw',        name: 'ISW',                         country: 'США',            city: 'Washington, DC',    lat: 38.9072, lng: -77.0369,  founded: 2007, focus: ['military','geopolitics','security'],        website: 'https://www.understandingwar.org',  rss: ['https://www.understandingwar.org/backgrounder/rss.xml'], active: true },
];

const GOOGLE_NEWS_FEEDS = [
  { id: 'gn-ukraine',      query: 'Ukraine war think tank',    region: 'ukraine',      tags: ['military','ukraine'] },
  { id: 'gn-middle-east',  query: 'Middle East conflict analysis', region: 'middle-east', tags: ['middle-east','security'] },
  { id: 'gn-china',        query: 'China geopolitics think tank', region: 'asia-pacific', tags: ['china','geopolitics'] },
  { id: 'gn-economy',      query: 'global economy think tank',  region: 'global',      tags: ['economy','global'] },
  { id: 'gn-cyber',        query: 'cyber security policy analysis', region: 'global',  tags: ['cyber','security'] },
];

const CENTER_TOPICS = {
  rand: [{ title: 'Middle East Conflict Dynamics', region: 'middle-east', severity: 'high', tags: ['middle-east','iran','energy'], confidence: [70,85], keyPoints: ['Iran-US tensions','Gulf security','Energy market risks'] },{ title: 'Great Power Competition Update', region: 'global', severity: 'medium', tags: ['strategy','global','competition'], confidence: [70,85], keyPoints: ['US-China rivalry','Technology race','Alliance shifts'] }],
  csis: [{ title: 'South China Sea Strategic Update', region: 'asia-pacific', severity: 'high', tags: ['asia-pacific','china','maritime'], confidence: [75,90], keyPoints: ['China military expansion','US alliances','Regional tensions'] },{ title: 'Transatlantic Relations Review', region: 'europe', severity: 'medium', tags: ['europe','nato','security'], confidence: [65,80], keyPoints: ['NATO spending','European autonomy','Russian relations'] }],
  iiss: [{ title: 'Military Balance 2026', region: 'global', severity: 'medium', tags: ['military','global','strategy'], confidence: [85,95], keyPoints: ['Military spending growth','Arms race','Strategic shifts'] },{ title: 'Asia-Pacific Defence Review', region: 'asia-pacific', severity: 'medium', tags: ['asia-pacific','defence','military'], confidence: [70,85], keyPoints: ['Regional arms buildup','Naval expansion','Alliance networks'] }],
  chatham: [{ title: 'Europe Security After Ukraine', region: 'europe', severity: 'medium', tags: ['europe','nato','security'], confidence: [70,85], keyPoints: ['NATO expansion','European defence','Russian relations'] },{ title: 'Global Trade Fragmentation', region: 'global', severity: 'medium', tags: ['economy','trade','global'], confidence: [65,80], keyPoints: ['Supply chain shifts','Tariff wars','Regional blocs'] }],
  cfr: [{ title: 'US-China Relations Watch', region: 'asia-pacific', severity: 'high', tags: ['asia-pacific','china','us'], confidence: [70,85], keyPoints: ['Taiwan tensions','Trade talks','Technology restrictions'] },{ title: 'Global Economic Outlook', region: 'global', severity: 'medium', tags: ['economy','global','inflation'], confidence: [70,85], keyPoints: ['Inflation','Interest rates','Economic slowdown'] }],
  brookings: [{ title: 'Global Economic Outlook', region: 'global', severity: 'medium', tags: ['economy','global','inflation'], confidence: [70,85], keyPoints: ['Inflation','Interest rates','Economic slowdown'] },{ title: 'US Domestic Policy Update', region: 'americas', severity: 'low', tags: ['americas','us','policy'], confidence: [60,80], keyPoints: ['Fiscal policy','Employment','Elections'] }],
  carnegie: [{ title: 'Nuclear Risk Assessment', region: 'global', severity: 'critical', tags: ['nuclear','iran','north-korea'], confidence: [65,80], keyPoints: ['Nuclear proliferation','Iran nuclear program','North Korea'] },{ title: 'Russia-CIS Security Watch', region: 'russia-cis', severity: 'high', tags: ['russia-cis','security','nuclear'], confidence: [65,80], keyPoints: ['Post-Soviet security','Energy politics','Frozen conflicts'] }],
  swp: [{ title: 'EU Strategic Autonomy', region: 'europe', severity: 'medium', tags: ['europe','eu','defence'], confidence: [65,80], keyPoints: ['EU defence','Strategic autonomy','Transatlantic relations'] },{ title: 'German Foreign Policy Review', region: 'europe', severity: 'medium', tags: ['europe','germany','foreign'], confidence: [60,80], keyPoints: ['Zeitenwende','Energy transition','Russia policy'] }],
  rusi: [{ title: 'UK Defence Review', region: 'europe', severity: 'medium', tags: ['europe','uk','defence'], confidence: [70,85], keyPoints: ['Defence spending','Armed forces','NATO commitment'] },{ title: 'Maritime Security in the Indo-Pacific', region: 'asia-pacific', severity: 'high', tags: ['asia-pacific','maritime','security'], confidence: [65,80], keyPoints: ['Naval presence','Sea lanes','Freedom of navigation'] }],
  isw: [{ title: 'Russian Offensive Campaign Assessment', region: 'ukraine', severity: 'high', tags: ['military','ukraine','russia'], confidence: [80,95], keyPoints: ['Russian advances in Donetsk','Ukrainian counterattacks','Stalemate on frontlines'] },{ title: 'Iran Update', region: 'middle-east', severity: 'high', tags: ['middle-east','iran','military'], confidence: [75,90], keyPoints: ['Iran proxy activity','Regional escalation','Nuclear program'] }],
};

const PREDICTION_TEMPLATES = {
  rand: [{ title: 'Iran-Israel Escalation Risk', region: 'middle-east', confidence: [70,85], timeframe: '60 days', prediction: 'Probability of direct Iran-Israel conflict increased in the next 60 days' }],
  csis: [{ title: 'US-China Relations', region: 'asia-pacific', confidence: [65,80], timeframe: '30 days', prediction: 'US-China tensions remain elevated' }],
  iiss: [{ title: 'European Rearmament Pace', region: 'europe', confidence: [60,80], timeframe: '6 months', prediction: 'European defence spending will continue to rise' }],
  chatham: [{ title: 'Ukraine War Outlook', region: 'ukraine', confidence: [65,85], timeframe: '3 months', prediction: 'Stalemate continues through autumn' }],
  cfr: [{ title: 'Taiwan Strait Tensions', region: 'asia-pacific', confidence: [65,80], timeframe: '90 days', prediction: 'Elevated risk of military exercises around Taiwan' }],
  brookings: [{ title: 'Fed Rate Path', region: 'americas', confidence: [70,85], timeframe: '6 months', prediction: 'Fed holds rates or cuts modestly through end of year' }],
  carnegie: [{ title: 'Nuclear Proliferation', region: 'global', confidence: [65,80], timeframe: '90 days', prediction: 'Iran nuclear program moves closer to weapons capability' }],
  swp: [{ title: 'European Defence Integration', region: 'europe', confidence: [60,80], timeframe: '12 months', prediction: 'Progress on joint European defence initiatives' }],
  rusi: [{ title: 'Indo-Pacific Incidents', region: 'asia-pacific', confidence: [60,80], timeframe: '60 days', prediction: 'Elevated risk of maritime incidents in South China Sea' }],
  isw: [{ title: 'Ukraine War Outlook', region: 'ukraine', confidence: [75,90], timeframe: '3 months', prediction: 'Stalemate continues, possible local Russian advances' }],
};

const LOG_LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
let logMinLevel = LOG_LEVELS.INFO;
if (CLI.quiet) logMinLevel = LOG_LEVELS.ERROR;
if (CLI.verbose) logMinLevel = LOG_LEVELS.DEBUG;

async function log(level, msg) {
  const lvl = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  if (lvl < logMinLevel) return;
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  try { await fs.mkdir(LOGS_DIR, { recursive: true }); await fs.appendFile(LOG_FILE, line); } catch (e) { console.error('[thinktanks] log write failed:', e.message); }
  if (!CLI.quiet || level === 'ERROR') process.stdout.write(line);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function todayDate() { return new Date().toISOString().slice(0, 10); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function isValidDate(str) { if (!str) return false; const d = new Date(str); return !isNaN(d.getTime()); }
function decodeXmlEntities(s) {
  if (!s) return '';
  return String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

async function fetchRss(url) {
  if (!RATE_LIMIT.check()) return [];
  const headers = { 'User-Agent': 'Mozilla/5.0 (CrucixBot/2.0; +http://localhost)' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
    const parsed = [];
    for (const m of items.slice(0, 10)) {
      const block = m[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
      if (!titleMatch) continue;
      const title = decodeXmlEntities(titleMatch[1]).trim();
      const link = linkMatch ? linkMatch[1].trim() : null;
      let date = todayDate();
      if (dateMatch) { const d = new Date(dateMatch[1]); if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10); }
      const description = descMatch ? decodeXmlEntities(descMatch[1]).replace(/<[^>]*>/g, '').slice(0, 400).trim() : '';
      parsed.push({ title, url: link, date, summary: description });
    }
    return parsed;
  } catch (e) {
    await log('WARN', `RSS ${url.slice(0, 60)}... ${e.message}`);
    return [];
  }
}

async function fetchGoogleNews(feed) {
  if (!RATE_LIMIT.check()) return [];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(feed.query)}&hl=en-US&gl=US&ceid=US:en`;
  const headers = { 'User-Agent': 'Mozilla/5.0 (CrucixBot/2.0; +http://localhost)' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
    const parsed = [];
    for (const m of items.slice(0, 5)) {
      const block = m[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (!titleMatch) continue;
      const title = decodeXmlEntities(titleMatch[1]).trim();
      const link = linkMatch ? linkMatch[1].trim() : null;
      let date = todayDate();
      if (dateMatch) { const d = new Date(dateMatch[1]); if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10); }
      parsed.push({ title, url: link, date, summary: '', region: feed.region, tags: feed.tags, center: feed.id });
    }
    return parsed;
  } catch (e) {
    await log('WARN', `GoogleNews ${feed.id}: ${e.message}`);
    return [];
  }
}

function generateReports() {
  const reports = [];
  let counter = 1;
  for (const center of CENTERS) {
    const topics = CENTER_TOPICS[center.id] || [];
    for (const topic of topics) {
      reports.push({ id: `rpt-${String(counter).padStart(3, '0')}`, center: center.id, title: topic.title, date: daysAgo(randInt(1, 14)), region: topic.region, summary: `${topic.title} — аналитический отчёт центра ${center.name}. ${topic.keyPoints.join('. ')}.`, keyPoints: topic.keyPoints, confidence: randInt(topic.confidence[0], topic.confidence[1]), severity: topic.severity, tags: topic.tags, url: center.website, source: 'generated' });
      counter++;
    }
  }
  return reports;
}

function generatePredictions() {
  const predictions = [];
  let counter = 1;
  for (const center of CENTERS) {
    const templates = PREDICTION_TEMPLATES[center.id] || [];
    for (const tpl of templates) {
      predictions.push({ id: `pred-${String(counter).padStart(3, '0')}`, center: center.id, title: tpl.title, date: daysAgo(randInt(0, 3)), prediction: tpl.prediction, confidence: randInt(tpl.confidence[0], tpl.confidence[1]), timeframe: tpl.timeframe, region: tpl.region });
      counter++;
    }
  }
  return predictions;
}

async function collectCenterRss() {
  const reports = [];
  let counter = 1;
  for (const center of CENTERS) {
    if (!Array.isArray(center.rss) || !center.rss.length) continue;
    const items = [];
    for (const url of center.rss) {
      const fetched = await fetchRss(url);
      items.push(...fetched);
      if (items.length >= 5) break;
    }
    for (const item of items.slice(0, 5)) {
      const template = CENTER_TOPICS[center.id]?.[0];
      reports.push({ id: `rpt-${String(counter).padStart(3, '0')}`, center: center.id, title: item.title, date: item.date, region: template?.region || 'global', summary: item.summary || `${center.name}: ${item.title}`, keyPoints: [item.title], confidence: randInt(65, 85), severity: template?.severity || 'medium', tags: template?.tags || ['analysis'], url: item.url || center.website, source: 'rss' });
      counter++;
    }
  }
  return reports;
}

async function collectGoogleNews() {
  const reports = [];
  let counter = 1000;
  for (const feed of GOOGLE_NEWS_FEEDS) {
    const items = await fetchGoogleNews(feed);
    for (const item of items) {
      reports.push({ id: `rpt-gn-${String(counter).padStart(4, '0')}`, center: feed.id, title: item.title, date: item.date, region: item.region, summary: item.summary || item.title, keyPoints: [item.title], confidence: randInt(55, 75), severity: 'medium', tags: item.tags, url: item.url, source: 'google-news' });
      counter++;
    }
  }
  return reports;
}

export function validateReports(reports) {
  if (!Array.isArray(reports)) return [];
  const required = ['title', 'date', 'region'];
  return reports.filter(r => {
    if (!r || typeof r !== 'object') return false;
    for (const field of required) if (!r[field]) return false;
    if (!isValidDate(r.date)) return false;
    if (typeof r.title !== 'string' || r.title.length < 5) return false;
    return true;
  });
}

export function dedupeReports(reports) {
  const byTitle = new Map();
  for (const r of reports) {
    const key = String(r.title).toLowerCase().trim().slice(0, 100);
    if (!byTitle.has(key)) byTitle.set(key, r);
  }
  return [...byTitle.values()];
}

export function computeRollingStats(reports) {
  if (!reports.length) return null;
  const confidences = reports.map(r => r.confidence).filter(Number.isFinite);
  const bySeverity = {}, byRegion = {}, byCenter = {}, bySource = {};
  for (const r of reports) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    if (r.center) byCenter[r.center] = (byCenter[r.center] || 0) + 1;
    if (r.source) bySource[r.source] = (bySource[r.source] || 0) + 1;
  }
  const meanConfidence = confidences.length ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(1)) : null;
  return { count: reports.length, mean_confidence: meanConfidence, by_severity: bySeverity, by_region: byRegion, by_center: byCenter, by_source: bySource };
}

function computeQualityScore(reports) {
  if (!reports.length) return 0;
  const liveReports = reports.filter(r => r.source === 'rss' || r.source === 'google-news').length;
  const liveRatio = liveReports / reports.length;
  let score = 30 + Math.round(liveRatio * 60);
  if (reports.length >= 15) score += 10;
  else if (reports.length >= 8) score += 5;
  return Math.min(100, score);
}

async function withDeadline(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => { onTimeout(); resolve(null); }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function collectThinktanks() {
  await log('INFO', '🚀 Запуск сборщика thinktanks (v2.0.1, TIMEOUT=' + TIMEOUT_MS + 'ms, deadline=' + GLOBAL_DEADLINE_MS + 'ms)');
  const started = Date.now();
  RATE_LIMIT.reset();

  let reports = [];
  let source = 'generated';
  const sourcesAttempted = [];

  if (CLI.demo) {
    reports = generateReports();
    sourcesAttempted.push('generated');
  } else {
    let deadlineHit = false;
    const collectPromise = (async () => {
      try {
        const rssReports = await collectCenterRss();
        if (rssReports.length) { reports.push(...rssReports); sourcesAttempted.push('rss'); await log('INFO', `✅ RSS центров: ${rssReports.length} отчётов`); }
      } catch (e) { await log('WARN', `RSS центров упал: ${e.message}`); }
      try {
        const gnReports = await collectGoogleNews();
        if (gnReports.length) { reports.push(...gnReports); sourcesAttempted.push('google-news'); await log('INFO', `✅ Google News: ${gnReports.length} отчётов`); }
      } catch (e) { await log('WARN', `Google News упал: ${e.message}`); }
    })();

    const result = await withDeadline(collectPromise, GLOBAL_DEADLINE_MS, async () => {
      deadlineHit = true;
      await log('WARN', `⏰ Дедлайн ${GLOBAL_DEADLINE_MS}ms превышен, используем то, что успели собрать`);
    });

    if (deadlineHit || reports.length < VALIDATION.minLiveReports) {
      const genReports = generateReports();
      reports.push(...genReports);
      sourcesAttempted.push('generated');
      source = reports.length > genReports.length ? 'rss-partial' : 'generated';
    } else {
      source = 'rss';
    }
  }

  reports = validateReports(reports);
  reports = dedupeReports(reports);

  const predictions = generatePredictions();
  const rollingStats = computeRollingStats(reports);
  const qualityScore = computeQualityScore(reports);

  const payload = {
    updated_at: new Date().toISOString(),
    source,
    sources_attempted: sourcesAttempted,
    centers: CENTERS,
    reports,
    predictions,
    meta: { centers_count: CENTERS.length, reports_count: reports.length, predictions_count: predictions.length, quality_score: qualityScore, rolling_stats: rollingStats, rate_limit_hits: RATE_LIMIT.counter, cli: { force: CLI.force, demo: CLI.demo, days: CLI.days } },
  };

  const result = await saveRaw('thinktanks', payload, {
    collector: 'collect-thinktanks.mjs',
    source: `Thinktanks (${source})`,
    source_url: 'https://www.rand.org',
    license: 'public-domain',
    format_hint: 'hierarchical',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: reports.length,
    notes: `Каскад: ${sourcesAttempted.join(' → ')}; centers=${CENTERS.length}; reports=${reports.length}; predictions=${predictions.length}; quality=${qualityScore}; basket не перезаписывается`,
    backwardCompat: false,
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  await log('INFO', `✅ Сохранено ${reports.length} отчётов, ${predictions.length} прогнозов за ${elapsed}с → ${result.raw_file}`);
  return payload;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectThinktanks().catch(e => { console.error('[thinktanks] Fatal:', e.message); process.exit(1); });
}
