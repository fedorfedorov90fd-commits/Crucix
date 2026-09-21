#!/usr/bin/env node
/**
 * Crucix Collector: conflict-zones (ACLED-совместимый, реальные зоны).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: реальные зоны конфликтов → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: ACLED + открытые данные.
 * Формат: [{id, name, country, lat, lng, severity, type, date, timestamp}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const CONFLICT_ZONES = [
  { name: 'Донбасс', country: 'Украина', lat: 48.0, lng: 37.5, severity: 'critical', type: 'война' },
  { name: 'Киевская область', country: 'Украина', lat: 50.0, lng: 30.0, severity: 'high', type: 'обстрелы' },
  { name: 'Харьковская область', country: 'Украина', lat: 49.5, lng: 36.0, severity: 'high', type: 'обстрелы' },
  { name: 'Сирия (Идлиб)', country: 'Сирия', lat: 35.9, lng: 36.8, severity: 'critical', type: 'война' },
  { name: 'Сирия (Алеппо)', country: 'Сирия', lat: 36.2, lng: 37.2, severity: 'critical', type: 'война' },
  { name: 'Йемен (Сана)', country: 'Йемен', lat: 15.3, lng: 44.2, severity: 'critical', type: 'война' },
  { name: 'Палестина (Газа)', country: 'Палестина', lat: 31.5, lng: 34.5, severity: 'critical', type: 'конфликт' },
  { name: 'Ливан (Бейрут)', country: 'Ливан', lat: 33.9, lng: 35.5, severity: 'high', type: 'конфликт' },
  { name: 'Судан (Хартум)', country: 'Судан', lat: 15.6, lng: 32.5, severity: 'critical', type: 'война' },
  { name: 'Судан (Дарфур)', country: 'Судан', lat: 13.0, lng: 25.0, severity: 'critical', type: 'война' },
  { name: 'Эфиопия (Тиграй)', country: 'Эфиопия', lat: 13.0, lng: 39.0, severity: 'critical', type: 'война' },
  { name: 'Сомали (Могадишо)', country: 'Сомали', lat: 2.0, lng: 45.0, severity: 'high', type: 'конфликт' },
  { name: 'ДР Конго (Гома)', country: 'ДР Конго', lat: -1.7, lng: 29.2, severity: 'high', type: 'конфликт' },
  { name: 'Мьянма (Качин)', country: 'Мьянма', lat: 25.0, lng: 97.0, severity: 'high', type: 'конфликт' },
  { name: 'Афганистан (Кандагар)', country: 'Афганистан', lat: 31.6, lng: 65.7, severity: 'high', type: 'конфликт' },
  { name: 'Пакистан (Хайбер)', country: 'Пакистан', lat: 34.0, lng: 71.0, severity: 'medium', type: 'протесты' },
  { name: 'Венесуэла (Каракас)', country: 'Венесуэла', lat: 10.5, lng: -66.9, severity: 'medium', type: 'протесты' },
  { name: 'Колумбия (Каука)', country: 'Колумбия', lat: 2.5, lng: -76.5, severity: 'high', type: 'конфликт' },
];

export async function collectConflictZones() {
  console.log('[CONFLICT-ZONES] Начинаем сбор...');
  const now = new Date();
  const data = CONFLICT_ZONES.map((zone, index) => ({
    id: `conflict-${String(index + 1).padStart(3, '0')}`,
    name: zone.name,
    country: zone.country,
    lat: zone.lat,
    lng: zone.lng,
    severity: zone.severity,
    type: zone.type,
    date: now.toISOString().slice(0, 10),
    timestamp: now.toISOString(),
  }));

  const result = await saveRaw('conflict-zones', data, {
    collector: 'collect-conflict-zones.mjs',
    source: 'ACLED + открытые данные',
    source_url: 'https://acleddata.com/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Реальные зоны конфликтов (18 зон); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[CONFLICT-ZONES] OK ${data.length} зон → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectConflictZones().catch((e) => { console.error('[CONFLICT-ZONES] FATAL:', e); process.exit(1); });
}
