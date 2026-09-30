# 02. Общий интерфейс

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-interface.mjs

## Назначение

Определяет контракт v3 для всех источников SmartScroll.
Внешний адаптер и локальный движок реализуют один и тот же интерфейс.

## Методы

- fetchStories(opts) — получить список сюжетов
  - Параметры: since, limit, topics
  - Возвращает: массив Story
- fetchStoryDetail(storyId) — получить детали сюжета
  - Параметры: storyId
  - Возвращает: Story
- fetchTimeline(storyId) — получить хронологию сюжета
  - Параметры: storyId
  - Возвращает: массив TimelineEntry
- healthCheck() — проверить состояние источника
  - Возвращает: ok, mode, details

## Типы данных

Story:
- id, title, summary, status
- start_time, end_time
- entities, events, related_stories

StoryEvent:
- id, source, published_at, title, body
- entities, story_id, related_stories

TimelineEntry:
- time, title, body, source

## Связи

- Реализуется: 03-external-adapter.md, 05-local-engine.md
- Используется: 04-local-index.md, 16-event-ingestion.md
