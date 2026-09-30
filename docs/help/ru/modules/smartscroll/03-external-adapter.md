# 03. Внешний адаптер

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll.mjs

## Назначение

Подключение к внешнему API SmartScroll.
Реализует контракт SmartScrollInterface.

## Класс

SmartScrollAdapter extends SmartScrollInterface

## Методы

- fetchStories(opts) — GET /api/v1/stories
- fetchStoryDetail(storyId) — GET /api/v1/stories/:id
- fetchTimeline(storyId) — GET /api/v1/stories/:id/timeline
- healthCheck() — GET /api/v1/health

## Механизмы устойчивости

- Тайм-аут через AbortController
- Повторы с экспоненциальной задержкой
- Обработка 429 и 5xx с повторной попыткой
- Авторизация через заголовок Authorization: Bearer

## Связи

- Читает конфигурацию: 01-config.md
- Реализует интерфейс: 02-interface.md
- Используется фабрикой: 04-local-index.md
