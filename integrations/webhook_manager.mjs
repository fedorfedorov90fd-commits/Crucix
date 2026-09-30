// integrations/webhook_manager.mjs
// Менеджер всех интеграций - реестр, retry, приоритеты.
//
// Назначение:
//   Единая точка диспетчеризации результатов прогноза Crucix во внешние системы:
//   Slack, Notion, Obsidian, Email, Generic Webhook.
//   Каждая интеграция имеет приоритет, число retry, env-переменные.
//   Dispatch идёт в порядке убывания приоритета (критичные первыми).
//
// Особенности:
//   - Zero dependencies: только перечисленные модули integrations/*.
//   - Retry с экспоненциальной задержкой (1s, 2s, 4s ...).
//   - Timeout на каждый handler (по умолчанию 30 секунд).
//   - Singleton через getIntegrationManager(), с поддержкой обновления config.
//   - Публичная регистрация интеграций: register(key, def) / unregister(key).

import { SlackClient } from './slack.mjs';
import { NotionClient } from './notion.mjs';
import { ObsidianVault } from './obsidian.mjs';
import { SMTPClient } from './email.mjs';

const DEFAULT_TIMEOUT_MS = 30000;

export const INTEGRATION_REGISTRY = {
  slack: {
    name: 'Slack',
    factory: (config) => new SlackClient(config),
    envVars: ['SLACK_WEBHOOK_URL', 'SLACK_BOT_TOKEN'],
    priority: 10,
    retries: 3,
    required: false,
    handler: async (client, result) => {
      const cr = result.compositeRisk;
      if (!cr) return { skipped: true, reason: 'no_composite' };
      if (cr.level !== 'high' && cr.level !== 'critical') {
        return { skipped: true, reason: 'low_priority' };
      }
      return await client.sendPredictionAlert(result);
    },
  },

  notion: {
    name: 'Notion',
    factory: (config) => new NotionClient(config),
    envVars: ['NOTION_API_TOKEN', 'NOTION_DATABASE_ID'],
    priority: 5,
    retries: 2,
    required: false,
    handler: async (client, result) => {
      if (!client.enabled) return { skipped: true, reason: 'not_configured' };
      return await client.savePrediction(result);
    },
  },

  obsidian: {
    name: 'Obsidian',
    factory: (config) => new ObsidianVault(config),
    envVars: ['OBSIDIAN_VAULT_PATH'],
    priority: 3,
    retries: 1,
    required: false,
    handler: async (client, result) => {
      if (!client.enabled) return { skipped: true, reason: 'not_configured' };
      const r1 = client.savePrediction(result);
      const r2 = client.saveDailyNote();
      return { ok: r1.ok && r2.ok, results: [r1, r2] };
    },
  },

  email: {
    name: 'Email',
    factory: (config) => new SMTPClient(config),
    envVars: ['SMTP_HOST', 'SMTP_USER'],
    priority: 8,
    retries: 2,
    required: false,
    handler: async (client, result) => {
      if (!client.enabled) return { skipped: true, reason: 'not_configured' };
      const cr = result.compositeRisk;
      if (!cr || cr.level !== 'critical') {
        return { skipped: true, reason: 'not_critical' };
      }
      return await client.send({
        to: process.env.SMTP_TO,
        subject: 'Crucix CRITICAL: ' + Number(cr.composite || 0).toFixed(3),
        text: 'Composite Risk: ' + Number(cr.composite || 0).toFixed(3),
      });
    },
  },

  webhook: {
    name: 'Generic Webhook',
    factory: (config) => ({
      enabled: !!config.url,
      url: config.url,
      secret: config.secret,
      async send(result) {
        if (!this.enabled) return { ok: false, error: 'no_url' };
        const res = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Crucix-Secret': this.secret || '',
          },
          body: JSON.stringify(result),
        });
        return { ok: res.ok, status: res.status };
      },
    }),
    envVars: ['CRUCIX_WEBHOOK_URL'],
    priority: 7,
    retries: 3,
    required: false,
    handler: async (client, result) => await client.send(result),
  },
};

function _withTimeout(promise, ms, label) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: 'timeout_after_' + ms + 'ms', step: label });
    }, ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); resolve({ ok: false, error: e && e.message ? e.message : String(e), step: label }); }
    );
  });
}

