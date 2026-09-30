// Crucix — EntityExtraction
// Извлечение именованных сущностей (NER) из текста: страны, организации, люди, места.

const COUNTRY_HINTS = {
  'ukraine': 'UKR', 'russia': 'RUS', 'china': 'CHN', 'united states': 'USA',
  'israel': 'ISR', 'iran': 'IRN', 'gaza': 'PSE', 'syria': 'SYR', 'iraq': 'IRQ',
  'germany': 'DEU', 'france': 'FRA', 'uk': 'GBR', 'japan': 'JPN', 'india': 'IND',
};

export default class EntityExtraction {
  constructor(opts = {}) {
    this.entities = new Map();
    this.minConfidence = opts.minConfidence ?? 0.5;
  }

  extract(text, opts = {}) {
    const found = [];
    const lower = text.toLowerCase();
    // Страны
    for (const [name, code] of Object.entries(COUNTRY_HINTS)) {
      if (lower.includes(name)) {
        found.push({ text: name, type: 'country', code, confidence: 0.85 });
      }
    }
    // Организации (заглавные слова)
    const orgs = text.match(/\b(?:NATO|UN|WHO|IMF|OPEC|IAEA|FBI|CIA|EU|Pentagon|Kremlin)\b/g) || [];
    for (const o of new Set(orgs)) found.push({ text: o, type: 'organization', confidence: 0.9 });
    // Персоны (два заглавных слова рядом)
    const persons = text.match(/\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g) || [];
    for (const p of new Set(persons.slice(0, 10))) {
      if (!COUNTRY_HINTS[p.toLowerCase()]) found.push({ text: p, type: 'person', confidence: 0.6 });
    }
    // Дата/время
    const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g) || [];
    for (const d of new Set(dates)) found.push({ text: d, type: 'date', confidence: 0.9 });

    const filtered = found.filter(f => f.confidence >= this.minConfidence);
    for (const f of filtered) {
      const key = `${f.type}:${f.text.toLowerCase()}`;
      if (!this.entities.has(key)) this.entities.set(key, { ...f, count: 0 });
      this.entities.get(key).count++;
    }
    return filtered;
  }

  getAll() { return [...this.entities.values()]; }
  topN(n = 20) { return this.getAll().sort((a, b) => b.count - a.count).slice(0, n); }
  byType(type) { return this.getAll().filter(e => e.type === type); }
}
