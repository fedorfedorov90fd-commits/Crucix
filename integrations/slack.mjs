// integrations/slack.mjs
// Slack интеграция: webhook + bot API + rich embeds
//
// Два режима:
//   1. Incoming Webhook — простая отправка сообщений в канал
//   2. Bot API — полные сообщения с buttons, threads, reactions

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || '';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || '#crucix-alerts';

export class SlackClient {
  constructor({ webhookUrl, botToken, channel } = {}) {
    this.webhookUrl = webhookUrl || SLACK_WEBHOOK;
    this.botToken = botToken || SLACK_BOT_TOKEN;
    this.channel = channel || SLACK_CHANNEL;
    this.enabled = !!(this.webhookUrl || this.botToken);
  }

  async sendWebhook(text, blocks = null) {
    if (!this.webhookUrl) {
      return { ok: false, error: 'webhook_url_missing' };
    }

    const payload = { text };
    if (blocks) payload.blocks = blocks;

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async sendMessage(text, { blocks, threadTs, channel, attachments } = {}) {
    if (!this.botToken) {
      return { ok: false, error: 'bot_token_missing' };
    }

    const payload = {
      channel: channel || this.channel,
      text,
    };
    if (blocks) payload.blocks = blocks;
    if (threadTs) payload.thread_ts = threadTs;
    if (attachments) payload.attachments = attachments;

    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Bearer ${this.botToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return { ok: data.ok, ts: data.ts, channel: data.channel, error: data.error };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async sendPredictionAlert(result) {
    const cr = result.compositeRisk;
    if (!cr) return { ok: false, error: 'no_composite' };

    const color = {
      low: '#06b6d4',
      moderate: '#22c55e',
      elevated: '#eab308',
      high: '#f97316',
      critical: '#ef4444',
    }[cr.level] || '#3b82f6';

    const emoji = {
      low: '🟢',
      moderate: '🟢',
      elevated: '🟡',
      high: '🟠',
      critical: '🔴',
    }[cr.level] || '⚪';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Crucix Alert: ${cr.level.toUpperCase()}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Composite Risk:*\n${cr.composite.toFixed(3)}` },
          { type: 'mrkdwn', text: `*Level:*\n${cr.level}` },
          { type: 'mrkdwn', text: `*Signals:*\n${cr.signals?.length || 0}` },
          { type: 'mrkdwn', text: `*Confidence:*\n${cr.confidence || 'n/a'}` },
        ],
      },
      { type: 'divider' },
    ];

    if (cr.topDrivers && cr.topDrivers.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Top Drivers:*\n' +
            cr.topDrivers.map((d, i) =>
              `${i + 1}. *${d.name}* — ${(d.value * 100).toFixed(1)}% (${d.rationale || ''})`
            ).join('\n'),
        },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📊 Full Report' },
          url: `${process.env.CRUCIX_BASE_URL || 'http://localhost:3118'}/report`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '📈 Dashboard' },
          url: `${process.env.CRUCIX_DASHBOARD_URL || 'http://localhost'}/crucix.html`,
        },
      ],
    });

    const attachments = [{
      color,
      blocks: [],
    }];

    const text = `Crucix ${cr.level.toUpperCase()}: ${cr.composite.toFixed(3)}`;

    if (this.botToken) {
      return await this.sendMessage(text, { blocks, attachments });
    }
    return await this.sendWebhook(text, blocks);
  }

  async sendSignalAlert(signal) {
    const color = signal.value > 0.7 ? '#ef4444'
      : signal.value > 0.5 ? '#f97316'
      : '#eab308';

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔺 Signal High: ${signal.name}*\n` +
                `Value: \`${(signal.value * 100).toFixed(1)}%\` · Weight: \`×${signal.weight.toFixed(2)}\`\n` +
                `${signal.rationale || ''}`,
        },
      },
    ];

    return await this.sendWebhook(`Signal ${signal.name}: ${signal.value}`, blocks);
  }

  async sendRegimeChange(data) {
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🔄 Regime Change Detected' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Probability:*\n${(data.changeProbability * 100).toFixed(1)}%` },
          { type: 'mrkdwn', text: `*Regime Age:*\n${data.regimeAge} steps` },
        ],
      },
    ];

    return await this.sendWebhook('Regime change', blocks);
  }

  async addToThread(threadTs, text) {
    return await this.sendMessage(text, { threadTs });
  }
}

export async function notifySlack(result, config) {
  const client = new SlackClient(config);

  if (!client.enabled) {
    return { skipped: true, reason: 'not_configured' };
  }

  const cr = result.compositeRisk;
  const notifications = [];

  if (cr && (cr.level === 'high' || cr.level === 'critical')) {
    notifications.push(await client.sendPredictionAlert(result));
  }

  if (cr?.topDrivers?.[0]?.value > 0.7) {
    notifications.push(await client.sendSignalAlert(cr.topDrivers[0]));
  }

  if (result.extended?.changePointVix?.changeProbability > 0.6) {
    notifications.push(await client.sendRegimeChange(result.extended.changePointVix));
  }

  return { sent: notifications.length, results: notifications };
}

export const SLACK_INFO = {
  name: 'Slack',
  description: 'Alerts via Slack webhook or Bot API',
  envVars: ['SLACK_WEBHOOK_URL', 'SLACK_BOT_TOKEN', 'SLACK_CHANNEL'],
  optional: true,
};
