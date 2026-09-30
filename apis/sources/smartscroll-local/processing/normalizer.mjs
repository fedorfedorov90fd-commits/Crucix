// apis/sources/smartscroll-local/processing/normalizer.mjs
// Версия 2.0.0. Принят 26.09.2026.
//
// Нормализация сырых событий и извлечение сущностей.
//
// ИЗМЕНЕНИЯ v1.0.0 → v2.0.0:
//   + Маппинг домена в геополитический полюс (russian / western / non_aligned / unknown).
//     ПРИЧИНА: SmartScroll нормализует события, но не знает кто источник.
//     Для bias-aware анализа нужно знать полюс каждой новости.
//   + Метод _detectPole(source) через apis/sources/source-camps.json (67 источников).
//   + Поле pole в выходной записи нормализованного события.
//   + Кэш правил в памяти инстанса (не перечитывать source-camps.json на каждое событие).
//   + Приоритетные правила для конфликтов (forbes.ru → russian, forbes.com → western).
//
// ПОЛНЫЙ ФАЙЛ ЗАМЕНЫ (не патч).

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const SOURCE_CAMPS_PATH = join(PROJECT_ROOT, 'apis', 'sources', 'source-camps.json');

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

    // v2.0.0: маппинг домена в полюс
    this._poleRules = this._loadPoleRules();
  }

  // v2.0.0: загрузка правил полярности из source-camps.json
  _loadPoleRules() {
    if (!existsSync(SOURCE_CAMPS_PATH)) {
      console.warn(`[normalizer] source-camps.json not found: ${SOURCE_CAMPS_PATH}`);
      return [];
    }
    try {
      const camps = JSON.parse(readFileSync(SOURCE_CAMPS_PATH, 'utf8'));
      const rules = [];
      const ms = camps.media_sources || {};
      for (const [pole, cfg] of Object.entries(ms)) {
        const sources = Array.isArray(cfg.sources) ? cfg.sources : [];
        for (const substr of sources) {
          if (typeof substr === 'string' && substr.length >= 2) {
            rules.push({ substr: substr.toLowerCase(), pole });
          }
        }
      }
      // Длинные подстроки — приоритетнее
      rules.sort((a, b) => b.substr.length - a.substr.length);
      return rules;
    } catch (err) {
      console.warn(`[normalizer] source-camps.json read error: ${err.message}`);
      return [];
    }
  }

  // v2.0.0: определение полюса источника по домену
  _detectPole(source) {
    if (!source || typeof source !== 'string') return 'unknown';
    const s = source.toLowerCase();

    // Приоритетные правила для известных конфликтов
    if (/forbes/.test(s) && /\.ru\b/.test(s)) return 'russian';
    if (/forbes/.test(s) && /\.com\b/.test(s)) return 'western';

    // Общий маппинг через source-camps.json
    for (const rule of this._poleRules) {
      if (s.includes(rule.substr)) return rule.pole;
    }
    return 'unknown';
  }

  normalize(raw) {
    const title = this._cleanText(raw.title || '');
    const body = this._cleanText(raw.body || '');
    const entities = this._extractEntities(`${title} ${body}`);
    // v2.0.0: определяем полюс
    const source = raw.source || 'unknown';
    const pole = this._detectPole(source);

    return {
      id: raw.id || this._genId(raw),
      source,
      pole,
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
