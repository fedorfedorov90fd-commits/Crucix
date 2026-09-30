#!/usr/bin/env node
/**
 * scripts/show-registry-summary.mjs — СВОДКА РЕЕСТРОВ CRUCIX
 *
 * ШАПКА-ПАСПОРТ:
 *   Создан:      20.09.2026 (шаг 4 плана единого дискового реестра)
 *   Назначение:  вывод сводки о составе проекта в терминал для начала сессии
 *   Справка RU:  docs/help/ru/registry/show-registry-summary.md
 *   Справка EN:  docs/help/en/registry/show-registry-summary.md
 *
 * ЗАПУСК:
 *   cd "/home/ta8_/Рабочий стол/Crucix" && node scripts/show-registry-summary.mjs
 *
 * ЧТО ЧИТАЕТ:
 *   - server/registry.generated.json (meta + счётчики + basket summary)
 *   - data/registry/registry-broken.json (битые связи)
 *   - data/registry/registry-architecture.json (динамические читатели)
 *   - data/registry/registry-basket.json (детальная статистика корзины)
 *
 * ЧТО НЕ ДЕЛАЕТ:
 *   - не пишет ничего на диск
 *   - не запускает сервер
 *   - не сканирует файловую систему (только читает готовые реестры)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const GEN_REGISTRY = join(ROOT, 'server', 'registry.generated.json');
const BROKEN_REGISTRY = join(ROOT, 'data', 'registry', 'registry-broken.json');
const ARCH_REGISTRY = join(ROOT, 'data', 'registry', 'registry-architecture.json');
const BASKET_REGISTRY = join(ROOT, 'data', 'registry', 'registry-basket.json');

async function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { _error: e.message };
  }
}

function line(char = '─', n = 64) {
  return char.repeat(n);
}

function header(title) {
  console.log('');
  console.log(line('═'));
  console.log('  ' + title);
  console.log(line('═'));
}

function printGenStats(gen) {
  header('РЕЕСТР CRUCIX (server/registry.generated.json)');
  if (!gen) {
    console.log('  ФАЙЛ НЕ НАЙДЕН. Запусти: node server/build-registry.mjs');
    return;
  }
  if (gen._error) {
    console.log('  ОШИБКА ЧТЕНИЯ: ' + gen._error);
    return;
  }
  const m = gen.meta || {};
  console.log('  schema_version: ' + (m.schema_version || '(нет)'));
  console.log('  generated_by:   ' + (m.generated_by || '(нет)'));
  console.log('  generated_at:   ' + (m.generated_at || '(нет)'));
  console.log('');
  console.log('  Модули:');
  console.log('    Layer (карта):     ' + (m.total_layers ?? '?'));
  console.log('    Service (инфра):   ' + (m.total_services ?? '?'));
  console.log('    Маршрутов Layer:   ' + (m.total_routes ?? '?'));
  console.log('    Маршрутов Service: ' + (m.total_service_routes ?? '?'));
  console.log('    Пропущено:         ' + (m.skipped ?? '?'));
  console.log('    Дубликатов:        ' + (m.duplicates ?? '?'));
  console.log('    Предупреждений:    ' + (m.warnings ?? '?'));
  console.log('');
  console.log('  Корзина (сводка из реестра):');
  console.log('    Всего файлов:      ' + (m.total_basket_files ?? '?'));
  console.log('    С полным meta:     ' + (m.total_basket_with_meta ?? '?'));
  console.log('    Без полного meta:  ' + (m.total_basket_without_meta ?? '?'));
  const bs = m.basket_by_status || {};
  const parts = Object.entries(bs).map(([k, v]) => k + '=' + v).join(', ');
  console.log('    По статусу:        ' + (parts || '(нет данных)'));
}

function printBasket(basket) {
  header('КОРЗИНА — детали (data/registry/registry-basket.json)');
  if (!basket) {
    console.log('  ФАЙЛ НЕ НАЙДЕН. Запусти: node server/build-registry.mjs');
    return;
  }
  if (basket._error) {
    console.log('  ОШИБКА ЧТЕНИЯ: ' + basket._error);
    return;
  }
  const m = basket.meta || {};
  console.log('  schema_version: ' + (m.schema_version || '(нет)'));
  console.log('  generated_by:   ' + (m.generated_by || '(нет)'));
  console.log('  total_files:    ' + (m.total_files ?? '?'));
  console.log('  with_meta:      ' + (m.total_with_meta ?? '?'));
  console.log('  without_meta:   ' + (m.total_without_meta ?? '?'));
  const bs = m.by_status || {};
  const parts = Object.entries(bs).map(([k, v]) => k + '=' + v).join(', ');
  console.log('  by_status:      ' + (parts || '(нет данных)'));
  console.log('');

  const items = basket.items || [];
  const active = items.filter(x => x.status === 'active');
  const unknown = items.filter(x => x.status === 'unknown');
  const legacy = items.filter(x => x.status === 'legacy');

  console.log('  Первые 10 active (id → readers/writers):');
  for (const it of active.slice(0, 10)) {
    const r = (it.readers || []).length;
    const w = (it.writers || []).length;
    console.log('    ' + String(it.id).padEnd(28) + ' readers=' + r + ' writers=' + w);
  }
  if (active.length > 10) console.log('    ... ещё ' + (active.length - 10) + ' active');
  console.log('');
  console.log('  Первые 10 unknown (id → series_len/readers/writers):');
  for (const it of unknown.slice(0, 10)) {
    const r = (it.readers || []).length;
    const w = (it.writers || []).length;
    console.log('    ' + String(it.id).padEnd(28) + ' series=' + (it.series_len ?? 0) + ' readers=' + r + ' writers=' + w);
  }
  if (unknown.length > 10) console.log('    ... ещё ' + (unknown.length - 10) + ' unknown');
  if (legacy.length > 0) {
    console.log('');
    console.log('  legacy (schema есть, meta неполный): ' + legacy.length);
  }
}

function printBroken(broken) {
  header('БИТЫЕ СВЯЗИ (data/registry/registry-broken.json)');
  if (!broken) {
    console.log('  ФАЙЛ НЕ НАЙДЕН.');
    return;
  }
  if (broken._error) {
    console.log('  ОШИБКА ЧТЕНИЯ: ' + broken._error);
    return;
  }
  const items = broken.items || [];
  console.log('  total_broken: ' + (broken.meta?.total_broken ?? items.length));
  console.log('');
  const bySev = {};
  for (const it of items) {
    const s = it.severity || 'unknown';
    bySev[s] = (bySev[s] || 0) + 1;
  }
  console.log('  По серьёзности:');
  for (const [s, n] of Object.entries(bySev).sort()) {
    console.log('    ' + s.padEnd(16) + ' ' + n);
  }
  console.log('');
  console.log('  Список (id → что ищет [severity]):');
  for (const it of items) {
    const target = it.basket_expected || '(не указано)';
    const sev = '[' + (it.severity || '?') + ']';
    console.log('    ' + String(it.id).padEnd(20) + ' → ' + target + ' ' + sev);
  }
}

function printArch(arch) {
  header('АРХИТЕКТУРА (data/registry/registry-architecture.json)');
  if (!arch) {
    console.log('  ФАЙЛ НЕ НАЙДЕН.');
    return;
  }
  if (arch._error) {
    console.log('  ОШИБКА ЧТЕНИЯ: ' + arch._error);
    return;
  }
  const stages = arch.data_flow?.stages || [];
  console.log('  Слоёв потока данных: ' + stages.length);
  for (const s of stages) {
    const loc = s.dir || s.file || s.dir_ru || '?';
    console.log('    ' + String(s.order).padStart(2) + '. ' + String(s.layer).padEnd(12) + ' ' + loc);
  }
  console.log('');
  const dyn = arch.dynamic_basket_readers?.modules || [];
  console.log('  Динамических читателей basket: ' + (arch.dynamic_basket_readers?.total ?? dyn.length));
  const files = arch.registry_files?.files || [];
  console.log('  Файлов реестров: ' + files.length);
  const html = arch.html_registry_duplicates?.files || [];
  console.log('  HTML-дублей реестра: ' + html.length);
}

function printFooter() {
  console.log('');
  console.log(line('═'));
  console.log('  СВОДКА ПОЛНАЯ. Для пересборки: node scripts/rebuild-all-registries.mjs');
  console.log(line('═'));
}

async function main() {
  console.log('');
  console.log(line('═'));
  console.log('  CRUCIX — СВОДКА РЕЕСТРОВ');
  console.log('  ' + new Date().toISOString());
  console.log(line('═'));

  const gen = await readJson(GEN_REGISTRY);
  const broken = await readJson(BROKEN_REGISTRY);
  const arch = await readJson(ARCH_REGISTRY);
  const basket = await readJson(BASKET_REGISTRY);

  printGenStats(gen);
  printBasket(basket);
  printBroken(broken);
  printArch(arch);
  printFooter();
}

main().catch(e => {
  console.error('ФАТАЛЬНАЯ ОШИБКА: ' + (e.stack || e.message));
  process.exit(1);
});
