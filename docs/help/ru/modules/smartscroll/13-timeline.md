# 13. Построитель таймлайна

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/timeline.mjs

## Назначение

Построение хронологии событий сюжета.

## Класс

TimelineBuilder

## Методы

- build(events) — сортировка по времени, удаление дубликатов
- groupByDay(events) — группировка по дням

## Формат выхода

- time, title, body (до 500 символов), source

## Связи

- Используется: 05-local-engine.md
- Вызывается через API: 16-event-ingestion.md
