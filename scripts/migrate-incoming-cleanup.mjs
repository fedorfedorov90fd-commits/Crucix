#!/usr/bin/env node
/**
 * Crucix — разовая миграция накладных.
 * Версия 1.0.0. Принят 20.09.2026.
 *
 * Назначение: зачистка полей-«призраков» в data/warehouse/incoming/*.json,
 * появившихся до выпуска managerbasket.mjs v1.2.0. До v1.2.0 функция
 * updateItemStatus не удаляла поля от предыдущих статусов — в результате
 * в записях со status='processed' могли оставаться error и failed_at от
 * прошлых неудачных попыток.
 *
 * Что делает:
 *   1. Делает бэкап всех накладных в backups/incoming-<timestamp>/.
 *   2. Для каждой записи по её текущему status очищает поля-призраки:
 *      - processed: delete error, failed_at, archived_at, archived_reason
 *      - failed:    delete processed_at, processed_to, format_used,
 *                          archived_at, archived_reason
 *      - archived:  delete error, failed_at, processed_at, processed_to,
 *                          format_used
 *      - pending:   delete error, failed_at, processed_at, processed_to,
 *                          format_used, archived_at, archived_reason
 *   3. Проставляет status_updated_at (текущее время, если отсутствует).
 *   4. Проверяет каждую накладную по схеме data/schemas/incoming.v1.json
 *      перед записью. Если после очистки накладная не проходит схему —
 *      накладная не записывается, ошибка в лог.
 *   5. Записывает накладную только если были изменения.
 *
 * Запуск:
 *   node scripts/migrate-incoming-cleanup.mjs           — сухой прогон (по умолчанию)
 *   node scripts/migrate-incoming-cleanup.mjs --apply   — реальная запись
 */

