#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);
const CRON_FILE = join(process.cwd(), 'config/cron.json');

const defaultSchedule = {
  'collect-cve.mjs': '*/30 * * * *',
  'collect-gdelt.mjs': '*/15 * * * *',
  'collect-vix.mjs': '0 * * * *',
  'collect-gold.mjs': '*/5 * * * *',
  'collect-oil.mjs': '*/5 * * * *'
};

async function loadSchedule() {
  try {
    const data = await readFile(CRON_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    await writeFile(CRON_FILE, JSON.stringify(defaultSchedule, null, 2));
    return defaultSchedule;
  }
}

async function runScheduled() {
  const schedule = await loadSchedule();
  console.log('📋 Текущее расписание:');
  Object.entries(schedule).forEach(([job, cron]) => {
    console.log(`  ${job}: ${cron}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScheduled();
}

export { loadSchedule, runScheduled };
