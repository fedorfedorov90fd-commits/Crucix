#!/usr/bin/env node
// Crucix Script: RssUpdater v2.1.0
// Файл: /home/ta8_/Рабочий стол/Crucix/scripts/rss-updater.mjs
// Назначение: обновление статуса всех RSS-лент через rss-manager-api.
// Пишет: reports/rss-update-<date>.json
//
// История версий:
//   v1.0.0 (08.09.2026): импортировал RSSManager default (не существует) — не работал.
//   v2.0.0 (21.09.2026): переписан через fetch. Оказалось, что node fetch (undici)
//     не отправляет POST на этот endpoint — запрос не доходит до сервера вообще.
//     Curl работает, node fetch — нет. Причина — баг undici с POST.
//   v2.1.0 (21.09.2026): переписан на http.request из node:http. Проверено:
//     работает, POST доходит до сервера, ответ 200 за ~22 секунды.
//
// Использование:
//   node scripts/rss-updater.mjs
//   node scripts/rss-updater.mjs --server=127.0.0.1:3117
//   node scripts/rss-updater.mjs --timeout=180

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const argv = process.argv.slice(2);
const SERVER_RAW = (argv.find(a => a.startsWith('--server=')) || '--server=127.0.0.1:3117').slice(9);
const TIMEOUT_MS = parseInt((argv.find(a => a.startsWith('--timeout=')) || '--timeout=180').slice(10), 10) * 1000;

const [HOST, PORT_STR] = SERVER_RAW.split(':');
const PORT = parseInt(PORT_STR || '3117', 10);
const PATH = '/api/services/rss-manager/update';
const REPORTS_DIR = join(ROOT, 'reports');

function httpRequest({ host, port, path, method, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body || '', 'utf8');
    const req = http.request({
      hostname: host,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });

    const timer = setTimeout(() => {
      req.destroy(new Error('request_timeout'));
    }, timeoutMs);

    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });

    req.on('close', () => {
      clearTimeout(timer);
    });

    req.write(bodyBuf);
    req.end();
  });
}

async function updateRSS() {
  const t0 = Date.now();
  console.log('════════════════════════════════════════════');
  console.log('Crucix RssUpdater v2.1.0 (http.request)');
  console.log('════════════════════════════════════════════');
  console.log('Сервер: ' + HOST + ':' + PORT);
  console.log('Endpoint: ' + PATH);
  console.log('Таймаут: ' + (TIMEOUT_MS / 1000) + 'с');
  console.log('');

  let res;
  try {
    console.log('[RSS Updater] Отправляю POST ' + PATH + ' ...');
    res = await httpRequest({
      host: HOST, port: PORT, path: PATH,
      method: 'POST', headers: {}, body: '{}',
      timeoutMs: TIMEOUT_MS
    });
  } catch (e) {
    if (e.message === 'request_timeout') {
      console.error('[RSS Updater] ТАЙМАУТ ' + (TIMEOUT_MS / 1000) + 'с. Сервер не ответил.');
      process.exit(2);
    }
    console.error('[RSS Updater] ОШИБКА запроса:', e.message);
    process.exit(1);
  }

  console.log('[RSS Updater] Ответ HTTP ' + res.status + ' за ' + (Date.now() - t0) + ' мс');

  if (res.status !== 200) {
    console.error('[RSS Updater] Неожиданный статус. Тело:');
    console.error(res.body.slice(0, 500));
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(res.body);
  } catch (e) {
    console.error('[RSS Updater] Не удалось распарсить JSON:', e.message);
    console.error('Тело: ' + res.body.slice(0, 500));
    process.exit(1);
  }

  if (!data.success) {
    console.error('[RSS Updater] Сервер вернул success: false');
    console.error(JSON.stringify(data, null, 2).slice(0, 500));
    process.exit(1);
  }

  const results = Array.isArray(data.results) ? data.results : [];
  const alive = results.filter(r => r.alive).length;
  const dead = results.filter(r => !r.alive).length;

  console.log('[RSS Updater] Обновление завершено:');
  console.log('  checked: ' + data.checked + ' из ' + data.total);
  console.log('  limited: ' + data.limited + ' (limit=' + data.limit + ')');
  console.log('  Живых: ' + alive);
  console.log('  Мёртвых: ' + dead);
  console.log('');

  if (dead > 0) {
    console.log('Мёртвые фиды:');
    for (const r of results.filter(x => !x.alive)) {
      console.log('  ✗ ' + (r.name || r.id).padEnd(30) + ' ' + (r.url || '') + ' (' + (r.status || '?') + ')');
    }
    console.log('');
  }

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    server: HOST + ':' + PORT,
    endpoint: PATH,
    method: 'http.request',
    checked: data.checked,
    total: data.total,
    limited: data.limited,
    limit: data.limit,
    alive,
    dead,
    results
  };
  const dateStr = new Date().toISOString().slice(0, 10);
  const reportFile = join(REPORTS_DIR, 'rss-update-' + dateStr + '.json');
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('[RSS Updater] Отчёт сохранён: ' + reportFile);
  console.log('[RSS Updater] Время: ' + (report.durationMs / 1000).toFixed(1) + 'с');

  if (dead > 0) process.exit(1);
}

updateRSS().catch(e => {
  console.error('[RSS Updater] НЕОЖИДАННАЯ ОШИБКА:', e.message);
  console.error(e.stack);
  process.exit(3);
});
