#!/usr/bin/env node
// scripts/generate-feeds-opml.mjs
// Генератор data/feeds/feeds.opml из data/feeds/rss-catalog.json.
// Берёт только записи со статусом ok (и опционально redirect).
// Группирует по категории. Сохраняет бэкап старого OPML.
// Использование:
//   node scripts/generate-feeds-opml.mjs               (только ok, группа по category)
//   node scripts/generate-feeds-opml.mjs --include-redirect
//   node scripts/generate-feeds-opml.mjs --dry         (не сохранять)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'feeds', 'rss-catalog.json');
const OPML_PATH    = path.join(ROOT, 'data', 'feeds', 'feeds.opml');
const BACKUP_DIR   = path.join(ROOT, 'backups', 'feeds-opml');

const argv = process.argv.slice(2);
const INCLUDE_REDIRECT = argv.includes('--include-redirect');
const DRY = argv.includes('--dry');

const CATEGORY_LABELS = {
  news:     'Новости',
  politics: 'Политика',
  economy:  'Экономика',
  world:    'Мир',
  opinion:  'Мнения',
  tech:     'Технологии',
  science:  'Наука',
  military: 'Военное',
  other:    'Прочее'
};

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error('Каталог не найден: ' + CATALOG_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

function selectEntries(catalog) {
  const wanted = INCLUDE_REDIRECT ? ['ok', 'redirect'] : ['ok'];
  return (catalog.entries || []).filter(e => wanted.includes(e.status));
}

function groupByCategory(entries) {
  const groups = new Map();
  for (const e of entries) {
    const cat = e.category || 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(e);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => (a.tier || 9) - (b.tier || 9) || a.name.localeCompare(b.name, 'ru'));
  }
  return groups;
}

function buildOpml(catalog, groups) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<opml version="1.0">');
  lines.push('  <head>');
  lines.push('    <title>Crucix RSS Feeds</title>');
  lines.push('    <dateCreated>' + now + '</dateCreated>');
  lines.push('    <dateModified>' + now + '</dateModified>');
  lines.push('    <ownerName>Crucix</ownerName>');
  lines.push('    <docs>Generated from data/feeds/rss-catalog.json (schema ' + (catalog.schema || 'crucix.rss-catalog.v1') + ')</docs>');
  lines.push('  </head>');
  lines.push('  <body>');

  const sortedCats = [...groups.keys()].sort();
  for (const cat of sortedCats) {
    const label = CATEGORY_LABELS[cat] || cat;
    const arr = groups.get(cat);
    lines.push('    <outline text="' + escapeXml(label) + '">');
    for (const e of arr) {
      const text = escapeXml(e.name + (e.tier ? ' [T' + e.tier + ']' : ''));
      const url = escapeXml(e.url);
      lines.push('      <outline type="rss" text="' + text + '" xmlUrl="' + url + '"/>');
    }
    lines.push('    </outline>');
  }

  lines.push('  </body>');
  lines.push('</opml>');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const catalog = loadCatalog();
  const selected = selectEntries(catalog);
  const groups = groupByCategory(selected);
  const opml = buildOpml(catalog, groups);

  console.log('Записей в каталоге: ' + (catalog.entries || []).length);
  console.log('Отобрано (status=' + (INCLUDE_REDIRECT ? 'ok+redirect' : 'ok') + '): ' + selected.length);
  console.log('Категорий: ' + groups.size);
  for (const [cat, arr] of [...groups.entries()].sort()) {
    console.log('  ' + cat + ': ' + arr.length);
  }

  if (DRY) {
    console.log('');
    console.log('--- ПРЕДПРОСМОТР OPML (первые 40 строк) ---');
    console.log(opml.split('\n').slice(0, 40).join('\n'));
    console.log('--- конец предпросмотра ---');
    console.log('Режим --dry: файл НЕ записан.');
    return;
  }

  ensureDir(BACKUP_DIR);
  if (fs.existsSync(OPML_PATH)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(BACKUP_DIR, 'feeds.' + ts + '.opml');
    fs.copyFileSync(OPML_PATH, backup);
    console.log('Бэкап старого OPML: ' + backup);
  }

  fs.writeFileSync(OPML_PATH, opml, 'utf8');
  console.log('OPML записан: ' + OPML_PATH);
  console.log('Размер: ' + opml.length + ' байт');
}

main();
