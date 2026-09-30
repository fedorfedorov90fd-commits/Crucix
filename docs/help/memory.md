# Память Crucix

## Описание
Файл памяти для хранения ключевых данных о состоянии проекта Crucix.
Обновляется при каждом значимом изменении архитектуры, состава модулей,
хода миграции на единый контракт и создания документации.

## Структура
- Версия: 2.0
- Формат: Markdown
- Назначение: хранение актуального снимка состояния системы
- Язык: русский (официальный язык проекта)

## Содержимое

### Проект
- Название: Crucix
- Тип: OSINT-платформа геополитического / экономического / кибер-мониторинга
- Стек: Node.js v22 ESM, чистый HTTP без фреймворков, Leaflet для карты, JSON-файлы как БД
- Порт: 3117
- Корень проекта: /home/ta8_/Рабочий стол/Crucix
- Точка входа: server.mjs
- Git-репозиторий (подготовка к публикации): /home/ta8_/Рабочий стол/Crucix_GIT
- Конкуренты: Palantir Foundry, Recorded Future, Dataminr, Maltego, Esri ArcGIS
- Дата последнего обновления памяти: 2026-09-14
- Статус: активен, идёт крупная архитектурная миграция

### Архитектурная парадигма
- Greenfield — разработка «с нуля на зелёном поле» рядом со старым кодом
- Clean Architecture — разделение слоёв, зависимости направлены внутрь
- Modular Architecture — модульный монолит с чётким контрактом
- Design by Contract — сначала контракт (route + method(s) + meta + handler), потом реализация
- SSOT (Single Source of Truth) — единый источник правды; для нас это server/registry.generated.json (генерируется, не пишется руками)
- Strangler Fig Pattern — новая система растёт рядом, старая отключается по частям
- Anti-Corruption Layer — роутер как прослойка-переводчик между старыми и новыми формами
- Ports & Adapters — ядро общается с внешним миром через порты
- DDD (Domain-Driven Design) — организация кода вокруг домена (категории слоёв: market, cyber, military, ecological и т.д.)
- Layer / Service — два типа модулей (см. раздел «Контракт v2»)
- Ratchet-режим — режим миграции (LINT_STRICT=0 warn-only, LINT_STRICT=1 строгий)
- Fail-Fast — валидация на старте сервера до listen()

### Контракт v2 — два типа модулей

LAYER — модуль слоя карты:
- route = '/api/layers/<id>'
- method = 'GET'
- meta: { category, icon, color, vizType, source, collector, cache, description, unit }
- Обязательные meta: category + icon + color + vizType + source + description
- handler: export async function handler(req, res)

SERVICE — модуль инфраструктуры:
- route = '/api/services/<id>'
- method = 'GET' ИЛИ methods = ['GET', 'POST', 'DELETE'] (мультиметодные)
- meta: { service: true, description, cache, version }
- Обязательные meta: service: true + description
- handler: export async function handler(req, res)

ЗАПРЕЩЕНО: export default, export const handle = handler, export { X as handler }.
Разрешено ЛИБО method (строка), ЛИБО methods (массив), НЕ оба одновременно.

