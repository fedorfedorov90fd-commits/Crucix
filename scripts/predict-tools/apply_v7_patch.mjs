// scripts/apply_v7_patch.mjs
// Патч engine.mjs для подключения фазы U (v7.0 Simulation Engine).
//
// Делает:
//   1. Добавляет import { runV7Phase, applyV7ToSnapshot }
//      после существующего import engine_v6_patch.mjs.
//   2. Вставляет вызов фазы U после блока v6 (перед await phaseZ_Dissemination).
//   3. Создаёт бэкап engine.mjs.bak.<TIMESTAMP> перед изменениями.
//
// Идемпотентный: если патч уже применён — не вставляет повторно.

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
console.log(`[apply_v7] engine.mjs прочитан: ${original.length} байт, ${original.split('\n').length} строк`);

// ─── ИДЕМПОТЕНТНОСТЬ ─────────────────────────────────────────────
if (original.includes('engine_v7_patch.mjs')) {
  console.log('[apply_v7] Патч уже применён (найден import engine_v7_patch.mjs)');
  process.exit(0);
}

// ─── МАРКЕР ИМПОРТА ──────────────────────────────────────────────
const importAnchor = `import { runV6Phase, runCatalogPhase, applyV6ToSnapshot } from './engine_v6_patch.mjs';`;

if (original.includes(importAnchor) === false) {
  console.error('❌ Не найден маркер import engine_v6_patch.mjs');
  console.error('   Сначала должен быть применён v6-патч.');
  process.exit(1);
}

const importCount = original.split(importAnchor).length - 1;
if (importCount !== 1) {
  console.error(`❌ Маркер импорта встречается ${importCount} раз (ожидалось 1)`);
  process.exit(1);
}

const newImport = `${importAnchor}\nimport { runV7Phase, applyV7ToSnapshot } from './engine_v7_patch.mjs';`;

// ─── МАРКЕР ВЫЗОВА ───────────────────────────────────────────────
// Вставляем ПОСЛЕ блока v6 (перед await phaseZ_Dissemination)
const callAnchor = `  await phaseZ_Dissemination(forecast);`;

if (original.includes(callAnchor) === false) {
  console.error('❌ Не найден маркер вызова phaseZ_Dissemination(forecast)');
  process.exit(1);
}

const callCount = original.split(callAnchor).length - 1;
if (callCount !== 1) {
  console.error(`❌ Маркер phaseZ встречается ${callCount} раз (ожидалось 1)`);
  process.exit(1);
}

const newCall = `  // ─── ФАЗА U (v7.0 Simulation Engine) ─────────────────────────
  // World Model + Neural ODE + Dreamer + Continuous Causal
  // Запускается после фаз S+T, перед публикацией.
  // Таймаут 180 секунд, circuit breaker 3 падения → 5 пропусков.
  try {
    const v7Phase = await runV7Phase(history, {
      horizon: 12,
      disabled: options.disabledV7 || [],
      modules: options.modulesV7 || undefined,
      interventions: options.interventionsV7 || undefined,
    });
    applyV7ToSnapshot(forecast, v7Phase);
    if (v7Phase.ok) {
      console.log(
        \`[engine] Фаза U завершена: v7 ok=\${v7Phase.ok}, \` +
        \`modules=\${v7Phase.result?.activeModules}/\${v7Phase.result?.totalModules}, \` +
        \`confidence=\${v7Phase.result?.synthesis?.confidence} \` +
        \`(\${Date.now() - t0}ms)\`
      );
    } else {
      console.log(\`[engine] Фаза U пропущена: \${v7Phase.reason || v7Phase.error}\`);
    }
  } catch (e) {
    console.error('[engine] Фаза U упала:', e.message);
    if (!forecast.failures) forecast.failures = [];
    forecast.failures.push({ module: 'engine_v7_patch', error: e.message });
  }

${callAnchor}`;

// ─── ПРИМЕНЕНИЕ ──────────────────────────────────────────────────
let patched = original.replace(importAnchor, newImport);
patched = patched.replace(callAnchor, newCall);

if (patched === original) {
  console.error('❌ Патч не изменил файл');
  process.exit(1);
}

// ─── БЭКАП ───────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
const backupPath = `${ENGINE_PATH}.bak.v7.${ts}`;
copyFileSync(ENGINE_PATH, backupPath);
console.log(`[apply_v7] Бэкап: ${backupPath}`);

// ─── ЗАПИСЬ ──────────────────────────────────────────────────────
writeFileSync(ENGINE_PATH, patched, 'utf-8');
console.log(`[apply_v7] engine.mjs пропатчен: ${patched.length} байт, ${patched.split('\n').length} строк`);
console.log(`[apply_v7] Разница: +${patched.length - original.length} байт, +${patched.split('\n').length - original.split('\n').length} строк`);

console.log('');
console.log('[apply_v7] Следующий шаг:');
console.log('  node --check apis/predict/engine.mjs && echo "SYNTAX OK"');
