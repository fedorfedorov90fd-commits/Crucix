# Система оповещений: alert-dispatcher-api.mjs

## Простое объяснение (для новичков)

Это «тревожная кнопка» системы. Вы не можете смотреть в монитор 24 часа в сутки. Если система обнаружит, что «тема ЭНЕРГЕТИКА внезапно замолчала» или «5 источников одновременно вбросили одну новость» — вы должны узнать об этом мгновенно, даже если гуляете в парке.

**Что он делает:**

1. **Принимает** агрегированные данные от других модулей (аномалии, всплески, разрывы).
2. **Применяет правила-триггеры** — проверяет, выполнены ли условия для алерта.
3. **Формирует объекты алертов** — унифицированный формат с типом, серьёзностью, деталями.
4. **Сохраняет** в таблицу `alerts` (если БД подключена).
5. **Отправляет** в Telegram (если токен задан) или webhook.

**Аналогия:**

Это как вахтёр на проходной. Он не решает, кто прав, кто виноват. Он просто смотрит: «проходит ли этот человек по списку?» Если да — пропускает (создаёт алерт). Если нет — молчит.

**Почему это важно:**

Пассивный дашборд — это телевизор. Вы должны на него смотреть. Активная система алертов — это радио, которое само позовёт вас, когда случится что-то важное.

---

## Научная база (для специалистов)

Движок генерации и оценки алертов. Архитектура основана на паттерне **rule engine**: набор правил-предикатов, каждый из которых проверяет своё условие и, при выполнении, порождает объект-алерт.

**Ключевые функции:**

- **`createAlert()`** — фабричная функция. Создаёт объект алерта с полями `type`, `severity`, `details`, `status`. Унифицирует формат, чтобы алерты можно было хранить в БД и отображать в дашборде единообразно.

- **`evaluateAlerts(data)`** — основной движок правил. Проверяет пять условий:

  1. **Silence gap** — есть ли информационные разрывы (`data.gaps`). Если да — алерт `INFORMATION_GAP` уровня `CRITICAL`.
  2. **Topic gap** — есть ли темы с большим числом упоминаний у одной группы и нулём у другой. Алерт `TOPIC_GAP` уровня `HIGH` (если превышен порог).
  3. **Coordinated event** — есть ли координированные всплески (более `sync_threshold` источников одновременно). Алерт `COORDINATED_ACTION` уровня `HIGH`.
  4. **Framing gap** — есть ли сильная поляризация тональностей. Алерт `FRAMING_GAP` уровня `HIGH` (если `polarity_delta > 0.95`) или `MEDIUM` (если `> 0.7`).
  5. **Feed failure** — есть ли фиды с ошибками за последние 24 часа. Алерт `FEED_FAILURE` уровня `MEDIUM`.

- **`sendAlerts(alerts)`** — отправка. Может работать в двух режимах:
  - **Dry-run** (по умолчанию): логирует алерты в консоль, не отправляет. Безопасен для отладки.
  - **Реальный режим**: отправляет в Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) или на webhook (`WEBHOOK_URL`).

**Дедупликация:** перед отправкой проверяется, не отправляли ли уже такой же алерт за последние N минут (по комбинации `type + region + severity`). Это защита от спама.

---

## Как работает (пошагово)

1. `evaluateAlerts(data)` принимает объект с полями `gaps`, `topicGaps`, `coordinatedBursts`, `framingGaps`, `feedFailures`.
2. Проверяет каждое условие с порогом из `config/alert.json`.
3. Формирует массив объектов алертов. Каждый объект содержит: `alert_type`, `severity`, `title`, `message`, `topic`, `source_table`, `source_id`.
4. Сохраняет алерты в таблицу `alerts` через `INSERT ... ON CONFLICT DO NOTHING` (если БД подключена).
5. Если задан `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` — отправляет через Telegram Bot API.
6. Если задан `WEBHOOK_URL` — отправляет POST-запрос на этот URL.
7. Логирует: сколько алертов создано, сколько сохранено, сколько отправлено.

---

## Пример использования

```javascript
import { evaluateAlerts, sendAlerts } from './apis/sources/alert-dispatcher-api.mjs';

const alerts = evaluateAlerts({
  gaps: [{ topic: 'energy', severity: 'HIGH' }],
  topicGaps: [{ topic: 'cyber', russian_count: 40, western_count: 0 }],
  coordinatedBursts: [{ topic: 'military', sources_count: 7 }],
  framingGaps: [{ topic: 'economy', polarity_delta: 0.92 }],
  feedFailures: [{ feed_id: 'aljazeera-all', last_error: 'HTTP 403' }]
});

console.log(`Создано алертов: ${alerts.length}`);

await sendAlerts(alerts); // Отправка в Telegram / webhook

Формат одного алерта:
json

{
  "alert_type": "topic_gap",
  "severity": "high",
  "title": "Topic gap: cyber",
  "message": "Тема 'cyber' — western_silence. russian=40, western=0.",
  "topic": "cyber",
  "source_table": "topic_gaps",
  "source_id": 12
}

Практические рекомендации

    TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID — вставьте свои значения в .env или config/alert.json. Без них система работает в dry-run.

    Dry-run по умолчанию — безопасен для отладки. Алерты логируются, но не отправляются. Это правильно: лучше сначала проверить, что триггеры срабатывают корректно.

    Пороги — topic_gap_threshold: 20, sync_threshold: 5, framing_threshold: 0.7. Калибруйте под свой поток (см. справку alert.md).

    Дедупликация — UNIQUE (alert_type, source_table, source_id) в таблице alerts защищает от повторной записи. Перед отправкой можно дополнительно проверять «не отправляли ли за последние N минут».

    ALERT_LEVELS — словарь уровней серьёзности: CRITICAL, HIGH, MEDIUM, LOW. Удобно для сортировки и цветовой маркировки в дашборде.

    Формат алерта — жёстко зафиксирован, чтобы его можно было сохранять в БД и отображать в UI. Не меняйте без необходимости.

    Последовательные запросы, не Promise.all — pg.Client не поддерживает параллельные запросы на одном соединении. Это вызывает DeprecationWarning. Делайте последовательно (for...of).

    framing_gap уровня HIGH — при polarity_delta >= 0.95 (максимальная поляризация). Раньше было threshold * 1.5, но это давало ложные «medium» при Δ=1.0.

Что было объединено

Эта справка покрывает функционал двух файлов из песочницы:
Файл из песочницы	Куда влился	Что добавлено
scripts/alerting/alert-engine.mjs	apis/sources/alert-dispatcher-api.mjs	Триггеры silence_gap, topic_gap, coordinated_event, framing_gap, feed_failure; dry-run режим; сохранение в alerts; отправка в Telegram
services/agentic_engine.py (частично)	—	Идея «бриф по алерту» — вынесена в agentic_engine.py (см. справку agentic_engine.md)

Связанные модули:

    config/alert.json — конфиг с порогами.

    db/migrations/012_alerts.sql — таблица alerts.

    alert-dispatcher-api.mjs — этот файл.

    agentic_engine.py — вызывает алерты для формирования брифа.
