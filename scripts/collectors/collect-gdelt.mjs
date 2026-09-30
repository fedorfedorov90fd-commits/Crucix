#!/usr/bin/env node
/**
 * Crucix Collector: GDELT news events.
 * Версия 2.5.0. Принят 23.09.2026.
 *
 * Изменения v2.5:
 *  - Интеграция Tor SOCKS5 через socks-proxy-agent + axios.
 *    Причина: прогон 23.09.2026 16:36 показал 0/4 запросов — все упали
 *    с UND_ERR_CONNECT_TIMEOUT. Провайдер блокирует TCP до GDELT с этого IP.
 *    GDELT доступен через Tor (проверено).
 *  - fetchWithTimeout переписан на axios: httpAgent: TOR_AGENT, httpsAgent: TOR_AGENT,
 *    proxy: false, transformResponse, validateStatus, maxRedirects: 5.
 *  - Отключается переменной CRUCIX_USE_TOR=false.
 *
 * Изменения v2.4:
 *  - QUERIES сокращён с 8 до 4: 'ukraine', 'russia', 'israel gaza', 'china taiwan'.
 *  - maxrecords увеличен 50 → 75.
 *  - GDELT_PAUSE_MS увеличен 5500 → 8000 мс.
 *  - GDELT_RETRY_PAUSE_MS увеличен 15000 → 30000 мс.
 *
 * Изменения v2.3:
 *  - GDELT_PAUSE_MS возвращён к 5500 мс.
 *  - Введена GDELT_RETRY_PAUSE_MS = 15000 мс.
 *  - Детальная диагностика ошибок.
 *
 * Изменения v2.2:
 *  - fetchWithTimeout(), readBodyWithSignal().
 *  - Retry-ветка на 429 получила собственный AbortController.
 *
 * Изменения v2.1: добавлен массив items[].
 *
 * Роль: собирает статьи из GDELT Doc API (4 тематических запроса),
 * дедуплицирует по URL, сдаёт на склад через collector-helper.
 * Сборщик НЕ пишет в basket — только raw + накладная.
 *
 * API: https://api.gdeltproject.org/api/v2/doc/doc (mode=artlist)
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GDELT_TIMEOUT_MS = 25000;
const GDELT_PAUSE_MS = 8000;
const GDELT_RETRY_PAUSE_MS = 30000;
const GDELT_MAXRECORDS = 75;

// Tor SOCKS5-прокси для обхода блокировки провайдера
const USE_TOR = process.env.CRUCIX_USE_TOR !== 'false';
const TOR_AGENT = USE_TOR ? new SocksProxyAgent('socks5h://127.0.0.1:9050') : null;

const QUERIES = [
  'ukraine', 'russia', 'israel gaza', 'china taiwan'
];

/**
 * Диагностическое описание ошибки: имя + код причины (если есть).
 */
function describeError(e) {
  const name = e?.name || e?.code || 'Error';
  const code = e?.cause?.code || e?.code || '';
  const msg = e?.message || '';
  return code ? `${name}/${code}: ${msg}` : `${name}: ${msg}`;
}

/**
 * Обёртка над axios с опциональным Tor SOCKS5.
 * Возвращает { status, ok, text }.
 *
 * Три критичные опции для корректной работы:
 *   - proxy: false — иначе axios возьмёт HTTP_PROXY из env;
 *   - transformResponse: [(d) => d] — не парсит JSON, отдаёт сырой текст;
 *   - validateStatus: () => true — не бросает на 4xx/5xx.
 */
async function fetchWithTimeout(url, timeoutMs) {
  const opts = {
    method: 'GET',
    timeout: timeoutMs,
    maxRedirects: 5,
    responseType: 'text',
    transformResponse: [(d) => d],
    validateStatus: () => true,
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/json'
    }
  };
  if (USE_TOR && TOR_AGENT) {
    opts.httpAgent = TOR_AGENT;
    opts.httpsAgent = TOR_AGENT;
    opts.proxy = false;
  }
  const res = await axios.request({ url, ...opts });
  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    text: typeof res.data === 'string' ? res.data : String(res.data)
  };
}

