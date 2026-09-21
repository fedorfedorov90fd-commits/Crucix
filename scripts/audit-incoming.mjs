import fs from 'fs';
import path from 'path';

const DIR = 'data/warehouse/incoming';

function listFiles() {
  if (!fs.existsSync(DIR)) {
    console.error('Директория не найдена: ' + DIR);
    process.exit(1);
  }
  return fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
}

function loadAll() {
  const files = listFiles();
  const records = [];
  for (const f of files) {
    const full = path.join(DIR, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      console.error('ОШИБКА парсинга ' + f + ': ' + e.message);
      continue;
    }
    for (const it of (data.items || [])) {
      records.push({
        file: f,
        id: it.id,
        status: it.status,
        raw_file: it.raw_file,
        processed_at: it.processed_at,
        archived_at: it.archived_at,
        archived_reason: it.archived_reason,
        failed_at: it.failed_at,
        error: it.error,
        collector: it.collector,
        source: it.source,
      });
    }
  }
  return { files, records };
}

function reportDuplicates(records) {
  console.log('════════ 1. ID с более чем одной записью в накладных ════════');
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.id)) map.set(r.id, []);
    map.get(r.id).push(r);
  }
  let dupCount = 0;
  for (const [id, arr] of [...map.entries()].sort()) {
    if (arr.length > 1) {
      dupCount++;
      console.log('--- id: ' + id + ' (' + arr.length + ' записей) ---');
      for (const r of arr) {
        console.log('  file=' + r.file +
          ' | status=' + r.status +
          ' | raw=' + r.raw_file +
          (r.archived_reason ? ' | archived_reason=' + r.archived_reason : '') +
          (r.error ? ' | error=' + r.error : ''));
      }
    }
  }
  if (dupCount === 0) console.log('Двойных записей не найдено');
  else console.log('');
  console.log('ИТОГО id с дублями: ' + dupCount);
}

function reportSummary(records) {
  console.log('════════ 2. Сводка статусов по всем накладным ════════');
  let pending = 0, processed = 0, failed = 0, archived = 0, other = 0;
  const failedIds = [];
  const pendingIds = [];
  for (const r of records) {
    if (r.status === 'pending') { pending++; pendingIds.push(r.id); }
    else if (r.status === 'processed') processed++;
    else if (r.status === 'failed') { failed++; failedIds.push(r.id + ' (' + r.file + ')'); }
    else if (r.status === 'archived') archived++;
    else other++;
  }
  console.log('pending=' + pending + ', processed=' + processed + ', failed=' + failed + ', archived=' + archived + (other ? ', other=' + other : ''));
  if (pendingIds.length) {
    console.log('PENDING (ожидают обработки):');
    for (const x of pendingIds) console.log('  ' + x);
  }
  if (failedIds.length) {
    console.log('FAILED:');
    for (const x of failedIds) console.log('  ' + x);
  }
}

function reportFilesSummary(files, records) {
  console.log('════════ 3. Сводка по файлам накладных ════════');
  for (const f of files) {
    const inFile = records.filter(r => r.file === f);
    console.log(f + ': записей=' + inFile.length);
  }
}

function main() {
  const { files, records } = loadAll();
  console.log('Файлов накладных: ' + files.length + ' | всего записей: ' + records.length);
  console.log('');
  reportFilesSummary(files, records);
  console.log('');
  reportDuplicates(records);
  console.log('');
  reportSummary(records);
}

main();
