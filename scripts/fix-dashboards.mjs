#!/usr/bin/env node
// ============================================================
// FIX-DASHBOARDS.MJS — Исправление CARD_CONFIG во всех дашбордах
// ============================================================

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'dashboard', 'public');

// === ПРАВИЛЬНЫЕ КЛЮЧИ ДЛЯ КАЖДОГО API ===
const KEY_MAP = {
  '/api/notam/': 'id',
  '/api/gps-jamming/': 'id',
  '/api/google-trends/': 'score',
  '/api/vix/': 'value',
  '/api/yield-curve/': 'spread',
  '/api/gold-oil-ratio/': 'ratio',
  '/api/copper-gold/': 'ratio',
  '/api/bdi/': 'value',
  '/api/viirs/': 'value',
  '/api/uranium/': 'value',
  '/api/big-mac/': 'price',
  '/api/debt-gdp/': 'value',
  '/api/sp500-vix/': 'ratio',
  '/api/crypto-fear/': 'ratio',
  '/api/oil-gas/': 'ratio',
  '/api/gold-silver/': 'ratio',
  '/api/happiness/': 'score',
  '/api/big-mac-alt/': 'price',
  '/api/big-mac-main/': 'price',
  '/api/vxx/': 'value',
  '/api/happiness-alt/': 'score',
  '/api/inflation/': 'value',
  '/api/unemployment/': 'value',
  '/api/pmi/': 'value',
  '/api/recession/': 'value',
  '/api/dxy/': 'value',
  '/api/tips/': 'value',
  '/api/ovx/': 'value',
  '/api/hy-spread/': 'value',
  '/api/war-preparation/': 'value',
  '/api/consumer-confidence/': 'value',
  '/api/nuclear-monitor/': 'value',
  '/api/social-unrest/': 'value',
  '/api/silence/': 'value',
  '/api/aviation-monitor/': 'value',
  '/api/dark-ships/': 'value',
  '/api/maritime-monitor/': 'value',
  '/api/acled/': 'value',
  '/api/gdelt/': 'value',
  '/api/ofac/': 'value',
  '/api/opensanctions/': 'value',
  '/api/cisa/': 'value',
  '/api/cyber-threats/': 'value',
  '/api/firms/': 'value',
  '/api/usgs/': 'value',
  '/api/noaa/': 'value',
  '/api/epa/': 'value',
  '/api/safecast/': 'value',
  '/api/eia/': 'value',
  '/api/fred/': 'value',
  '/api/bls/': 'value',
  '/api/comtrade/': 'value',
  '/api/gscpi/': 'value'
};

async function fixDashboard(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // Находим CARD_CONFIG
    const match = content.match(/const CARD_CONFIG = \[([\s\S]*?)\];/);
    if (!match) {
      console.log(`⚠️ ${filePath}: CARD_CONFIG не найден`);
      return;
    }
    
    let configText = match[1];
    let fixed = false;
    
    // Исправляем ключи в каждом объекте
    const newConfig = configText.replace(
      /({[^{}]*?api:\s*['"]([^'"]+)['"][^{}]*?key:\s*['"]([^'"]+)['"][^{}]*?})/g,
      (match, obj, apiUrl, currentKey) => {
        const correctKey = KEY_MAP[apiUrl];
        if (correctKey && correctKey !== currentKey) {
          console.log(`  🔧 ${apiUrl}: "${currentKey}" → "${correctKey}"`);
          fixed = true;
          return obj.replace(`key: '${currentKey}'`, `key: '${correctKey}'`);
        }
        return obj;
      }
    );
    
    if (fixed) {
      content = content.replace(
        /const CARD_CONFIG = \[([\s\S]*?)\];/,
        `const CARD_CONFIG = [${newConfig}];`
      );
      await fs.writeFile(filePath, content);
      console.log(`✅ ${filePath}: исправлен`);
    } else {
      console.log(`✅ ${filePath}: уже правильный`);
    }
  } catch (error) {
    console.error(`❌ ${filePath}: ${error.message}`);
  }
}

async function main() {
  console.log('=== ИСПРАВЛЕНИЕ CARD_CONFIG ===\n');
  
  const files = await fs.readdir(PUBLIC_DIR);
  const dashboardFiles = files.filter(f => 
    f.startsWith('dashboard-') && f.endsWith('.html') && f !== 'dashboard-template.html'
  );
  
  for (const file of dashboardFiles) {
    const filePath = join(PUBLIC_DIR, file);
    console.log(`\n📄 ${file}:`);
    await fixDashboard(filePath);
  }
  
  console.log('\n✅ Готово!');
}

main().catch(console.error);
