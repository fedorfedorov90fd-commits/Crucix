# satellite — Реестр спутников

## 📋 Описание
**Русский:**
Модуль **satellite-api** отдаёт реестр спутников Земли: орбита (LEO/MEO/GEO/HEO), оператор, назначение, страна, статус. Источник — каталоги NORAD / CelesTrak.

**English:**
The **satellite-api** module returns the Earth satellite registry: orbit (LEO/MEO/GEO/HEO), operator, purpose, country, status. Source — NORAD / CelesTrak catalogs.

## 🎯 Назначение
- Отображение спутников на карте мира.
- Классификация по орбите (LEO/MEO/GEO/HEO).
- Информация об операторах и назначении.
- Мониторинг космической активности.

## 🚀 Использование
- Страница: `/satellite` (или через панель слоёв на `/geo-map`)
- API-эндпоинт: `GET /api/layers/satellite`
- Подпути: `?format=json|csv|series|stats|raw`
- Фильтры: `?orbit=`, `?operator=`, `?country=`, `?limit=`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| API-модуль | `apis/sources/satellite-api.mjs` |
| Корзина | `data/basket/satellite.json` |
| Сборщик | `scripts/collectors/collect-satellite.mjs` |
| Help | `docs/help/ru/satellite.md` |

## 📊 Параметры слоя
| Параметр | Значение |
|----------|----------|
| Route | `/api/layers/satellite` |
| Method | `GET` |
| Category | `space` |
| Icon | 🛰️ |
| Color | `#0ea5e9` |
| VizType | `marker` |
| Cache | 300 сек |
| Unit | `satellites` |

## ⚠️ Статус
**Ожидает источник данных.** Basket-файл `data/basket/satellite.json` отсутствует — модуль зарегистрирован в реестре, синтаксически корректен, но не имеет данных. Связано с задачей `sources-001`. Смежный модуль `collect-satellite-stac.mjs` — для STAC-каталога.

---

**Статус:** 🟡 Ожидает источник данных
**Версия:** 2.0
**Обновлено:** 2026-09-23
