#!/usr/bin/env node
// Crucix — вставка нового слоя в DEMO_LAYERS (layers.js)
// Использование: node scripts/tools/insert-layer.cjs '<id>' '<name>' '<color>' '<icon>' '<category>' '<vizType>'
// Пример: node scripts/tools/insert-layer.cjs resilience-index 'Индекс устойчивости стран' '#00cc66' '🛡️' 'geopolitical' 'choropleth'

const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', '..', 'dashboard', 'public', 'geo-map', 'js', 'layers.js');

const [,, id, name, color, icon, category, vizType] = process.argv;
if (!id || !name || !color || !icon || !category || !vizType) {
  console.error('Использование: node insert-layer.cjs <id> <name> <color> <icon> <category> <vizType>');
  process.exit(1);
}

let src = fs.readFileSync(F, 'utf-8');

if (src.includes("id: '" + id + "'") || src.includes('id: "' + id + '"')) {
  console.log('SKIP: слой с id="' + id + '" уже есть в layers.js');
  process.exit(0);
}

const lines = src.split('\n');

const anchorIdx = lines.findIndex(l => l.includes("id: 'crucix-weather'"));
if (anchorIdx < 0) {
  console.error('ERR: не найдена anchor-строка (crucix-weather)');
  process.exit(1);
}

let closeIdx = -1;
for (let i = anchorIdx + 1; i <= anchorIdx + 5; i++) {
  if (lines[i] !== undefined && /^\s*\]\s*;\s*$/.test(lines[i])) {
    closeIdx = i;
    break;
  }
}
if (closeIdx < 0) {
  console.error('ERR: не найдена закрывающая ]; после crucix-weather');
  process.exit(1);
}

for (let i = anchorIdx + 1; i < closeIdx; i++) {
  const t = lines[i].trim();
  if (t !== '' && !t.startsWith('//')) {
    console.error('ERR: между anchor и ]; есть код: ' + JSON.stringify(lines[i]));
    process.exit(1);
  }
}

const newLine = "    { id: '" + id + "', name: '" + name + "', color: '" + color + "', icon: '" + icon + "', category: '" + category + "', vizType: '" + vizType + "' },";
lines.splice(closeIdx, 0, newLine);
fs.writeFileSync(F, lines.join('\n'), 'utf-8');
console.log('OK: слой "' + id + '" вставлен перед ]; (строка ' + (closeIdx + 1) + ')');
