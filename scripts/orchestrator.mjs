#!/usr/bin/env node
import { exec } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const COLLECTORS_DIR = join(process.cwd(), 'scripts/collectors');

async function runCollector(name) {
  console.log(`🔄 Запуск сборщика: ${name}`);
  try {
    const { stdout, stderr } = await execAsync(`node ${join(COLLECTORS_DIR, name)}`);
    console.log(`✅ ${name}: ${stdout}`);
    if (stderr) console.warn(`⚠️ ${name}: ${stderr}`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false };
  }
}

async function runAllCollectors() {
  console.log('🚀 Запуск оркестратора сборщиков...');
  const files = await readdir(COLLECTORS_DIR);
  const collectors = files.filter(f => f.startsWith('collect-') && f.endsWith('.mjs'));
  
  console.log(`📋 Найдено ${collectors.length} сборщиков`);
  
  const results = [];
  for (const collector of collectors) {
    const result = await runCollector(collector);
    results.push(result);
  }
  
  const success = results.filter(r => r.success).length;
  console.log(`\n✅ Успешно: ${success}/${results.length}`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllCollectors();
}

export { runAllCollectors, runCollector };
