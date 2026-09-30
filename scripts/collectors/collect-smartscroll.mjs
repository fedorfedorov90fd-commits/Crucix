// scripts/collectors/collect-smartscroll.mjs
// Сборщик комплекта SmartScroll.
// Вызывает локальный движок и сохраняет результат в корзину.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..', '..');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const CONFIG_PATH = join(PROJECT_ROOT, 'config', 'smartscroll.json');

const name = 'smartscroll';
const LOG_FILE = join(LOGS_DIR, `collect-${name}.log`);

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(LOG_FILE, line, { flag: 'a' });
  } catch {}
  process.stdout.write(line);
}

async function main() {
  log('collect-smartscroll started');

  if (!existsSync(CONFIG_PATH)) {
    log(`config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  log(`mode=${config.mode}`);

  const { SmartScrollLocalEngine } = await import('../../apis/sources/smartscroll-local/engine.mjs');

  const engine = new SmartScrollLocalEngine(config);

  try {
    await engine._collectCycle();
    log('collect cycle completed');
  } catch (err) {
    log(`collect cycle error: ${err.message}`);
    process.exit(1);
  }

  const stories = engine.store.getAllStories();
  log(`stories in store: ${stories.length}`);

  if (!existsSync(BASKET_DIR)) mkdirSync(BASKET_DIR, { recursive: true });

  const basketFile = join(BASKET_DIR, 'smartscroll-stories.json');
  const basketData = {
    meta: {
      id: 'smartscroll-stories',
      source: 'smartscroll',
      source_url: 'local-engine',
      fetched_at: new Date().toISOString(),
      normalized_at: new Date().toISOString(),
      collector: 'collect-smartscroll.mjs',
      license: 'mixed',
      count: stories.length,
      granularity: 'story',
      value_unit: 'count',
    },
    items: stories,
  };

  writeFileSync(basketFile, JSON.stringify(basketData, null, 2), 'utf8');
  log(`basket written: ${basketFile} (${stories.length} stories)`);

  log('collect-smartscroll finished');
}

main().catch(err => {
  log(`fatal: ${err.message}`);
  process.exit(1);
});
