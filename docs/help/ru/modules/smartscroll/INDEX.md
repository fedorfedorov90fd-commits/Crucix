# SmartScroll — комплект интеграции в Crucix

Версия комплекта: 1.0.0

## Назначение комплекта

SmartScroll — модуль сбора, дедупликации, кластеризации и суммаризации новостных потоков из RSS и Telegram. Результат работы — сюжеты, таймлайны и сводки, интегрированные в граф знаний Crucix.

Комплект работает в трёх режимах:

- **external** — подключение к внешнему API SmartScroll.
- **local** — автономный локальный движок без внешних зависимостей.
- **auto** — авто-переключение: пробует внешний, при сбое переходит на локальный.

## Карта связей файлов

config/smartscroll.json
↓
apis/sources/smartscroll-interface.mjs
↓
├── apis/sources/smartscroll.mjs (внешний адаптер)
└── apis/sources/smartscroll-local/index.mjs (фабрика)
↓
└── apis/sources/smartscroll-local/engine.mjs (ядро)
↓
├── scripts/collectors/lib/rss-collector.mjs
├── scripts/collectors/lib/telegram-collector.mjs
├── apis/sources/smartscroll-local/processing/normalizer.mjs
├── apis/sources/smartscroll-local/processing/dedup.mjs
├── apis/sources/smartscroll-local/processing/story-builder.mjs
├── apis/sources/smartscroll-local/processing/summarizer.mjs
├── apis/sources/smartscroll-local/processing/timeline.mjs
└── apis/sources/smartscroll-local/storage/story-store.mjs
↓
apis/ingest/event-ingestion-api.mjs
↓
apis/entity-model/story-layer.mjs
↓
data/basket/smartscroll-stories.json

text

## Список справок по модулям

- [01. Конфигурация](./01-config.md)
- [02. Общий интерфейс](./02-interface.md)
- [03. Внешний адаптер](./03-external-adapter.md)
- [04. Фабрика источника](./04-local-index.md)
- [05. Ядро локального движка](./05-local-engine.md)
- [06. Базовый класс коллектора](./06-base-collector.md)
- [07. RSS-коллектор](./07-rss-collector.md)
- [08. Telegram-коллектор](./08-telegram-collector.md)
- [09. Нормализатор](./09-normalizer.md)
- [10. Дедупликатор](./10-dedup.md)
- [11. Построитель сюжетов](./11-story-builder.md)
- [12. Суммаризатор](./12-summarizer.md)
- [13. Построитель таймлайна](./13-timeline.md)
- [14. Хранилище сюжетов](./14-story-store.md)
- [15. Модель сущностей](./15-story-layer.md)
- [16. Интеграция в пайплайн](./16-event-ingestion.md)

## Расположение файлов в проекте Crucix
/home/ta8_/Рабочий стол/Crucix/
├── apis/
│ ├── sources/
│ │ ├── smartscroll-interface.mjs
│ │ ├── smartscroll.mjs
│ │ └── smartscroll-local/
│ │ ├── index.mjs
│ │ ├── engine.mjs
│ │ ├── processing/
│ │ │ ├── normalizer.mjs
│ │ │ ├── dedup.mjs
│ │ │ ├── story-builder.mjs
│ │ │ ├── summarizer.mjs
│ │ │ └── timeline.mjs
│ │ └── storage/
│ │ └── story-store.mjs
│ ├── entity-model/
│ │ └── story-layer.mjs
│ └── ingest/
│ └── event-ingestion-api.mjs
├── scripts/
│ └── collectors/
│ ├── lib/
│ │ ├── base-collector.mjs
│ │ ├── rss-collector.mjs
│ │ └── telegram-collector.mjs
│ └── collect-smartscroll.mjs
├── config/
│ └── smartscroll.json
└── data/
└── smartscroll/
├── stories/
└── events/

text

## Порядок развёртывания в проект

1. Скопировать все файлы из `/home/ta8_/Рабочий стол/Crucix_smartscroll_1.0.0/` в `/home/ta8_/Рабочий стол/Crucix/` с сохранением структуры.
2. Настроить `config/smartscroll.json`: указать источники RSS и Telegram.
3. Запустить сборщик: `node /home/ta8_/Рабочий стол/Crucix/scripts/collectors/collect-smartscroll.mjs`.
4. Подключить API-модуль к графу знаний Crucix через `setGraphAdapter`.

## Порядок запуска

```bash
# Ручной запуск сбора
cd "/home/ta8_/Рабочий стол/Crucix" && node scripts/collectors/collect-smartscroll.mjs

# Автономный цикл ингестии
cd "/home/ta8_/Рабочий стол/Crucix" && node apis/ingest/event-ingestion-api.mjs
Метрики комплекта
Режимы работы: 3 (external, local, auto).

Коллекторы: 2 (RSS, Telegram).

Уровни дедупликации: 3 (хеш, шинглы, заголовки).

Веса кластеризации: 3 (entities 0.5, title 0.3, body 0.2).

Методы суммаризации: 1 (extractive TF-IDF + MMR).

Типы узлов модели сущностей: 3 (Story, TimelineEvent, Entity).

Типы рёбер: 4 (contains, mentions, related_to, evolves_into).
