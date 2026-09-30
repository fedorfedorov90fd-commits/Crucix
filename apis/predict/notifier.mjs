// apis/predict/notifier.mjs
// Уведомления о прогнозах: Discord, Telegram, custom webhook.
//
// Назначение:
//   Отправка критичных событий прогностического слоя во внешние каналы.
//   Работает полностью автономно: если каналы не настроены (нет
//   переменных окружения) — просто ничего не делает, не падает.
//
// Каналы:
//   1. Discord — через webhook URL, формат embed с цветом по уровню.
//   2. Telegram — через bot token + chat_id, формат Markdown.
//   3. Custom webhook — POST с JSON payload, поддержка HMAC-подписи.
//
// Особенности:
//   * Rate-limit: не более N уведомлений в час (по умолчанию 10).
//   * Приоритизация: critical > high > signal_high > regime_change.
//   * Логирование всех отправленных уведомлений в runs/notifications.log.json
//   * Автоматическое форматирование текста под каждый канал.
//   * Никаких обязательных зависимостей — только fetch и node:fs.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, '..', '..', 'runs');
const LOG_FILE = join(RUNS_DIR, 'notifications.log.json');

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

const DEFAULT_CONFIG = {
  discord: {
    enabled: !!process.env.CRUCIX_DISCORD_WEBHOOK,
    webhookUrl: process.env.CRUCIX_DISCORD_WEBHOOK || '',
    username: process.env.CRUCIX_DISCORD_USERNAME || 'Crucix',
    avatarUrl: process.env.CRUCIX_DISCORD_AVATAR || '',
  },
  telegram: {
    enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    parseMode: 'Markdown',
  },
  webhook: {
    enabled: !!process.env.CRUCIX_WEBHOOK_URL,
    url: process.env.CRUCIX_WEBHOOK_URL || '',
    secret: process.env.CRUCIX_WEBHOOK_SECRET || '',
    timeoutMs: 5000,
  },
  rateLimit: {
    maxPerHour: parseInt(process.env.CRUCIX_NOTIFY_MAX_PER_HOUR || '10', 10),
  },
  thresholds: {
    composite: 0.5,
    compositeCritical: 0.7,
    signalHigh: 0.7,
    changeProbability: 0.6,
  },
};

// ============================================================
// ЛОГ
// ============================================================

function loadLog() {
  if (!existsSync(LOG_FILE)) return { sent: [] };
  try {
    return JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
  } catch {
    return { sent: [] };
  }
}

function saveLog(log) {
  try {
    if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
    // Ограничиваем историю 1000 записями
    if (log.sent.length > 1000) log.sent = log.sent.slice(-1000);
    writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  } catch {
    // Игнорируем ошибки записи
  }
}

// ============================================================
// NOTIFIER
// ============================================================

