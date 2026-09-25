# 05. Ядро локального движка

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/engine.mjs

## Назначение

Управляет полным циклом обработки:
сбор, нормализация, дедупликация, кластеризация, суммаризация, хранение.
Собирает метрики времени по каждой стадии для диагностики.

## Класс

SmartScrollLocalEngine extends SmartScrollInterface

## Полный цикл

1. _initCollectors() — инициализация коллекторов из конфигурации
2. _collectCycle() — цикл обработки (внутренний)
3. runCycle() — публичная точка входа для полного цикла
4. _cleanup() — удаление устаревших сюжетов

## Метрики по стадиям

Каждая стадия цикла замеряется отдельно:
- collect — сбор из всех коллекторов
- normalize — нормализация событий
- dedup — дедупликация
- cluster — кластеризация в сюжеты
- summarize — генерация сводок
- store — сохранение в хранилище

Хранятся последние 100 замеров на стадию.
Метод getMetrics() возвращает:
- cycles_total — общее число циклов
- cycles_failed — число проваленных
- totals — накопленные счётчики событий и сюжетов
- stages — статистика по каждой стадии (count, avg_ms, min_ms, max_ms, last_ms)
- last_cycle — метрики последнего цикла

## Методы интерфейса

- fetchStories(opts) — чтение из хранилища
- fetchStoryDetail(id) — чтение конкретного сюжета
- fetchTimeline(id) — построение таймлайна
- healthCheck() — состояние движка
- getMetrics() — метрики производительности

## Управление

- start() — запуск автономного цикла
- stop() — остановка
- runCycle() — однократный запуск полного цикла

## Зависимости

- Коллекторы: 06-base-collector.md, 07-rss-collector.md, 08-telegram-collector.md
- Обработка: 09-normalizer.md, 10-dedup.md, 11-story-builder.md, 12-summarizer.md, 13-timeline.md
- Хранилище: 14-story-store.md