### Инфраструктура (готово)
- server/router.mjs v2.3.0 — HTTP-роутер с поддержкой мультиметодности, wildcard, circuit breaker, rate limit, CORS, gzip, кэш, метрики, graceful shutdown
- server/build-registry.mjs v3.2.0 — генератор реестра. Wildcard для всех маршрутов: точный + /*
- scripts/lint-contract.mjs v3.1.0 — двухветочный валидатор Layer/Service
- server/registry.generated.json — сгенерированный артефакт реестра (SSOT)

### Текущее состояние (на 2026-09-14)
- Всего модулей *-api.mjs: ~203
- Layer: 187 (слои карты)
- Service: 15 (инфраструктура)
- Unknown: 1 (мусорный =collector-logs-api.mjs)
- Нарушителей контракта v2: см. актуальный lint --stats
- Дубликатов маршрутов: 0

### Задачи (план A → B → C)
- A — интеграция слоёв в UI: ЗАКРЫТО. Создан dashboard/public/geo-map/js/layers-dynamic.js, 368 слоёв в UI
- B — фикс битых модулей + перепись smoke: В РАБОТЕ. Переписано с нуля 6 модулей из 17 битых
- C — справки ru/en: НЕ НАЧАТО. Планируется scripts/generate-help.mjs

### Переписанные битые модули (задача B)
1. ai-chat-api.mjs → 616 строк, OK [service], /api/services/ai-chat, methods ['GET','POST']
2. correlation-api.mjs → 777 строк, OK [service], /api/services/correlation
3. diagnostics-api.mjs → 865 строк, OK [service], /api/services/diagnostics, устранён 504
4. export-api.mjs → 889 строк, OK [service], /api/services/export, 7 форматов, история, cleanup
5. global-index-api.mjs → 626 строк, OK [layer], /api/layers/global-index, 14 эндпоинтов
6. geo-markers-api.mjs → 568 строк, OK [layer], /api/layers/geo-markers, агрегатор 4 источников

### Осталось переписать (11 битых, задача B)
7. help-api.mjs — следующий
8. live-api.mjs
9. news-api.mjs
10. rag-api.mjs
11. rss-manager-api.mjs
12. scheduler-api.mjs
13. storage-api.mjs
14. submarine-cable-api.mjs (особый: строка 148 обрезана)
15. trust-api.mjs
16. user-api.mjs
17. usgs-api.mjs

### Документация
- docs/ARCHITECTURE.md — архитектурный манифест проекта
- docs/MIGRATION_LOG.md — журнал миграции (планируется)
- docs/HANDOVER.md — передача новому разработчику (планируется)
- data/help/ru/*.txt — 118 файлов справок (русский)
- data/help/en/*.txt — 102 файла справок (английский)
- data/help/pages.json — реестр страниц проекта
- data/help/memory.md — этот файл

### Ключевые директории
- apis/sources/ — API-модули (*-api.mjs)
- scripts/collectors/ — сборщики данных (collect-*.mjs)
- scripts/analyzers/ — анализаторы
- data/basket/ — корзина, единственный источник данных для API
- data/analytics/ — выход анализаторов (flow, specialist, market, index, detector, forecast, semantic, economics)
- data/geo/ — геоданные (country-status.json, index-history.json, world.geojson)
- data/help/ — справки (ru, en)
- data/exports/ — экспорт данных (создаётся export-api)
- data/persist/ — персистентные данные (история сценариев и т.д.)
- dashboard/public/ — интерфейс (HTML-страницы, JS, CSS)
- server/ — серверные компоненты (router, build-registry, registry.generated)
- scripts/ — служебные скрипты (lint-contract, build-registry и т.д.)
- logs/collectors/ — логи сборщиков (единая директория)
- backups/ — бэкапы файлов перед изменениями

### Правила проекта (ключевые)
1. Никогда не удалять файлы/пакеты/кэш без явной команды хозяина
2. Перед правкой — читать прототип ЦЕЛИКОМ (cat)
3. Только полная перезапись файла, не фрагменты, не sed
4. Один блок = один модуль (750+ строк)
5. Handler — только export async function handler(req, res)
6. Service отделён от Layer (в реестре, в API, в UI)
7. Никаких алиасов для обратной совместимости
8. Все модули читают данные только из data/basket/
9. Сборщики — только в scripts/collectors/collect-*.mjs
10. Логи сборщиков — только в logs/collectors/

## Примечания
- Файл обновлён 2026-09-14 (версия 2.0). Предыдущая версия 1.0 от 2026-09-08 содержала только заглушку.
- При каждом значимом изменении архитектуры или состава модулей — обновлять этот файл.
- Не удалять старые разделы при обновлении — расширять и уточнять.
- Официальный язык документации — русский (RULES.txt правило №1).

## Журнал изменений
- 2026-09-08 (v1.0): создание заглушки (автоматически)
- 2026-09-14 (v2.0): полное обновление — архитектурная парадигма, контракт v2, состояние миграции, задачи A/B/C, переписанные модули, документация, ключевые директории, правила проекта

























