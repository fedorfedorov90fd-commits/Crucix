// apis/sources/smartscroll-local/processing/normalizer.mjs
// Нормализация сырых событий и извлечение сущностей.

export class Normalizer {
  constructor() {
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
      'это', 'что', 'для', 'на', 'в', 'с', 'по', 'от', 'до', 'и', 'или',
      'но', 'не', 'как', 'так', 'его', 'её', 'их', 'который',
    ]);

    this.entityPatterns = [
      /\b([A-Z]{2,6})\b/g,
      /\b([A-ZА-ЯЁ][a-zа-яё]{2,20})\b/g,
      /\b(\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря))\b/gi,
      /\b((?:рейс|flight)\s+\w+\d*)\b/gi,
    ];
  }

  normalize(raw) {
    const title = this._cleanText(raw.title || '');
    const body = this._cleanText(raw.body || '');
    const entities = this._extractEntities(`${title} ${body}`);

    return {
      id: raw.id || this._genId(raw),
      source: raw.source || 'unknown',
      published_at: this._normalizeDate(raw.published_at),
      title,
      body: body.slice(0, 10000),
      entities,
      story_id: null,
      related_stories: [],
      url: raw.url || '',
      category: raw.category || 'general',
    };
  }

  normalizeBatch(raws) {
    return raws.map(r => this.normalize(r));
  }

  _cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  _extractEntities(text) {
    const entities = new Set();

    for (const pattern of this.entityPatterns) {
      const globalPattern = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = globalPattern.exec(text)) !== null) {
        const ent = match[1] || match[0];
        const lower = ent.toLowerCase();
        if (this.stopWords.has(lower)) continue;
        if (ent.length < 2) continue;
        entities.add(ent);
      }
    }

    return [...entities].slice(0, 30);
  }

  _normalizeDate(date) {
    if (!date) return new Date().toISOString();
    try {
      return new Date(date).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  _genId(raw) {
    const input = `${raw.source}:${raw.title}:${raw.published_at}`;
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = ((h << 5) - h) + input.charCodeAt(i);
      h |= 0;
    }
    return `auto_${Math.abs(h).toString(36)}`;
  }
}
