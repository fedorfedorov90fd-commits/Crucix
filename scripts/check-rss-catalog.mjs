#!/usr/bin/env node
// scripts/check-rss-catalog.mjs
// Перепроверка rss-catalog.json. По умолчанию — только записи старше 7 дней.
// Использование:
//   node scripts/check-rss-catalog.mjs                (проверить всё старое, 7+ дней)
//   node scripts/check-rss-catalog.mjs --all          (проверить все записи)
//   node scripts/check-rss-catalog.mjs --id=tass-ru   (проверить одну запись)
//   node scripts/check-rss-catalog.mjs --days=1       (порог давности 1 день)
//   node scripts/check-rss-catalog.mjs --status=ok    (фильтр по статусу)
//   node scripts/check-rss-catalog.mjs --dry          (не сохранять, только показать)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'feeds', 'rss-catalog.json');
const LOG_DIR = path.join(ROOT, 'logs', 'rss-catalog');
const BACKUP_DIR = path.join(ROOT, 'backups', 'rss-catalog');

const argv = process.argv.slice(2);
const FLAG_ALL    = argv.includes('--all');
const FLAG_DRY    = argv.includes('--dry');
const ARG_ID      = (argv.find(a => a.startsWith('--id=')) || '').slice(5);
const ARG_STATUS  = (argv.find(a => a.startsWith('--status=')) || '').slice(9);
const ARG_DAYS    = parseInt((argv.find(a => a.startsWith('--days=')) || '--days=7').slice(7), 10);
const DAYS_MS     = ARG_DAYS * 24 * 60 * 60 * 1000;
const TIMEOUT_MS  = 8000;
const USER_AGENT  = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 CrucixRSS/1.0';

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error('Каталог не найден: ' + CATALOG_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

function saveCatalog(catalog) {
  ensureDir(BACKUP_DIR);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(BACKUP_DIR, 'rss-catalog.' + ts + '.json');
  fs.copyFileSync(CATALOG_PATH, backup);
  catalog.updated_at = new Date().toISOString();
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  return backup;
}

function needsCheck(entry) {
  if (FLAG_ALL) return true;
  if (!entry.checked_at) return true;
  const age = Date.now() - new Date(entry.checked_at).getTime();
  return age > DAYS_MS;
}

async function pingUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
      signal: controller.signal
    });
    clearTimeout(timer);
    const finalUrl = res.url || url;
    const redirected = finalUrl !== url;
    return { http_code: res.status, final_url: finalUrl, redirected };
  } catch (e) {
    clearTimeout(timer);
    return { http_code: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  }
}

function classify(httpCode) {
  if (httpCode === 200) return 'ok';
  if (httpCode === 301 || httpCode === 302 || httpCode === 307 || httpCode === 308) return 'redirect';
  if (httpCode === 0) return 'blocked';
  if (httpCode === 403) return 'dead';
  if (httpCode === 404) return 'dead';
  return 'unknown';
}

async function main() {
  ensureDir(LOG_DIR);
  const catalog = loadCatalog();
  const entries = catalog.entries || [];

  let targets = entries.filter(e => {
    if (ARG_ID) return e.id === ARG_ID;
    if (ARG_STATUS) return e.status === ARG_STATUS;
    return needsCheck(e);
  });

  if (targets.length === 0) {
    console.log('Нечего проверять. Все записи свежие. Используй --all для полной проверки.');
    return;
  }

  console.log('Проверка ' + targets.length + ' из ' + entries.length + ' записей. Порог: ' + ARG_DAYS + ' дней.');
  const results = [];
  let changed = 0;

  for (const entry of targets) {
    const { http_code, final_url, redirected, error } = await pingUrl(entry.url);
    const newStatus = classify(http_code);
    const oldStatus = entry.status;
    const now = new Date().toISOString();

    entry.http_code = http_code;
    entry.status = newStatus;
    entry.checked_at = now;
    if (redirected && final_url) {
      if (!entry.original_url) entry.original_url = entry.url;
      entry.redirect_to = final_url;
      entry.url = final_url;
    }
    if (error) entry.last_error = error;
    else delete entry.last_error;

    if (oldStatus !== newStatus) {
      changed++;
      console.log('  [' + oldStatus + ' -> ' + newStatus + '] ' + entry.id + ' (' + http_code + ')' + (redirected ? ' -> ' + final_url : ''));
    } else {
      console.log('  [' + newStatus + '] ' + entry.id + ' (' + http_code + ')' + (redirected ? ' -> ' + final_url : ''));
    }

    results.push({ id: entry.id, url: entry.url, http_code, status: newStatus, final_url: final_url || null, redirected, error: error || null });
    await new Promise(r => setTimeout(r, 250));
  }

  const summary = {
    checked_at: new Date().toISOString(),
    threshold_days: ARG_DAYS,
    total_in_catalog: entries.length,
    checked: targets.length,
    changed: changed,
    by_status: results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    details: results
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(LOG_DIR, 'check-' + ts + '.json');
  fs.writeFileSync(logPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('');
  console.log('Итог: проверено ' + targets.length + ', изменений ' + changed + '.');
  console.log('Сводка по статусам: ' + JSON.stringify(summary.by_status));
  console.log('Лог: ' + logPath);

  if (FLAG_DRY) {
    console.log('Режим --dry: каталог НЕ сохранён.');
  } else {
    const backup = saveCatalog(catalog);
    console.log('Каталог сохранён. Бэкап: ' + backup);
  }
}

main().catch(e => { console.error('Ошибка: ' + e.message); process.exit(1); });
