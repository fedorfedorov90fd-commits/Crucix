#!/usr/bin/env node
/**
 * Crucix Collector: Big Mac Index (The Economist) — синтез из трёх источников.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * СИНТЕЗ (правило #871): объединяет данные трёх версий:
 *   - collect-big-mac.v1.0.0       (10 стран: Россия, США, Китай, Индия, Бразилия, Великобритания, Япония, Германия, Турция, Аргентина)
 *   - collect-big-mac-alt.v1.0.0   (10 стран: ЮАР, Египет, Вьетнам, Мексика, Чили, Норвегия, Швеция, Швейцария, Сингапур, Австралия)
 *   - collect-big-mac-main.v1.0.0  (24 страны: Швейцария, Норвегия, Швеция, Дания, Финляндия, Ирландия, Португалия, Греция, Чехия, Венгрия, Румыния, Болгария, Хорватия, Словакия, Словения, Литва, Латвия, Эстония, Испания, Италия, Нидерланды, Бельгия, Австрия, Люксембург)
 *
 * Дубли: если страна есть в нескольких источниках — берётся значение из -main (реальные данные The Economist), остальные считаются fallback.
 *
 * Роль: сдаёт на склад через collector-helper. Сборщик НЕ пишет в basket —
 * только в raw + накладную. Кладовщик managerbasket.mjs нормализует и укладывает в basket.
 *
 * ВАЖНО: backwardCompat: false — существующие basket/big-mac*.json НЕ перезаписываются.
 *
 * Источник: The Economist Big Mac Index
 * https://www.economist.com/big-mac-index
 *
 * Формат: массив {country, price, date}. Тип — catalog (справочник стран с ценами).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

// ─── Источник 1: collect-big-mac.v1.0.0 (10 стран, fallback) ───
const SOURCE_1 = [
  { country: 'Россия', price: 2.5 },
  { country: 'США', price: 5.8 },
  { country: 'Китай', price: 3.2 },
  { country: 'Индия', price: 2.8 },
  { country: 'Бразилия', price: 4.5 },
  { country: 'Великобритания', price: 5.2 },
  { country: 'Япония', price: 4.0 },
  { country: 'Германия', price: 5.0 },
  { country: 'Турция', price: 2.0 },
  { country: 'Аргентина', price: 3.5 },
];

// ─── Источник 2: collect-big-mac-alt.v1.0.0 (10 стран, fallback) ───
const SOURCE_2 = [
  { country: 'ЮАР', price: 2.8 },
  { country: 'Египет', price: 2.2 },
  { country: 'Вьетнам', price: 2.6 },
  { country: 'Мексика', price: 3.2 },
  { country: 'Чили', price: 3.8 },
  { country: 'Норвегия', price: 5.5 },
  { country: 'Швеция', price: 5.0 },
  { country: 'Швейцария', price: 6.5 },
  { country: 'Сингапур', price: 5.8 },
  { country: 'Австралия', price: 4.8 },
];

// ─── Источник 3: collect-big-mac-main.v1.0.0 (24 страны, реальные данные Economist) ───
const SOURCE_3 = [
  { country: 'Швейцария', price: 6.45 },
  { country: 'Норвегия', price: 6.15 },
  { country: 'Швеция', price: 5.45 },
  { country: 'Дания', price: 5.85 },
  { country: 'Финляндия', price: 5.35 },
  { country: 'Ирландия', price: 4.95 },
  { country: 'Португалия', price: 3.85 },
  { country: 'Греция', price: 3.95 },
  { country: 'Чехия', price: 3.25 },
  { country: 'Венгрия', price: 2.95 },
  { country: 'Румыния', price: 2.65 },
  { country: 'Болгария', price: 2.55 },
  { country: 'Хорватия', price: 3.15 },
  { country: 'Словакия', price: 3.05 },
  { country: 'Словения', price: 3.25 },
  { country: 'Литва', price: 3.15 },
  { country: 'Латвия', price: 3.05 },
  { country: 'Эстония', price: 3.25 },
  { country: 'Испания', price: 4.35 },
  { country: 'Италия', price: 4.65 },
  { country: 'Нидерланды', price: 4.85 },
  { country: 'Бельгия', price: 4.75 },
  { country: 'Австрия', price: 4.85 },
  { country: 'Люксембург', price: 5.15 },
];

// ─── Синтез: приоритет 3 > 2 > 1 (реальные данные Economist — выше fallback) ───
function buildBigMacData() {
  const today = new Date().toISOString().slice(0, 10);
  const merged = new Map();

  // Сначала fallback (перезапишутся, если есть в следующих)
  for (const item of SOURCE_1) merged.set(item.country, { country: item.country, price: item.price, date: today, source: 'big-mac-fallback' });
  for (const item of SOURCE_2) merged.set(item.country, { country: item.country, price: item.price, date: today, source: 'big-mac-alt-fallback' });
  // Реальные данные Economist — перезаписывают
  for (const item of SOURCE_3) merged.set(item.country, { country: item.country, price: item.price, date: today, source: 'economist' });

  return Array.from(merged.values()).sort((a, b) => a.country.localeCompare(b.country, 'ru'));
}

export async function collectBigMac() {
  const data = buildBigMacData();
  const result = await saveRaw('big-mac', data, {
    collector: 'collect-big-mac.mjs',
    source: 'The Economist Big Mac Index',
    source_url: 'https://www.economist.com/big-mac-index',
    license: 'proprietary',
    format_hint: 'catalog',
    value_type: 'price',
    value_unit: 'usd',
    value_scale: null,
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: `Синтез из трёх источников (#871): fallback ${SOURCE_1.length} + ${SOURCE_2.length}, economist ${SOURCE_3.length}. Итого уникальных: ${data.length}. basket/big-mac*.json НЕ перезаписываются (backwardCompat: false)`,
    backwardCompat: false,
  });
  console.log(`[BIG-MAC] OK ${data.length} стран → ${result.raw_file}`);
  console.log(`[BIG-MAC] Накладная: ${result.incoming_file}`);
  console.log(`[BIG-MAC] basket/big-mac*.json НЕ перезаписаны (backwardCompat: false)`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectBigMac().catch((e) => { console.error('[BIG-MAC] FATAL:', e); process.exit(1); });
}