class IntegrationManager {
  constructor(config = {}) {
    this.integrations = new Map();
    this.config = config;
    this.timeoutMs = Number.isFinite(config.timeoutMs) ? config.timeoutMs : DEFAULT_TIMEOUT_MS;
    this.startedAt = Date.now();
    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      totalSkipped: 0,
      byIntegration: {},
    };
    this._initialize();
  }

  _initialize() {
    for (const [key, def] of Object.entries(INTEGRATION_REGISTRY)) {
      const config = this.config[key] || {};
      try {
        const client = def.factory(config);
        this.integrations.set(key, {
          key,
          name: def.name,
          priority: def.priority,
          retries: def.retries,
          client,
          handler: def.handler,
          enabled: client.enabled !== false,
        });
      } catch (e) {
        console.error('[webhook_manager] init failed for ' + key + ': ' + e.message);
      }
    }
  }

  register(key, def) {
    if (!def || typeof def.factory !== 'function' || typeof def.handler !== 'function') {
      return { ok: false, error: 'invalid_definition' };
    }
    try {
      const config = this.config[key] || {};
      const client = def.factory(config);
      this.integrations.set(key, {
        key,
        name: def.name || key,
        priority: def.priority || 0,
        retries: def.retries || 0,
        client,
        handler: def.handler,
        enabled: client.enabled !== false,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  unregister(key) {
    return this.integrations.delete(key);
  }

  reload(newConfig = null) {
    if (newConfig) {
      this.config = newConfig;
      this.timeoutMs = Number.isFinite(newConfig.timeoutMs) ? newConfig.timeoutMs : this.timeoutMs;
    }
    this.integrations.clear();
    this._initialize();
    return { ok: true, integrations: this.integrations.size };
  }

  resetStats() {
    this.stats = { totalSent: 0, totalFailed: 0, totalSkipped: 0, byIntegration: {} };
    return { ok: true };
  }

  async dispatch(result) {
    if (!result || typeof result !== 'object') {
      return {
        dispatched: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        results: [],
        error: 'invalid_result',
      };
    }

    const enabled = Array.from(this.integrations.values())
      .filter(i => i.enabled)
      .sort((a, b) => b.priority - a.priority);

    const results = [];

    for (const integration of enabled) {
      const res = await this._dispatchWithRetry(integration, result);
      results.push({ integration: integration.name, key: integration.key, ...res });

      if (res.skipped) {
        this.stats.totalSkipped++;
      } else if (res.ok) {
        this.stats.totalSent++;
      } else {
        this.stats.totalFailed++;
      }

      this.stats.byIntegration[integration.key] =
        this.stats.byIntegration[integration.key] || { sent: 0, failed: 0, skipped: 0 };
      if (res.skipped) this.stats.byIntegration[integration.key].skipped++;
      else if (res.ok) this.stats.byIntegration[integration.key].sent++;
      else this.stats.byIntegration[integration.key].failed++;
    }

    return {
      dispatched: enabled.length,
      sent: results.filter(r => r.ok && !r.skipped).length,
      failed: results.filter(r => r.error).length,
      skipped: results.filter(r => r.skipped).length,
      results,
    };
  }

  async _dispatchWithRetry(integration, result) {
    const maxAttempts = integration.retries + 1;
    let lastRes = { ok: false, error: 'no_attempt' };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await _withTimeout(
          integration.handler(integration.client, result),
          this.timeoutMs,
          integration.key
        );

        if (res && res.skipped) {
          return { ...res, attempts: attempt + 1 };
        }

        if (res && res.ok) {
          return { ...res, attempts: attempt + 1 };
        }

        lastRes = res || { ok: false, error: 'empty_response' };

        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      } catch (e) {
        lastRes = { ok: false, error: e && e.message ? e.message : String(e) };
        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    return { ...lastRes, attempts: maxAttempts };
  }

  status() {
    const all = Array.from(this.integrations.values());
    return {
      enabled: all.filter(i => i.enabled).map(i => i.key),
      disabled: all.filter(i => !i.enabled).map(i => i.key),
      byPriority: all
        .filter(i => i.enabled)
        .sort((a, b) => b.priority - a.priority)
        .map(i => ({ key: i.key, priority: i.priority, retries: i.retries })),
      uptimeMs: Date.now() - this.startedAt,
      timeoutMs: this.timeoutMs,
      stats: this.stats,
    };
  }
}

let _manager = null;

export function getIntegrationManager(config) {
  if (!_manager) {
    _manager = new IntegrationManager(config || {});
  } else if (config && typeof config === 'object') {
    _manager.reload(config);
  }
  return _manager;
}

export async function dispatchToIntegrations(result, config = {}) {
  const manager = getIntegrationManager(config);
  return await manager.dispatch(result);
}

export const INTEGRATION_INFO = {
  name: 'Integration Manager',
  description: 'Unified manager for Slack, Notion, Obsidian, Email, Webhooks',
  supported: Object.keys(INTEGRATION_REGISTRY),
};

export { IntegrationManager };
