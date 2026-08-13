/**
 * Драйвер для Telegram (публичные каналы)
 * 
 * Использует Tor для обхода блокировок.
 * Поддерживает парсинг HTML и JSON-данных.
 */

import { BaseDriver } from './base.mjs';
import { createHash } from 'crypto';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';

export class TelegramDriver extends BaseDriver {
  constructor() {
    super();
    this.name = 'telegram';
    this.channels = (process.env.TELEGRAM_CHANNELS || 'durov,bbc_news,reuters,apnews').split(',').filter(Boolean);
    this.torProxy = process.env.TELEGRAM_TOR_PROXY || 'socks5://127.0.0.1:9050';
    this.timeout = 30000;
    this.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.torAgent = null;

    try {
      this.torAgent = new SocksProxyAgent(this.torProxy);
      console.log('[TelegramDriver] ✅ Tor прокси настроен');
    } catch (e) {
      console.warn('[TelegramDriver] ⚠️ Ошибка настройки Tor:', e.message);
    }
  }

  async fetchWithProxy(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        agent: this.torAgent,
        signal: controller.signal,
        redirect: 'manual',
      });

      clearTimeout(timeout);

      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
        const location = response.headers.get('location');
        if (location) {
          const newUrl = location.startsWith('http') ? location : new URL(location, url).href;
          return this.fetchWithProxy(newUrl);
        }
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async checkAvailability() {
    const testChannel = this.channels[0] || 'durov';
    const url = `https://t.me/s/${testChannel}`;

    try {
      const response = await this.fetchWithProxy(url);
      if (response.ok) {
        this.isAvailable = true;
        this.lastError = null;
        return { available: true, score: 100, latency: 0 };
      } else {
        this.isAvailable = false;
        this.lastError = `HTTP ${response.status}`;
        return { available: false, score: 0, latency: 0 };
      }
    } catch (error) {
      this.isAvailable = false;
      this.lastError = error.message;
      return { available: false, score: 0, latency: 0 };
    }
  }

  async fetch(options = {}) {
    const limit = options.limit || 50;
    const channel = options.channel || null;
    const targetChannels = channel ? [channel] : this.channels;
    const allItems = [];

    for (const ch of targetChannels) {
      try {
        const messages = await this.fetchChannel(ch, limit);
        allItems.push(...messages);
      } catch (error) {
        console.error(`[TelegramDriver] Ошибка при загрузке канала ${ch}:`, error.message);
      }
    }

    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    return this.normalize(allItems, 'telegram');
  }

  async fetchChannel(channelId, limit) {
    const url = `https://t.me/s/${channelId}`;

    try {
      const response = await this.fetchWithProxy(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      
      let messages = [];
      
      messages = this.parseTelegramHtml(html, channelId);
      
      if (messages.length === 0) {
        messages = this.parseTelegramJson(html, channelId);
      }
      
      if (messages.length === 0) {
        messages = this.parseTelegramRegex(html, channelId);
      }

      return messages.slice(0, limit).map(msg => ({
        id: msg.id || this.generateId(msg.date + msg.text),
        title: msg.text?.slice(0, 100) || 'Сообщение',
        date: msg.date || new Date().toISOString(),
        url: msg.url || `https://t.me/${channelId}/${msg.id}`,
        summary: msg.text || '',
        source: 'Telegram',
        sourceId: channelId,
        category: this.detectCategory(msg.text || ''),
        language: this.detectLanguage(msg.text || ''),
        type: 'message',
        raw: msg,
      }));
    } catch (error) {
      throw error;
    }
  }

  parseTelegramHtml(html, channelId) {
    const messages = [];
    const patterns = [
      /<div class="tgme_widget_message"[^>]*data-post="([^"]*)"[^>]*>/gi,
      /<div class="tgme_widget_message js-widget_message"[^>]*data-post="([^"]*)"[^>]*>/gi,
    ];

    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        for (const m of matches) {
          const postId = m[1];
          if (!postId) continue;
          
          const messageBlock = html.substring(m.index, m.index + 5000);
          let text = '';
          const textMatch = messageBlock.match(/<div class="tgme_widget_message_text"[^>]*>([\s\S]*?)<\/div>/);
          if (textMatch) {
            text = this.cleanHtml(textMatch[1]);
          }
          
          let date = new Date().toISOString();
          const dateMatch = messageBlock.match(/<time[^>]*datetime="([^"]*)"/);
          if (dateMatch) {
            date = new Date(dateMatch[1]).toISOString();
          }
          
          if (text) {
            messages.push({
              id: postId.split('/').pop() || `${channelId}-${Date.now()}`,
              text: text,
              date: date,
              url: `https://t.me/${channelId}/${postId.split('/').pop()}`,
              channel: channelId,
            });
          }
        }
        break;
      }
    }
    return messages;
  }

  parseTelegramJson(html, channelId) {
    const messages = [];
    const jsonMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data && data.messages) {
          for (const msg of data.messages) {
            messages.push({
              id: msg.id || `${channelId}-${Date.now()}`,
              text: msg.text || '',
              date: msg.date || new Date().toISOString(),
              url: `https://t.me/${channelId}/${msg.id}`,
              channel: channelId,
            });
          }
        }
      } catch (e) {}
    }
    return messages;
  }

  parseTelegramRegex(html, channelId) {
    const messages = [];
    const postRegex = /data-post="([^"]+?)"/g;
    let match;
    while ((match = postRegex.exec(html)) !== null) {
      const postId = match[1];
      const id = postId.split('/').pop();
      
      const start = Math.max(0, match.index - 2000);
      const end = Math.min(html.length, match.index + 2000);
      const context = html.substring(start, end);
      
      let text = '';
      const textMatch = context.match(/<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (textMatch) {
        text = this.cleanHtml(textMatch[1]);
      }
      
      if (text) {
        messages.push({
          id: id || `${channelId}-${Date.now()}`,
          text: text,
          date: new Date().toISOString(),
          url: `https://t.me/${channelId}/${id}`,
          channel: channelId,
        });
      }
    }
    return messages;
  }

  cleanHtml(html) {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  generateId(input) {
    return createHash('md5').update(input).digest('hex');
  }

  detectCategory(text) {
    const lower = text.toLowerCase();
    if (lower.includes('войн') || lower.includes('атак') || lower.includes('конфликт')) return 'security';
    if (lower.includes('закон') || lower.includes('указ') || lower.includes('постановл')) return 'politics';
    if (lower.includes('рубл') || lower.includes('цена') || lower.includes('рынок')) return 'economy';
    if (lower.includes('пожар') || lower.includes('землетряс') || lower.includes('катастроф')) return 'disaster';
    return 'general';
  }

  detectLanguage(text) {
    const cyrillic = (text.match(/[а-яё]/gi) || []).length;
    const latin = (text.match(/[a-z]/gi) || []).length;
    if (cyrillic > latin * 2) return 'ru';
    if (latin > cyrillic * 2) return 'en';
    return 'mixed';
  }

  getDriverName() {
    return 'Telegram (через Tor)';
  }
}