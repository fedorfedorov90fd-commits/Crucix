// scripts/collectors/lib/rss-collector.mjs
// Версия 2.0.0. Принят 26.09.2026.
//
// RSS 2.0 + Atom parser.
// Primary: rss-parser (if available in node_modules).
// Fallback: built-in regex parser.
// Date validation: rejects dates older than 10 years and in the future.
//
// ИЗМЕНЕНИЯ v1.0.0 → v2.0.0:
//   + Детекция кодировки из XML declaration (windows-1251 / koi8-r / utf-8).
//     ПРИЧИНА: российские фиды (iz.ru, часть региональных) отдают cp1251.
//     Node.js res.text() декодирует как UTF-8 → битые заголовки.
//     Решение: читаем ArrayBuffer, детектируем encoding из первой строки,
//     декодируем через TextDecoder с нужной кодировкой.
//   + Метод _detectEncoding(buffer) — парсит <?xml version="1.0" encoding="..."?>.
//   + Метод _decodeBuffer(buffer) — возвращает строку в правильной кодировке.
//   + Fallback: если encoding не найден, пробуем utf-8.

import { BaseCollector } from './base-collector.mjs';

const MIN_YEAR = new Date().getFullYear() - 10;
const MAX_FUTURE_HOURS = 24;

export class RSSCollector extends BaseCollector {
  constructor(source) {
    super(source);
    this.sourceType = 'rss';
    this._parser = null;
  }

  async _getParser() {
    if (this._parser !== null) return this._parser;
    try {
      const mod = await import('rss-parser');
      this._parser = new mod.default({ timeout: this.timeoutMs });
      return this._parser;
    } catch {
      this._parser = false;
      return false;
    }
  }

  async collect() {
    const res = await this._fetch(this.url, {
      headers: { 'User-Agent': 'Crucix/SmartScroll RSSCollector' },
    });
    if (!res.ok) {
      throw new Error(`RSS ${this.name}: HTTP ${res.status}`);
    }
    // v2.0.0: читаем ArrayBuffer, декодируем правильно
    const buffer = Buffer.from(await res.arrayBuffer());
    const xml = this._decodeBuffer(buffer);

    const parser = await this._getParser();
    if (parser) {
      try {
        const parsed = await parser.parseString(xml);
        return this._fromParsed(parsed);
      } catch (err) {
        console.warn(`[rss-collector] rss-parser failed for ${this.name}: ${err.message}, falling back to regex`);
      }
    }
    return this._parseXml(xml);
  }

  // v2.0.0: детекция кодировки из XML declaration
  _detectEncoding(buffer) {
    const head = buffer.slice(0, 256).toString('ascii').toLowerCase();
    const m = head.match(/encoding=["']([^"']+)["']/);
    if (!m) return 'utf-8';
    const enc = m[1].toLowerCase();
    if (enc === 'windows-1251' || enc === 'cp1251') return 'windows-1251';
    if (enc === 'koi8-r' || enc === 'koi8r') return 'koi8-r';
    if (enc === 'utf-8' || enc === 'utf8') return 'utf-8';
    return 'utf-8';
  }

  // v2.0.0: декодирование с учётом кодировки
  _decodeBuffer(buffer) {
    const enc = this._detectEncoding(buffer);
    try {
      const decoder = new TextDecoder(enc, { fatal: false });
      return decoder.decode(buffer);
    } catch {
      return buffer.toString('utf-8');
    }
  }

  _fromParsed(parsed) {
    const events = [];
    const items = parsed.items || [];
    for (const item of items) {
      const title = item.title || '';
      const link = item.link || '';
      const body = this._cleanHtml(item.content || item.contentSnippet || item.summary || '');
      const pubDate = item.isoDate || item.pubDate || null;

      if (!title && !body) continue;

      const publishedAt = this._validateDate(pubDate);
      if (!publishedAt) {
        console.warn(`[rss-collector] invalid date skipped for "${title.slice(0, 40)}" in ${this.name}`);
        continue;
      }

      events.push({
        id: this.hashId(link || title),
        source: `rss:${this.name}`,
        published_at: publishedAt,
        title: this._decodeHtml(title),
        body: body.slice(0, 5000),
        url: link,
        category: this.category,
      });
    }
    return events;
  }

  _parseXml(xml) {
    const events = [];
    const clean = xml.replace(/<!--[\s\S]*?-->/g, '');

    const itemRe = /<item[\s\S]*?<\/item>/gi;
    const atomRe = /<entry[\s\S]*?<\/entry>/gi;

    let items = clean.match(itemRe) || [];
    if (items.length === 0) {
      items = clean.match(atomRe) || [];
    }

    for (const item of items) {
      const event = this._parseItem(item);
      if (event) events.push(event);
    }

    return events;
  }

  _parseItem(itemXml) {
    const getTag = (tag) => {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
      const m = itemXml.match(re);
      if (!m) return '';
      let v = m[1].trim();
      v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      return v.trim();
    };

    const getAttr = (tag, attr) => {
      const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["']`, 'i');
      const m = itemXml.match(re);
      return m ? m[1] : '';
    };

    const title = getTag('title');
    const link = getTag('link') || getAttr('link', 'href');
    const desc = getTag('description') || getTag('summary') || getTag('content');
    const pubDate = getTag('pubDate') || getTag('published') || getTag('updated');

    if (!title && !desc) return null;

    const publishedAt = this._validateDate(pubDate);
    if (!publishedAt) {
      console.warn(`[rss-collector] invalid date skipped for "${title.slice(0, 40)}" in ${this.name}`);
      return null;
    }

    const body = this._cleanHtml(desc);

    return {
      id: this.hashId(link || title),
      source: `rss:${this.name}`,
      published_at: publishedAt,
      title: this._decodeHtml(title),
      body: body.slice(0, 5000),
      url: link,
      category: this.category,
    };
  }

  _validateDate(dateStr) {
    if (!dateStr) return new Date().toISOString();
    let d;
    try {
      d = new Date(dateStr);
    } catch {
      return null;
    }
    if (isNaN(d.getTime())) return null;

    const now = Date.now();
    const year = d.getFullYear();
    const maxFuture = now + MAX_FUTURE_HOURS * 3600 * 1000;

    if (year < MIN_YEAR) return null;
    if (d.getTime() > maxFuture) return null;

    return d.toISOString();
  }

  _cleanHtml(s) {
    return (s || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _decodeHtml(s) {
    return (s || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
}
