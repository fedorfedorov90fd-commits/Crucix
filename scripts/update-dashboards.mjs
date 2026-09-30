#!/usr/bin/env node
// ============================================================
// UPDATE-DASHBOARDS.MJS — Автообновление всех дашбордов
// ============================================================

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'dashboard', 'public');

const DASHBOARD_CONFIGS = {
  'financial-dashboard': 'FINANCIAL',
  'military-dashboard': 'MILITARY',
  'economy-dashboard': 'ECONOMIC'
  // Добавить остальные дашборды позже
};

async function updateDashboard(name, configName) {
  const filePath = join(PUBLIC_DIR, `${name}.html`);
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // Заменяем CARD_CONFIG
    const pattern = /const CARD_CONFIG = \[[\s\S]*?\];/;
    const replacement = `const CARD_CONFIG = ${configName};`;
    
    if (content.includes('CARD_CONFIG')) {
      content = content.replace(pattern, replacement);
      await fs.writeFile(filePath, content);
      console.log(`✅ ${name}.html обновлён`);
    } else {
      console.log(`⚠️ ${name}.html — CARD_CONFIG не найден`);
    }
  } catch (error) {
    console.error(`❌ ${name}.html: ${error.message}`);
  }
}

async function main() {
  console.log('=== ОБНОВЛЕНИЕ ДАШБОРДОВ ===\n');
  
  for (const [name, config] of Object.entries(DASHBOARD_CONFIGS)) {
    await updateDashboard(name, config);
  }
  
  console.log('\n✅ Готово!');
}

main().catch(console.error);
