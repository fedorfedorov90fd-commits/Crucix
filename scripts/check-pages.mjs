#!/usr/bin/env node

// ============================================================
// СКРИПТ ПРОВЕРКИ ВСЕХ СТРАНИЦ CRUCIX
// ============================================================
// Автоматически проверяет доступность каждой страницы
// и показывает статус (200 OK / 404 / 500 / таймаут)
// ============================================================

const PAGES = [
  '/', '/jarvis', '/rss-feed', '/rss-dashboard', '/ai-chat',
  '/geo-map', '/basket', '/grid-tool', '/global-index',
  '/historical-analysis', '/correlation', '/infrastructure',
  '/usgs', '/local', '/scheduler', '/trust', '/diagnostics',
  '/ai-gateway', '/hidden-links', '/market-predictor',
  '/early-warning', '/conflict-predictor', '/anomaly-detector',
  '/scenario-generator', '/semantic-analysis', '/automated-reports',
  '/strategic-intel', '/cyber-intel', '/aviation-monitor',
  '/maritime-monitor', '/dark-ships', '/satellite-internet',
  '/energy-monitor', '/trade-monitor', '/environment-monitor',
  '/health-monitor', '/weather-monitor', '/space-monitor',
  '/news-aggregator', '/supply-chain-monitor', '/monitor',
  '/export', '/help', '/strategic-layer', '/prediction-intel',
  '/masa', '/p2p', '/predictive', '/decision', '/social',
  '/quantum', '/deepfake', '/darkweb', '/agents', '/blockchain',
  '/voice', '/emotion', '/cyber-threats', '/cyber', '/acled',
  '/bls', '/fred', '/firms', '/gdelt', '/ships',
  '/sentiment-analyzer', '/satellite-api', '/safecast',
  '/opensky', '/nlp-api', '/llm-analyzer', '/kiwisdr',
  '/infrastructure-ships', '/infrastructure-predict',
  '/infrastructure-ofac', '/infrastructure-firms',
  '/infrastructure-eia-global', '/infrastructure-eia',
  '/infrastructure-cascade', '/gdelt-v1', '/gdelt-curl',
  '/aviation-api', '/ai-news-analyzer', '/ai-filter',
  '/analysis-events-api', '/economy', '/gateway', '/lenses',
  '/rag', '/thinktanks', '/profile', '/live', '/silence',
  '/scenarios', '/shipping'
];

const BASE_URL = 'http://localhost:3117';
const TIMEOUT = 5000;

async function checkPage(path) {
  const url = BASE_URL + path;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crucix-Page-Checker/1.0' }
    });

    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    return {
      path,
      status: response.status,
      ok: response.ok,
      elapsed,
      error: null
    };
  } catch (error) {
    return {
      path,
      status: error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
      ok: false,
      elapsed: Date.now() - start,
      error: error.message
    };
  }
}

async function main() {
  console.log('========================================');
  console.log('  🔍 ПРОВЕРКА СТРАНИЦ CRUCIX');
  console.log(`  Всего страниц: ${PAGES.length}`);
  console.log('  Таймаут: ' + TIMEOUT + 'ms');
  console.log('========================================\n');

  let success = 0;
  let failed = 0;
  let timeout = 0;
  const errors = [];

  for (let i = 0; i < PAGES.length; i++) {
    const path = PAGES[i];
    const result = await checkPage(path);

    const statusIcon = result.ok ? '✅' :
                       result.status === 'TIMEOUT' ? '⏰' :
                       result.status === 'ERROR' ? '❌' : '🚫';

    const statusText = result.ok ? `${result.status} OK` :
                       result.status === 'TIMEOUT' ? 'TIMEOUT' :
                       result.status === 'ERROR' ? result.error :
                       `${result.status}`;

    const timeStr = `${result.elapsed}ms`;

    if (result.ok) {
      success++;
      console.log(`  ${statusIcon} ${path.padEnd(35)} ${statusText.padEnd(12)} ${timeStr}`);
    } else {
      failed++;
      if (result.status === 'TIMEOUT') timeout++;
      errors.push({ path, status: result.status, error: result.error });
      console.log(`  ${statusIcon} ${path.padEnd(35)} ${statusText.padEnd(12)} ${timeStr}`);
    }
  }

  console.log('\n========================================');
  console.log('  📊 ИТОГИ ПРОВЕРКИ');
  console.log(`  ✅ Успешно:  ${success}`);
  console.log(`  ❌ Ошибок:   ${failed}`);
  console.log(`  ⏰ Таймаут:  ${timeout}`);
  console.log(`  📄 Всего:    ${PAGES.length}`);
  console.log('========================================');

  if (errors.length > 0) {
    console.log('\n  🔴 СПИСОК ПРОБЛЕМНЫХ СТРАНИЦ:');
    for (const err of errors) {
      console.log(`    - ${err.path}: ${err.status} ${err.error || ''}`);
    }
  }
}

main().catch(console.error);
