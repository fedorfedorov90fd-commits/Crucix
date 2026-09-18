// scripts/apply_v6_patch.mjs
// Патч engine.mjs для подключения фаз S (v6.0) и T (каталог).
//
// Делает три вещи:
//   1. Добавляет import { runV6Phase, runCatalogPhase, applyV6ToSnapshot }
//      из './engine_v6_patch.mjs' после последнего существующего import.
//   2. Вставляет вызов фаз S+T перед await phaseZ_Dissemination(forecast).
//   3. Создаёт бэкап engine.mjs.bak.<TIMESTAMP> перед изменениями.
//
// Безопасно:
//   - Если маркер встречается > 1 раз — abort (защита от дампа).
//   - Если маркер встречается 0 раз — abort (что-то не так).
//   - Если патч уже применён (idempotent) — не вставляет повторно.

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_PATH = join(__dirname, '..', 'apis', 'predict', 'engine.mjs');

if (!existsSync(ENGINE_PATH)) {
  console.error(`❌ engine.mjs не найден: ${ENGINE_PATH}`);
  process.exit(1);
}

const original = readFileSync(ENGINE_PATH, 'utf-8');
console.log(`[apply] engine.mjs прочитан: ${original.length} байт, ${original.split('\n').length} строк`);

// ─── ИДЕМПОТЕНТНОСТЬ ─────────────────────────────────────────────
if (original.includes('engine_v6_patch.mjs')) {
  console.log('[apply] Патч уже применён (найден import engine_v6_patch.mjs)');
  console.log('[apply] Пропускаем.');
  process.exit(0);
}

// ─── МАРКЕР ИМПОРТА ──────────────────────────────────────────────
const importAnchor = `import { hybridForecast, checkPythonService, bridgeStatus } from './python_bridge.mjs';`;

if (!original.includes(importAnchor)) {
  console.error('❌ Не найден маркер импорта python_bridge.mjs');
  process.exit(1);
}

const importCount = original.split(importAnchor).length - 1;
if (importCount !== 1) {
  console.error(`❌ Маркер импорта встречается ${importCount} раз (ожидалось 1)`);
  process.exit(1);
}

const newImport = `${importAnchor}\nimport { runV6Phase, runCatalogPhase, applyV6ToSnapshot } from './engine_v6_patch.mjs';`;

// ─── МАРКЕР ВЫЗОВА ФАЗ ──────────────────────────────────────────
// Точка вставки — перед `await phaseZ_Dissemination(forecast);`
// Но чтобы не зацепить другие вызовы — проверяем что строка уникальна.
const callAnchor = `  await phaseZ_Dissemination(forecast);`;

if (!original.includes(callAnchor)) {
  console.error('❌ Не найден маркер вызова phaseZ_Dissemination(forecast)');
  process.exit(1);
}

const callCount = original.split(callAnchor).length - 1;
if (callCount !== 1) {
  console.error(`❌ Маркер вызова phaseZ встречается ${callCount} раз (ожидалось 1)`);
  process.exit(1);
}

const newCall = `  // ─── ФАЗЫ S (v6.0) И T (каталог) ─────────────────────────────
  // Подключаются после сборки snapshot, но перед публикацией.
  // Падение любой из них не блокирует основную публикацию.
  try {
    const [v6Phase, catalogPhase] = await Promise.all([
      runV6Phase(history, {
        disabled: options.disabledV6 || [],
      }),
      runCatalogPhase(history, {
        disabled: options.disabledCatalog || [],
      }),
    ]);
    applyV6ToSnapshot(forecast, v6Phase, catalogPhase);
    console.log(
      \`[engine] Фазы S+T завершены: \` +
      \`v6 \${v6Phase.okCount}/\${v6Phase.totalModules}, \` +
      \`catalog \${catalogPhase.okCount}/\${catalogPhase.totalModules} \` +
      \`(\${Date.now() - t0}ms)\`
    );
  } catch (e) {
    console.error('[engine] Фазы S+T упали:', e.message);
    if (!forecast.failures) forecast.failures = [];
    forecast.failures.push({ module: 'engine_v6_patch', error: e.message });
  }

${callAnchor}`;

// ─── ПРИМЕНЕНИЕ ──────────────────────────────────────────────────
let patched = original.replace(importAnchor, newImport);
patched = patched.replace(callAnchor, newCall);

if (patched === original) {
  console.error('❌ Патч не изменил файл (что-то пошло не так)');
  process.exit(1);
}

// ─── БЭКАП ───────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
const backupPath = `${ENGINE_PATH}.bak.${ts}`;
copyFileSync(ENGINE_PATH, backupPath);
console.log(`[apply] Бэкап создан: ${backupPath}`);

// ─── ЗАПИСЬ ──────────────────────────────────────────────────────
writeFileSync(ENGINE_PATH, patched, 'utf-8');
console.log(`[apply] engine.mjs пропатчен: ${patched.length} байт, ${patched.split('\n').length} строк`);
console.log(`[apply] Разница: +${patched.length - original.length} байт, +${patched.split('\n').length - original.split('\n').length} строк`);

console.log('');
console.log('[apply] Следующий шаг:');
console.log('  node --check apis/predict/engine.mjs && echo "SYNTAX OK"');
