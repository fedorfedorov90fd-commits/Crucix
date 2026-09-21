#!/usr/bin/env node
/**
 * Crucix Collector: launches (предстоящие космические запуски).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://ll.thespacedevs.com/2.2.0/launch/upcoming/
 * Формат: {source, updated, count, launches:[{id,name,net,status,provider,pad,location}]}. Тип — events.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20&mode=list';
const TIMEOUT_MS = 20000;

export async function collectLaunches() {
  console.log('[Launches] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const launches = (d.results || []).map(l => ({
      id: l.id, name: l.name, net: l.net, status: l.status?.abbrev,
      provider: l.launch_service_provider?.name, pad: l.pad?.name, location: l.pad?.location?.name,
    }));
    basketData = { source: 'LaunchLibrary2', updated: new Date().toISOString(), count: launches.length, launches };
    console.log(`[Launches] ${launches.length} предстоящих запусков`);
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[Launches] ⚠️ Ошибка:', e.message);
    basketData = { source: 'LaunchLibrary2', updated: new Date().toISOString(), count: 0, launches: [], error: e.message };
  }

  const result = await saveRaw('launches', basketData, {
    collector: 'collect-launches.mjs',
    source: 'TheSpaceDevs LaunchLibrary2',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.launches.length,
    notes: ok ? `Реальные данные, ${basketData.launches.length} запусков` : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Launches] OK → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectLaunches().catch((e) => { console.error('[Launches] FATAL:', e); process.exit(1); });
}