class Notifier {
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      discord: { ...DEFAULT_CONFIG.discord, ...(config.discord || {}) },
      telegram: { ...DEFAULT_CONFIG.telegram, ...(config.telegram || {}) },
      webhook: { ...DEFAULT_CONFIG.webhook, ...(config.webhook || {}) },
      rateLimit: { ...DEFAULT_CONFIG.rateLimit, ...(config.rateLimit || {}) },
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...(config.thresholds || {}) },
    };
    this.log = loadLog();
  }

  /**
   * Проверка rate-limit.
   */
  _rateLimitOk() {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const recent = this.log.sent.filter((s) => new Date(s.timestamp).getTime() > hourAgo);
    return recent.length < this.config.rateLimit.maxPerHour;
  }

  /**
   * Форматирование прогноза в текст для каналов.
   */
  formatPrediction(prediction) {
    const lines = [];
    lines.push(`🔮 Crucix Forecast — ${new Date().toISOString().slice(0, 16)}`);

    if (prediction && prediction.compositeRisk) {
      const cr = prediction.compositeRisk;
      const emoji = { low: '🟢', moderate: '🟢', elevated: '🟡', high: '🟠', critical: '🔴' }[cr.level] || '⚪';
      lines.push('');
      lines.push(`${emoji} Composite Risk: ${(cr.composite || 0).toFixed(3)} (${cr.level || 'unknown'})`);
      if (cr.confidence) lines.push(`Confidence: ${cr.confidence}`);
    }

    if (prediction && Array.isArray(prediction.topRisks) && prediction.topRisks.length > 0) {
      lines.push('');
      lines.push('Top Risks:');
      for (const r of prediction.topRisks.slice(0, 5)) {
        const pct = ((r.probability || 0) * 100).toFixed(0);
        const bar = '█'.repeat(Math.round((r.probability || 0) * 10)) +
                    '░'.repeat(10 - Math.round((r.probability || 0) * 10));
        lines.push(`${bar} ${pct}% — ${r.name}`);
      }
    }

    if (prediction && prediction.extended && prediction.extended.changePointVix
        && prediction.extended.changePointVix.changeProbability > 0.5) {
      lines.push('');
      lines.push(`⚠ Regime change detected (P=${(prediction.extended.changePointVix.changeProbability * 100).toFixed(0)}%)`);
    }

    if (prediction && prediction.combinedCausalSignal) {
      lines.push('');
      lines.push(`🔗 ${prediction.combinedCausalSignal.type} (severity: ${prediction.combinedCausalSignal.severity})`);
    }

    return lines.join('\n');
  }

  /**
   * Анализ прогноза: какие уведомления надо отправить.
   */
  analyze(prediction) {
    const notifications = [];
    const cr = prediction && prediction.compositeRisk;
    if (!cr) return notifications;

    // Critical
    if (cr.composite >= this.config.thresholds.compositeCritical) {
      notifications.push({
        type: 'critical',
        title: `🔴 CRITICAL: Composite ${cr.composite.toFixed(3)}`,
        body: this._formatCompositeBody(cr),
        priority: 10,
      });
    } else if (cr.composite >= this.config.thresholds.composite) {
      notifications.push({
        type: 'high',
        title: `🟠 HIGH: Composite ${cr.composite.toFixed(3)}`,
        body: this._formatCompositeBody(cr),
        priority: 7,
      });
    }

    // Signals high
    if (Array.isArray(cr.signals)) {
      for (const sig of cr.signals) {
        if (sig.value >= this.config.thresholds.signalHigh) {
          notifications.push({
            type: 'signal_high',
            title: `🔺 Signal: ${sig.name} = ${(sig.value * 100).toFixed(1)}%`,
            body: `Weight: ×${(sig.weight || 1).toFixed(2)}\n${sig.rationale || ''}`,
            priority: 5,
          });
        }
      }
    }

    // Regime change
    if (prediction.extended && prediction.extended.changePointVix
        && prediction.extended.changePointVix.changeProbability >= this.config.thresholds.changeProbability) {
      notifications.push({
        type: 'regime_change',
        title: `🔄 Regime change (P=${(prediction.extended.changePointVix.changeProbability * 100).toFixed(0)}%)`,
        body: `Regime age: ${prediction.extended.changePointVix.regimeAge} steps`,
        priority: 8,
      });
    }

    notifications.sort((a, b) => b.priority - a.priority);
    return notifications;
  }

  _formatCompositeBody(cr) {
    const drivers = (cr.topDrivers || []).slice(0, 3)
      .map((d) => `• ${d.name}: ${(d.value * 100).toFixed(0)}%`)
      .join('\n');
    return `Level: ${cr.level} · confidence: ${cr.confidence}\n\nTop drivers:\n${drivers}`;
  }

  /**
   * Отправка одного уведомления во все включённые каналы.
   */
  async send(notification) {
    if (!this._rateLimitOk()) {
      return { sent: 0, reason: 'rate_limit' };
    }

    const results = {
      discord: null,
      telegram: null,
      webhook: null,
    };

    if (this.config.discord.enabled && this.config.discord.webhookUrl) {
      results.discord = await this._sendDiscord(notification);
    }
    if (this.config.telegram.enabled && this.config.telegram.botToken) {
      results.telegram = await this._sendTelegram(notification);
    }
    if (this.config.webhook.enabled && this.config.webhook.url) {
      results.webhook = await this._sendWebhook(notification);
    }

    this.log.sent.push({
      timestamp: new Date().toISOString(),
      type: notification.type,
      title: notification.title,
      results,
    });
    saveLog(this.log);

    const sentCount = [results.discord, results.telegram, results.webhook]
      .filter((r) => r && r.ok).length;

    return { sent: sentCount, results };
  }

  async _sendDiscord(notification) {
    try {
      const color = {
        critical: 0xef4444,
        high: 0xf97316,
        signal_high: 0x8b5cf6,
        regime_change: 0x06b6d4,
      }[notification.type] || 0x3b82f6;

      const payload = {
        username: this.config.discord.username,
        embeds: [{
          title: notification.title,
          description: notification.body,
          color,
          timestamp: new Date().toISOString(),
          footer: { text: 'Crucix Prediction Engine' },
        }],
      };

      const res = await fetch(this.config.discord.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async _sendTelegram(notification) {
    try {
      const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;
      const text = `*${notification.title}*\n\n${notification.body}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegram.chatId,
          text,
          parse_mode: this.config.telegram.parseMode,
        }),
        signal: AbortSignal.timeout(5000),
      });

      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async _sendWebhook(notification) {
    try {
      const payload = {
        ...notification,
        timestamp: new Date().toISOString(),
        source: 'crucix-prediction',
      };

      const headers = { 'Content-Type': 'application/json' };
      if (this.config.webhook.secret) {
        const body = JSON.stringify(payload);
        const sig = createHmac('sha256', this.config.webhook.secret)
          .update(body).digest('hex');
        headers['X-Crucix-Signature'] = sig;
      }

      const res = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.webhook.timeoutMs),
      });

      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Полный цикл: анализ + отправка.
   */
  async process(prediction) {
    const notifications = this.analyze(prediction);
    const results = [];
    for (const n of notifications) {
      const r = await this.send(n);
      results.push({ notification: n, result: r });
    }
    return { notifications: notifications.length, results };
  }

  /**
   * Статистика для диагностики.
   */
  stats() {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const recent = this.log.sent.filter((s) => new Date(s.timestamp).getTime() > hourAgo);
    return {
      totalSent: this.log.sent.length,
      lastHour: recent.length,
      rateLimitMax: this.config.rateLimit.maxPerHour,
      channels: {
        discord: this.config.discord.enabled,
        telegram: this.config.telegram.enabled,
        webhook: this.config.webhook.enabled,
      },
    };
  }
}

// ============================================================
// Singleton + обёртки
// ============================================================

let _instance = null;

function getNotifier(config) {
  if (!_instance) _instance = new Notifier(config);
  return _instance;
}

async function notifyPrediction(prediction, config) {
  try {
    const n = getNotifier(config);
    return await n.process(prediction);
  } catch (e) {
    return { notifications: 0, error: e.message };
  }
}

function notifierStatus(config) {
  const n = getNotifier(config);
  return n.stats();
}

export {
  Notifier,
  getNotifier,
  notifyPrediction,
  notifierStatus,
  DEFAULT_CONFIG,
};
