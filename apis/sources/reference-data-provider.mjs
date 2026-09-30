// Crucix — ReferenceDataProvider
// Централизованный доступ к справочникам из data/reference/.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE_DIR = join(__dirname, '..', '..', 'data', 'reference');

export default class ReferenceDataProvider {
  constructor() {
    this.cache = new Map();
  }
  load(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const path = join(REFERENCE_DIR, name.endsWith('.json') ? name : name + '.json');
    if (!existsSync(path)) return null;
    try {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      this.cache.set(name, data);
      return data;
    } catch { return null; }
  }
  getCountry(code) {
    const chars = this.load('country-characteristics');
    return chars?.countries?.[code] || null;
  }
  getCountryByName(name) {
    const chars = this.load('country-characteristics');
    if (!chars) return null;
    const lower = String(name).toLowerCase();
    for (const [code, c] of Object.entries(chars.countries || {})) {
      if (c.name?.toLowerCase() === lower || c.nameRu?.toLowerCase() === lower) return { code, ...c };
    }
    return null;
  }
  getGini(code) {
    const g = this.load('gini-index');
    return g?.gini?.[code] || null;
  }
  getAlias(name) {
    const a = this.load('country-aliases');
    return a?.aliases?.[name] || null;
  }
  listAvailable() {
    if (!existsSync(REFERENCE_DIR)) return [];
    const fs = require('fs');
    return fs.readdirSync(REFERENCE_DIR).filter(f => f.endsWith('.json'));
  }
  stats() {
    return { cached: this.cache.size, cached_keys: [...this.cache.keys()] };
  }
}