import { readFile, writeFile, mkdir, readdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INCOMING_DIR = join(ROOT, 'data', 'warehouse', 'incoming');
const BACKUPS_DIR = join(ROOT, 'backups');
const SCHEMA_PATH = join(ROOT, 'data', 'schemas', 'incoming.v1.json');

const APPLY = process.argv.includes('--apply');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function loadSchema() {
  if (!existsSync(SCHEMA_PATH)) return null;
  try {
    return JSON.parse(await readFile(SCHEMA_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function validateIncoming(incoming, schema) {
  const errors = [];
  if (!schema) return { ok: true, errors: [] };

  if (!incoming || typeof incoming !== 'object') {
    return { ok: false, errors: ['накладная не объект'] };
  }
  if (typeof incoming.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(incoming.date)) {
    errors.push('$.date: ожидается YYYY-MM-DD');
  }
  if (!Array.isArray(incoming.items)) {
    errors.push('$.items: ожидается массив');
    return { ok: false, errors };
  }

  const itemSchema = schema.$defs && schema.$defs.item;
  const itemRequired = (itemSchema && itemSchema.required) || ['id', 'collector', 'source', 'raw_file', 'status'];
  const statusEnum = (itemSchema && itemSchema.properties && itemSchema.properties.status && itemSchema.properties.status.enum)
    || ['pending', 'processed', 'failed', 'archived'];

  for (let i = 0; i < incoming.items.length; i++) {
    const it = incoming.items[i];
    const p = `$.items[${i}]`;
    if (!it || typeof it !== 'object') {
      errors.push(`${p}: не объект`);
      continue;
    }
    for (const field of itemRequired) {
      if (it[field] === undefined || it[field] === null || it[field] === '') {
        errors.push(`${p}.${field}: обязательное поле отсутствует`);
      }
    }
    if (it.status !== undefined && !statusEnum.includes(it.status)) {
      errors.push(`${p}.status: '${it.status}' не из enum [${statusEnum.join(', ')}]`);
    }
    if (it.status === 'processed') {
      if (!it.processed_at) errors.push(`${p}.processed_at: обязателен при status='processed'`);
      if (!it.processed_to) errors.push(`${p}.processed_to: обязателен при status='processed'`);
      if (it.error) errors.push(`${p}.error: не должен присутствовать при status='processed' (поле-призрак)`);
      if (it.failed_at) errors.push(`${p}.failed_at: не должен присутствовать при status='processed' (поле-призрак)`);
    }
    if (it.status === 'failed') {
      if (!it.failed_at) errors.push(`${p}.failed_at: обязателен при status='failed'`);
      if (!it.error) errors.push(`${p}.error: обязателен при status='failed'`);
      if (it.processed_at) errors.push(`${p}.processed_at: не должен присутствовать при status='failed' (поле-призрак)`);
    }
    if (it.status === 'archived') {
      if (!it.archived_at) errors.push(`${p}.archived_at: обязателен при status='archived'`);
      if (!it.archived_reason) errors.push(`${p}.archived_reason: обязателен при status='archived'`);
    }
    if (it.checksum_sha256 !== undefined && !/^[a-f0-9]{64}$/.test(it.checksum_sha256)) {
      errors.push(`${p}.checksum_sha256: ожидается sha256 hex`);
    }
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

/**
 * Очищает поля-призраки у одной записи по её текущему статусу.
 * Возвращает список удалённых полей.
 */
function cleanItemFields(item) {
  const removed = [];
  const remove = (field) => {
    if (item[field] !== undefined) {
      delete item[field];
      removed.push(field);
    }
  };

  const status = item.status;
  if (status === 'processed') {
    remove('error');
    remove('failed_at');
    remove('archived_at');
    remove('archived_reason');
  } else if (status === 'failed') {
    remove('processed_at');
    remove('processed_to');
    remove('format_used');
    remove('archived_at');
    remove('archived_reason');
  } else if (status === 'archived') {
    remove('error');
    remove('failed_at');
    remove('processed_at');
    remove('processed_to');
    remove('format_used');
  } else if (status === 'pending') {
    remove('error');
    remove('failed_at');
    remove('processed_at');
    remove('processed_to');
    remove('format_used');
    remove('archived_at');
    remove('archived_reason');
  }

  // status_updated_at проставляем, если нет (не затираем существующий).
  if (!item.status_updated_at) {
    item.status_updated_at = new Date().toISOString();
    removed.push('+(status_updated_at)');
  }

  return removed;
}

async function main() {
  console.log('════════ Разовый скрипт миграции накладных ════════');
  console.log('Режим: ' + (APPLY ? 'ПРИМЕНЕНИЕ (запись)' : 'СУХОЙ ПРОГОН (без записи)'));
  console.log('');

  if (!existsSync(INCOMING_DIR)) {
    console.error('Директория не найдена: ' + INCOMING_DIR);
    process.exit(1);
  }

  const schema = await loadSchema();
  if (!schema) {
    console.warn('ВНИМАНИЕ: схема ' + SCHEMA_PATH + ' не найдена — валидация будет пропущена');
  } else {
    console.log('Схема загружена: ' + (schema.$id || 'incoming.v1'));
  }

  const files = (await readdir(INCOMING_DIR)).filter(f => f.endsWith('.json')).sort();
  console.log('Файлов накладных: ' + files.length);
  console.log('');

  // Бэкап
  let backupDir = null;
  if (APPLY) {
    backupDir = join(BACKUPS_DIR, 'incoming-' + ts());
    await mkdir(backupDir, { recursive: true });
    for (const f of files) {
      await copyFile(join(INCOMING_DIR, f), join(backupDir, f));
    }
    console.log('Бэкап: ' + backupDir + ' (' + files.length + ' файлов)');
    console.log('');
  }

  let totalItems = 0;
  let changedFiles = 0;
  let totalFieldsRemoved = 0;
  let rejectedFiles = 0;
  const perFile = [];

  for (const f of files) {
    const filePath = join(INCOMING_DIR, f);
    let data;
    try {
      data = JSON.parse(await readFile(filePath, 'utf-8'));
    } catch (e) {
      console.error('ОШИБКА парсинга ' + f + ': ' + e.message);
      continue;
    }
    const items = data.items || [];
    totalItems += items.length;

    let fileChanged = false;
    const fileStats = { file: f, items: items.length, cleaned: 0, fields: [] };

    for (const item of items) {
      const removed = cleanItemFields(item);
      if (removed.length > 0) {
        fileChanged = true;
        fileStats.cleaned++;
        totalFieldsRemoved += removed.length;
        fileStats.fields.push({ id: item.id, status: item.status, removed });
      }
    }

    if (fileChanged) {
      const output = {
        date: data.date,
        updated_at: new Date().toISOString(),
        items: data.items
      };

      const validation = validateIncoming(output, schema);
      if (!validation.ok) {
        console.error('ОТКЛОНЕНО ' + f + ': ' + validation.errors.length + ' ошибок схемы после очистки');
        for (const err of validation.errors.slice(0, 5)) console.error('  ' + err);
        rejectedFiles++;
        perFile.push({ ...fileStats, rejected: true });
        continue;
      }

      changedFiles++;
      perFile.push(fileStats);

      if (APPLY) {
        await writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
      }
    } else {
      perFile.push({ ...fileStats, unchanged: true });
    }
  }

  console.log('════════ ОТЧЁТ ════════');
  console.log('Всего записей: ' + totalItems);
  console.log('Файлов с изменениями: ' + changedFiles);
  console.log('Файлов отклонено валидацией: ' + rejectedFiles);
  console.log('Удалено полей-призраков (всего): ' + totalFieldsRemoved);
  console.log('');

  if (changedFiles > 0) {
    console.log('Детали по файлам с изменениями:');
    for (const s of perFile) {
      if (s.cleaned > 0 && !s.rejected) {
        console.log('  ' + s.file + ': очищено записей=' + s.cleaned + ' (из ' + s.items + ')');
        for (const fd of s.fields.slice(0, 5)) {
          console.log('    id=' + fd.id + ' | status=' + fd.status + ' | удалено: ' + fd.removed.join(', '));
        }
        if (s.fields.length > 5) {
          console.log('    ... и ещё ' + (s.fields.length - 5) + ' записей');
        }
      }
    }
  } else {
    console.log('Изменений не требуется — все накладные чисты.');
  }

  console.log('');
  if (APPLY) {
    console.log('ЗАПИСЬ ВЫПОЛНЕНА. Бэкап: ' + backupDir);
  } else {
    console.log('СУХОЙ ПРОГОН. Для реальной записи добавь --apply');
  }
}

main().catch((e) => {
  console.error('Фатальная ошибка: ' + (e.stack || e.message));
  process.exit(1);
});