async function fetchQuery(q) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=${GDELT_MAXRECORDS}&format=json`;
  try {
    const first = await fetchWithTimeout(url, GDELT_TIMEOUT_MS);
    if (first.status === 429) {
      console.warn(`[GDELT] "${q}": 429, пауза ${GDELT_RETRY_PAUSE_MS} мс перед retry`);
      await new Promise(r => setTimeout(r, GDELT_RETRY_PAUSE_MS));
      const retry = await fetchWithTimeout(url, GDELT_TIMEOUT_MS);
      if (!retry.ok) throw new Error(`HTTP ${retry.status} (retry)`);
      const trimmedRetry = retry.text.trim();
      if (!trimmedRetry.startsWith('{') && !trimmedRetry.startsWith('[')) {
        throw new Error(`GDELT не JSON (retry): ${trimmedRetry.slice(0, 80)}`);
      }
      const data2 = JSON.parse(retry.text);
      return data2.articles || [];
    }
    if (!first.ok) throw new Error(`HTTP ${first.status}`);
    const trimmed = first.text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      throw new Error(`GDELT не JSON: ${trimmed.slice(0, 80)}`);
    }
    const data = JSON.parse(first.text);
    return data.articles || [];
  } catch (e) {
    console.warn(`[GDELT] "${q}": FAIL (${describeError(e)}) — запрос пропущен`);
    return [];
  }
}

function mapToPipeline(articles) {
  return articles.map(a => {
    const url = a.url || '';
    const title = a.title || '';
    const domain = a.domain || 'GDELT';
    const id = crypto.createHash('md5').update(url || title).digest('hex');
    let pubDate = new Date().toISOString();
    if (a.seendate && a.seendate.length >= 14) {
      const s = a.seendate;
      pubDate = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`;
    }
    return {
      id,
      guid: id,
      title,
      description: title + '. ' + domain,
      link: url,
      pubDate,
      source: domain,
      category: 'events',
      _gdelt: a
    };
  });
}

export async function collectGDELT() {
  const start = Date.now();
  console.log(`[GDELT] Запуск (browser UA, ${QUERIES.length} запросов, maxrecords=${GDELT_MAXRECORDS}, Tor=${USE_TOR})`);

  const allArticles = [];
  const seenIds = new Set();
  let okQueries = 0;
  for (const q of QUERIES) {
    const articles = await fetchQuery(q);
    if (articles.length > 0) okQueries++;
    for (const a of articles) {
      const key = a.url || a.id || (a.title + (a.seendate || ''));
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      allArticles.push(a);
    }
    console.log(`[GDELT] "${q}": ${articles.length} статей (итого ${allArticles.length})`);
    await new Promise(r => setTimeout(r, GDELT_PAUSE_MS));
  }

  const items = mapToPipeline(allArticles);

  const result = {
    source: 'GDELT',
    lastUpdated: new Date().toISOString(),
    queries: QUERIES,
    articles: allArticles,
    items: items,
    count: allArticles.length
  };

  const saveResult = await saveRaw('gdelt', result, {
    collector: 'collect-gdelt.mjs',
    source: 'GDELT Doc API',
    source_url: 'https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist',
    license: 'cc-by',
    format_hint: 'events',
    value_unit: 'count',
    granularity: 'event',
    record_count: allArticles.length,
    notes: `${QUERIES.length} тематических запросов (maxrecords=${GDELT_MAXRECORDS}), Tor=${USE_TOR}, дедупликация по URL; успешных: ${okQueries}/${QUERIES.length}`,
    backwardCompat: true
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[GDELT] OK ${allArticles.length} статей за ${elapsed}с (успешных запросов: ${okQueries}/${QUERIES.length}) → ${saveResult.raw_file}`);
  console.log(`[GDELT] Накладная: ${saveResult.incoming_file}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGDELT().catch((e) => { console.error('[GDELT] FATAL:', e); process.exit(1); });
}