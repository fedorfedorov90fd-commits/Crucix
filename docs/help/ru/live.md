# live — Лента живых новостных потоков

## 📋 Описание
**Русский:**
Модуль **live-api** отдаёт ленту живых новостных потоков в реальном времени. Отображает события по 7 категориям (геополитика, экономика, военные, технологии, экология, здоровье, кибер), с важностью (critical/high/medium/low), тональностью и источником.

**English:**
The **live-api** module provides a real-time live event feed. Displays events across 7 categories (geopolitics, economy, military, technology, ecology, health, cyber), with importance level (critical/high/medium/low), sentiment and source.

## 🎯 Назначение
- Живая лента событий в реальном времени.
- Классификация по 7 категориям.
- Оценка важности события (critical, high, medium, low).
- Анализ тональности.

## 🚀 Использование
- Страница: `/live` (или через панель слоёв на `/geo-map`)
- API-эндпоинт: `GET /api/layers/live`
- Подпути: `?format=json|csv|series|stats|raw`
- Фильтры: `?category=`, `?importance=`, `?region=`, `?sentiment=`, `?limit=`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| API-модуль | `apis/sources/live-api.mjs` |
| Корзина | `data/basket/live.json` |
| Сборщик | `scripts/collectors/collect-live.mjs` |
| Help | `docs/help/ru/live.md` |

## 📊 Параметры слоя
| Параметр | Значение |
|----------|----------|
| Route | `/api/layers/live` |
| Method | `GET` |
| Category | `news` |
| Icon | 📡 |
| Color | `#5bc0f8` |
| VizType | `marker` |
| Cache | 30 сек |
| Unit | `news` |

## ⚠️ Статус
**Ожидает источник данных.** Basket-файл `data/basket/live.json` отсутствует — модуль зарегистрирован в реестре, синтаксически корректен, но не имеет данных. Связано с задачей `sources-001`. Встроенный fallback в модуле: демо-новости.

---

**Статус:** 🟡 Ожидает источник данных
**Версия:** 2.0
**Обновлено:** 2026-09-23
