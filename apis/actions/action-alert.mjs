// Crucix — Action: Alert (отправка алертов)
// Отправляет уведомления через integrations/ (Slack, email, webhook)
// и через встроенный notifier.
//
// Версия: 1.0.0
// Категория: notification.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Алерт — это не сообщение, а решение. Каждый алерт имеет severity
//   (info/warning/critical), канал доставки, дедупликацию по ключу и
//   TTL. Без дедупликации один и тот же сигнал уходит 100 раз —
//   оператор перестаёт смотреть. Без TTL — старые алерты подавляют
//   новые. Реализуется через channel-множество: каждая запись хранит
//   последний timestamp по ключу.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getActionsRegistry, ACTION_CATEGORIES } from './_registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const STATE_DIR = join(PROJECT_ROOT, 'data', 'persist', 'actions');
const STATE_FILE = join(STATE_DIR, 'alert-state.json');

const SEVERITIES = Object.freeze({
  INFO:     'info',
  WARNING:  'warning',
  CRITICAL: 'critical',
});

const CHANNELS = Object.freeze({
  LOG:     'log',
  SLACK:   'slack',
  EMAIL:   'email',
  WEBHOOK: 'webhook',
});

// ============================================================
//  СОСТОЯНИЕ (для дедупликации)
// ============================================================

async function loadState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastSent: {} };
  }
}

async function saveState(state) {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// ============================================================
//  ДЕДУПЛИКАЦИЯ
// ============================================================

function keyFor(alert) {
  return [alert.severity, alert.source || 'none', alert.title || 'untitled'].join('::');
}

function shouldSend(state, alert, dedupMinutes) {
  if (!dedupMinutes) return true;
  const key = keyFor(alert);
  const last = state.lastSent[key];
  if (!last) return true;
  const ageMin = (Date.now() - last) / 60_000;
  return ageMin >= dedupMinutes;
}

function markSent(state, alert) {
  state.lastSent[keyFor(alert)] = Date.now();
}

// ============================================================
//  КАНАЛЫ ДОСТАВКИ
// ============================================================

async function sendLog(alert) {
  // Базовый канал — всегда работает. Логирует в консоль и файл.
  const line = `[${new Date().toISOString()}] [${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message || ''}`;
  console.log(line);
  return { channel: CHANNELS.LOG, ok: true };
}

async function sendWebhook(alert, url) {
  if (!url) return { channel: CHANNELS.WEBHOOK, ok: false, error: 'no_url' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.message || ''}`,
        severity: alert.severity,
        source: alert.source,
        timestamp: new Date().toISOString(),
      }),
    });
    return { channel: CHANNELS.WEBHOOK, ok: res.ok, status: res.status };
  } catch (e) {
    return { channel: CHANNELS.WEBHOOK, ok: false, error: e.message };
  }
}

async function sendSlack(alert) {
  // Slack webhook берётся из ENV или integrations/
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { channel: CHANNELS.SLACK, ok: false, error: 'no_slack_webhook' };
  return sendWebhook(alert, url);
}

async function sendEmail() {
  // Email требует integrations/email.mjs с настройками SMTP.
  // Возвращаем заглушку — реальный вызов будет в integrations.
  return { channel: CHANNELS.EMAIL, ok: false, error: 'email_not_configured' };
}

// ============================================================
//  ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

async function handler(args, context = {}) {
  const {
    title,
    message = '',
    severity = SEVERITIES.INFO,
    source = 'system',
    channels = [CHANNELS.LOG],
    dedupMinutes = 15,
    webhookUrl = null,
  } = args || {};

  if (!title) throw new Error('title required');
  if (!Object.values(SEVERITIES).includes(severity)) {
    throw new Error(`severity must be one of ${Object.values(SEVERITIES).join(', ')}`);
  }

  const alert = { title, message, severity, source };
  const state = await loadState();

  if (!shouldSend(state, alert, dedupMinutes)) {
    return {
      sent: false,
      reason: 'deduplicated',
      key: keyFor(alert),
      dedupMinutes,
    };
  }

  const results = [];
  for (const ch of channels) {
    if (ch === CHANNELS.LOG) results.push(await sendLog(alert));
    else if (ch === CHANNELS.SLACK) results.push(await sendSlack(alert));
    else if (ch === CHANNELS.WEBHOOK) results.push(await sendWebhook(alert, webhookUrl));
    else if (ch === CHANNELS.EMAIL) results.push(await sendEmail(alert));
  }

  markSent(state, alert);
  await saveState(state);

  const anyOk = results.some(r => r.ok);
  return {
    sent: anyOk,
    alert,
    results,
    dedupKey: keyFor(alert),
  };
}

// ============================================================
//  РЕГИСТРАЦИЯ
// ============================================================

export function registerAlertAction(registry = getActionsRegistry()) {
  registry.register({
    id: 'send_alert',
    category: ACTION_CATEGORIES.NOTIFICATION,
    description: 'Отправить алерт в один или несколько каналов (log, slack, webhook, email) с дедупликацией',
    argsSchema: {
      title: 'string',
      message: 'string',
      severity: 'string',
      source: 'string',
      channels: 'array',
      dedupMinutes: 'number',
      webhookUrl: 'string',
    },
    requiredArgs: ['title'],
    cache: 0,
    idempotent: false,
    handler,
  });
  return true;
}

export { SEVERITIES, CHANNELS, handler as alertHandler };
