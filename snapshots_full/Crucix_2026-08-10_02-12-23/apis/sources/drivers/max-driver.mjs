/**
 * Драйвер для MAX (российский мессенджер)
 * 
 * Использует официальный REST API MAX.
 * Требуется регистрация через Госуслуги и получение API-ключа.
 * 
 * Конфигурация через переменные окружения:
 * - MAX_API_KEY = API-ключ
 * - MAX_API_URL = https://api.max.ru/v1 (по умолчанию)
 * - MAX_CHANNELS = список каналов через запятую
 */

import { BaseDriver } from './base.mjs';

export class MAXDriver extends BaseDriver {
  constructor() {
    super();
    this.name = 'max';
    this.apiKey = process.env.MAX_API_KEY || '';
    this.apiUrl = process.env.MAX_API_URL || 'https://api.max.ru/v1';
    this.channels = (process.env.MAX_CHANNELS || '').split(',').filter(Boolean);
    this.timeout = 30000;
  }

  async checkAvailability() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

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
    const limit = options.limit || 100;
    const channel = options.channel || null;

    if (!this.apiKey) {
      throw new Error('MAX_API_KEY не задан. Получите ключ через регистрацию в MAX.');
    }

    if (this.channels.length === 0 && !channel) {
      throw new Error('Не указаны каналы для мониторинга. Установите MAX_CHANNELS или передайте channel в options.');
    }

    const targetChannels = channel ? [channel] : this.channels;
    const allItems = [];

    for (const ch of targetChannels) {
      try {
        const messages = await this.fetchChannel(ch, limit);
        allItems.push(...messages);
      } catch (error) {
        console.error(`[MAXDriver] Ошибка при загрузке канала ${ch}:`, error.message);
      }
    }

    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    return this.normalize(allItems, 'max');
  }

  async fetchChannel(channelId, limit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiUrl}/channels/${channelId}/messages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      return (data.messages || []).slice(0, limit).map(msg => ({
        id: msg.id || `max-${Date.now()}-${Math.random()}`,
        title: msg.title || msg.text?.slice(0, 100) || 'Без заголовка',
        date: msg.date || msg.created_at || new Date().toISOString(),
        url: msg.url || `https://max.ru/channel/${channelId}/post/${msg.id}`,
        summary: msg.text || msg.description || '',
        source: 'MAX',
        sourceId: channelId,
        category: this.detectCategory(msg),
        language: 'ru',
        type: 'message',
        raw: msg,
      }));
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  detectCategory(msg) {
    const text = (msg.title || '' + msg.text || msg.description || '').toLowerCase();
    if (text.includes('войн') || text.includes('атак') || text.includes('конфликт')) return 'security';
    if (text.includes('закон') || text.includes('указ') || text.includes('постановл')) return 'politics';
    if (text.includes('рубл') || text.includes('цена') || text.includes('рынок')) return 'economy';
    if (text.includes('пожар') || text.includes('землетряс') || text.includes('катастроф')) return 'disaster';
    return 'general';
  }

  getDriverName() {
    return 'MAX (Россия)';
  }
}
EOF