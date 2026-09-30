// scripts/collectors/lib/telegram-collector.mjs
// Чтение публичных Telegram-каналов через t.me/s/.

import { BaseCollector } from './base-collector.mjs';

export class TelegramCollector extends BaseCollector {
  constructor(source) {
    super(source);
    this.sourceType = 'telegram';
    this.channel = source.channel || source.url?.replace(/.*t\.me\//, '') || '';
    this.previewUrl = `https://t.me/s/${this.channel}`;
  }

  async collect() {
    const res = await this._fetch(this.previewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Crucix/SmartScroll)',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) {
      throw new Error(`Telegram ${this.channel}: HTTP ${res.status}`);
    }
    const html = await res.text();
    return this._parseHtml(html);
  }

  _parseHtml(html) {
    const events = [];
    const postRe = /data-post="([^"]+)"[\s\S]*?(?=data-post="|$)/gi;
    let match;
    while ((match = postRe.exec(html)) !== null) {
      const postId = match[1];
      const block = match[0];

      const text = this._extractText(block);
      const time = this._extractTime(block);
      const link = `https://t.me/${postId}`;

      if (!text) continue;

      events.push({
        id: this.hashId(postId),
        source: `telegram:${this.channel}`,
        published_at: time,
        title: text.slice(0, 120).split('\n')[0],
        body: text.slice(0, 5000),
        url: link,
        category: this.category,
      });
    }

    return events;
  }

  _extractText(block) {
    const textRe = /tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
    const m = block.match(textRe);
    if (!m) return '';
    return m[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, '')
      .trim();
  }

  _extractTime(block) {
    const timeRe = /<time[^>]*datetime="([^"]+)"/i;
    const m = block.match(timeRe);
    if (m) {
      try { return new Date(m[1]).toISOString(); } catch {}
    }
    return new Date().toISOString();
  }
}
