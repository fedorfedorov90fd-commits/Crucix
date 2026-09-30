# Crucix Integrations

Единая система интеграций с внешними сервисами. Всё — без внешних зависимостей, только fetch и node:net.

## Поддерживаемые сервисы

| Сервис | Назначение | Env vars | Приоритет |
|--------|-----------|----------|-----------|
| Slack | Алерты в канал | SLACK_WEBHOOK_URL, SLACK_BOT_TOKEN | 10 |
| Email | Критические алерты | SMTP_HOST, SMTP_USER | 8 |
| Webhook | Универсальный | CRUCIX_WEBHOOK_URL | 7 |
| Notion | Сохранение прогнозов | NOTION_API_TOKEN, NOTION_DATABASE_ID | 5 |
| Obsidian | Markdown vault | OBSIDIAN_VAULT_PATH | 3 |

## Быстрый старт

export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your@email.com
export SMTP_PASSWORD=app-password
export SMTP_TO=alerts@company.com
export NOTION_API_TOKEN=secret_xxx
export NOTION_DATABASE_ID=abc123
export OBSIDIAN_VAULT_PATH=/Users/you/ObsidianVault
export CRUCIX_WEBHOOK_URL=https://your-server.com/crucix

## Использование

import { dispatchToIntegrations } from './integrations/webhook_manager.mjs';

const prediction = await runCrucixCycle();
const result = await dispatchToIntegrations(prediction);
console.log(result);

Результат:
{
  dispatched: 3,
  sent: 2,
  failed: 0,
  skipped: 1,
  results: [
    { integration: 'Slack', ok: true },
    { integration: 'Email', skipped: true, reason: 'not_critical' },
    { integration: 'Obsidian', ok: true }
  ]
}

## Отдельные интеграции

### Slack

import { SlackClient } from './integrations/slack.mjs';
const slack = new SlackClient({ webhookUrl: process.env.SLACK_WEBHOOK_URL });
await slack.sendPredictionAlert(prediction);
await slack.sendSignalAlert({ name: 'Ising', value: 0.85, weight: 1.5, rationale: 'Фазовый переход' });
await slack.sendRegimeChange({ changeProbability: 0.72, regimeAge: 5 });

### Email (SMTP, без nodemailer)

import { SMTPClient } from './integrations/email.mjs';
const smtp = new SMTPClient({ host: 'smtp.gmail.com', port: 587, user: 'your@email.com', password: 'app-password' });
await smtp.send({ to: 'alerts@company.com', subject: 'Crucix Alert', text: 'Plain text', html: '<h1>HTML</h1>' });

### Notion

import { NotionClient } from './integrations/notion.mjs';
const notion = new NotionClient({ apiToken: process.env.NOTION_API_TOKEN, databaseId: process.env.NOTION_DATABASE_ID });
await notion.savePrediction(prediction);

### Obsidian

import { ObsidianVault } from './integrations/obsidian.mjs';
const vault = new ObsidianVault({ vaultPath: '/Users/you/ObsidianVault', folder: 'Crucix' });
vault.savePrediction(prediction);
vault.saveDailyNote();
vault.updateIndex();

### RSS/Atom Feed

import { FeedGenerator, feedHandler } from './integrations/rss.mjs';
const gen = new FeedGenerator({ baseUrl: 'https://crucix.example.com' });
app.get('/feed.xml', feedHandler(gen, './runs/predictions', 'atom'));
app.get('/feed.rss', feedHandler(gen, './runs/predictions', 'rss'));
app.get('/feed.json', feedHandler(gen, './runs/predictions', 'json'));

## Retry logic

Каждая интеграция имеет настраиваемое число retry:

- Slack: 3 retry с экспоненциальной задержкой
- Email: 2 retry
- Webhook: 3 retry
- Notion: 2 retry
- Obsidian: 1 retry (локально — быстро)

Задержка: 1s × 2^attempt (1s, 2s, 4s, ...).

## Статистика

const manager = getIntegrationManager();
console.log(manager.status());
// {
//   enabled: ['slack', 'obsidian'],
//   disabled: ['notion', 'email', 'webhook'],
//   stats: {
//     totalSent: 42,
//     totalFailed: 1,
//     totalSkipped: 18,
//     byIntegration: {
//       slack: { sent: 25, failed: 0, skipped: 17 },
//       obsidian: { sent: 17, failed: 1, skipped: 0 }
//     }
//   }
// }

## Приоритеты

Интеграции выполняются в порядке приоритета (высокий первым):

1. Slack (10) — быстрые алерты в команду
2. Email (8) — критические события
3. Webhook (7) — интеграция с внешними системами
4. Notion (5) — долгосрочное хранение
5. Obsidian (3) — персональные заметки

Если одна интеграция падает — остальные продолжают работу.

## Zero-dependency

Все интеграции реализованы без внешних пакетов:

- Slack — через fetch (webhook) или HTTP (bot API)
- Email — через node:net и node:tls (собственный SMTP клиент)
- Notion — через fetch (REST API)
- Obsidian — через node:fs (markdown)
- RSS — генерация XML вручную

Единственные зависимости — стандартная библиотека Node.js.
