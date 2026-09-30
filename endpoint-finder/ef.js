#!/usr/bin/env node
/**
 * EndpointFinder для Crucix v2
 * - Сканирование /data и /basket
 * - Обновление crucix.config.mjs
 * - Экспорт в Flowsint
 * - Генерация отчётов
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CONFIG = {
  dataDir: path.join(ROOT, 'data'),
  basketDir: path.join(ROOT, 'data', 'basket'),
  configFile: path.join(ROOT, 'crucix.config.mjs'),
  outputDir: path.join(__dirname, 'exports'),
  flowsintDir: path.join(ROOT, '..', 'Flowsint'),
};

const c = { reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m' };
function log(msg, color = 'reset') { console.log(`${c[color]}${msg}${c.reset}`); }

function findEndpoints(dir) {
  const endpoints = [];
  if (!fs.existsSync(dir)) return endpoints;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      const files = fs.readdirSync(fullPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const csvFiles = files.filter(f => f.endsWith('.csv'));
      if (jsonFiles.length > 0 || csvFiles.length > 0) {
        endpoints.push({
          name: item.name,
          path: fullPath,
          type: 'directory',
          files: { json: jsonFiles.length, csv: csvFiles.length },
          lastModified: fs.statSync(fullPath).mtime,
        });
      }
    } else if (item.isFile() && (item.name.endsWith('.json') || item.name.endsWith('.csv'))) {
      endpoints.push({
        name: item.name.replace(/\.[^.]+$/, ''),
        path: fullPath,
        type: 'file',
        ext: path.extname(item.name),
        size: fs.statSync(fullPath).size,
        lastModified: fs.statSync(fullPath).mtime,
      });
    }
  }
  return endpoints;
}

function updateConfig(endpoints) {
  if (!fs.existsSync(CONFIG.configFile)) {
    log(`⚠️  ${CONFIG.configFile} не найден, создаю новый`, 'yellow');
  }
  
  // Генерируем объект источников
  const sources = {};
  for (const ep of endpoints) {
    const key = ep.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    sources[key] = {
      name: ep.name,
      path: ep.path.replace(ROOT, ''),
      type: ep.type,
      enabled: true,
      lastUpdate: ep.lastModified.toISOString(),
    };
  }
  
  const configContent = `// Автоматически сгенерировано EndpointFinder ${new Date().toISOString()}
export default {
  version: '1.0.0',
  generated: '${new Date().toISOString()}',
  sources: ${JSON.stringify(sources, null, 2)},
  layers: {
    economic: ['gold-oil', 'sp500-vix', 'crypto-fear', 'dxy', 'yield-curve'],
    geopolitical: ['conflicts', 'military-bases', 'sanctions', 'pipelines'],
    environmental: ['fires', 'earthquakes', 'firms', 'openaq'],
    cyber: ['cyber-attacks', 'cyber-threats', 'starlink'],
    social: ['happiness', 'social-unrest', 'google-trends'],
  }
};
`;
  
  // Бэкап старого конфига
  if (fs.existsSync(CONFIG.configFile)) {
    const backup = CONFIG.configFile + '.backup';
    fs.copyFileSync(CONFIG.configFile, backup);
    log(`   📄 Бэкап: ${backup}`, 'green');
  }
  
  fs.writeFileSync(CONFIG.configFile, configContent);
  log(`   ✅ Конфиг обновлён: ${CONFIG.configFile}`, 'green');
  return true;
}

function exportToFlowsint(endpoints) {
  const flowsintDir = CONFIG.flowsintDir;
  if (!fs.existsSync(flowsintDir)) {
    log(`   ⚠️ Flowsint не найден (${flowsintDir})`, 'yellow');
    return false;
  }
  
  const importDir = path.join(flowsintDir, 'imports');
  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
  }
  
  const data = {
    timestamp: new Date().toISOString(),
    source: 'Crucix EndpointFinder',
    version: '1.0.0',
    endpoints: endpoints.map(ep => ({
      id: ep.name,
      path: ep.path,
      type: ep.type,
      lastModified: ep.lastModified,
      files: ep.files || null,
    })),
  };
  
  const file = path.join(importDir, `crucix-endpoints-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  log(`   🔄 Экспорт в Flowsint: ${file}`, 'green');
  return true;
}

function generateReport(endpoints) {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    totalEndpoints: endpoints.length,
    byType: {
      directory: endpoints.filter(e => e.type === 'directory').length,
      file: endpoints.filter(e => e.type === 'file').length,
    },
    endpoints: endpoints.map(e => ({
      name: e.name,
      type: e.type,
      path: e.path.replace(ROOT, ''),
      lastModified: e.lastModified,
    })),
  };
  
  const file = path.join(CONFIG.outputDir, `report-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

function main() {
  log('🔍 EndpointFinder для Crucix v2', 'cyan');
  log('═'.repeat(50), 'cyan');
  
  log('\n📂 Сканирование данных...', 'blue');
  const endpoints = findEndpoints(CONFIG.dataDir);
  log(`   Найдено ${endpoints.length} эндпоинтов`, 'green');
  
  if (endpoints.length === 0) {
    log('⚠️  Эндпоинты не найдены', 'yellow');
    return;
  }
  
  log('\n📋 Найденные эндпоинты:', 'blue');
  const shown = endpoints.slice(0, 15);
  for (const ep of shown) {
    const size = ep.type === 'file' ? ` (${(ep.size / 1024).toFixed(1)} KB)` : '';
    log(`   • ${ep.name} [${ep.type}]${size}`, 'green');
  }
  if (endpoints.length > 15) {
    log(`   ... и ещё ${endpoints.length - 15}`, 'yellow');
  }
  
  log('\n⚙️  Обновление конфигурации...', 'blue');
  updateConfig(endpoints);
  
  log('\n🔄 Экспорт в Flowsint...', 'blue');
  exportToFlowsint(endpoints);
  
  log('\n📊 Генерация отчёта...', 'blue');
  const reportFile = generateReport(endpoints);
  log(`   Отчёт: ${reportFile}`, 'green');
  
  log('\n' + '═'.repeat(50), 'cyan');
  log('✅ Готово!', 'green');
  log(`   Найдено эндпоинтов: ${endpoints.length}`, 'green');
  log(`   Конфиг: ${CONFIG.configFile}`, 'green');
  log(`   Отчёт: ${reportFile}`, 'green');
}

main();
