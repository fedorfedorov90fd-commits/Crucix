#!/usr/bin/env node
import { exec } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { pathToFileURL } from 'url';
import { logCollectorRun } from './logs/logs-writer.mjs';

const execAsync = promisify(exec);
const COLLECTORS_DIR = join(process.cwd(), 'scripts/collectors');

async function runCollector(name) {
  console.log('🔄 Запуск сборщика: ' + name);
  const t0 = Date.now();
  try {
    const { stdout, stderr } = await execAsync('node "' + join(COLLECTORS_DIR, name) + '"', { maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
    const durationMs = Date.now() - t0;
    console.log('✅ ' + name + ': ' + (stdout || '').slice(0, 200));
    if (stderr) console.warn('⚠️ ' + name + ': ' + stderr);

    try {
      logCollectorRun(name, 'OK', durationMs, stdout || '', stderr || '', 0, null);
    } catch (logErr) {
      console.warn('⚠️ log failed: ' + logErr.message);
    }

    return { name, success: true, durationMs };
  } catch (e) {
    const durationMs = Date.now() - t0;
    console.error('❌ ' + name + ': ' + e.message);

    try {
      logCollectorRun(name, 'FAIL', durationMs, e.stdout || '', e.stderr || e.message, e.code || 1, e);
    } catch (logErr) {
      console.warn('⚠️ log failed: ' + logErr.message);
    }

    return { name, success: false, durationMs, error: e.message };
  }
}

async function runAllCollectors() {
  console.log('🚀 Запуск оркестратора сборщиков...');
  const t0 = Date.now();
  const files = await readdir(COLLECTORS_DIR);
  const collectors = files.filter(f => f.startsWith('collect-') && f.endsWith('.mjs'));

  console.log('📋 Найдено ' + collectors.length + ' сборщиков');

  const results = [];
  for (const collector of collectors) {
    const result = await runCollector(collector);
    results.push(result);
  }

  const success = results.filter(r => r.success).length;
  const totalMs = Date.now() - t0;
  console.log('\n✅ Успешно: ' + success + '/' + results.length + ' за ' + totalMs + 'ms');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAllCollectors();
}

export { runAllCollectors, runCollector };
