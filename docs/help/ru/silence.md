# silence — Детектор информационной тишины

## 📋 Описание
**Русский:**
Модуль **silence-api** — детектор информационной тишины: обнаруживает аномальные падения новостного потока по регионам. Используется для выявления информационных блокировок, цензуры, прекращения вещания.

**English:**
The **silence-api** module is an information silence detector: it finds anomalous drops in news flow by region. Used to identify information blockages, censorship, broadcast interruptions.

## 🎯 Назначение
- Обнаружение информационных блокировок.
- Мониторинг цензуры.
- Анализ доступности данных по регионам.
- Раннее предупреждение о прекращении вещания.

## 🚀 Использование
- Страница: `/silence` (или через панель слоёв на `/geo-map`)
- API-эндпоинт: `GET /api/layers/silence`
- Подпути: `?format=json|csv|series|stats|raw`, `/health`
- Фильтры: `?region=`, `?min=`, `?severity=`, `?limit=`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| API-модуль | `apis/sources/silence-api.mjs` |
| Корзина | `data/basket/silence.json` |
| Сборщик | `scripts/collectors/collect-silence.mjs` |
| Help | `docs/help/ru/silence.md` |

## 📊 Параметры слоя
| Параметр | Значение |
|----------|----------|
| Route | `/api/layers/silence` |
| Method | `GET` |
| Category | `intelligence` |
| Icon | 🤫 |
| Color | `#6366f1` |
| VizType | `marker` |
| Cache | 300 сек |
| Unit | `regions` |

## ⚠️ Статус
**Ожидает источник данных.** Basket-файл `data/basket/silence.json` отсутствует — модуль зарегистрирован в реестре, синтаксически корректен, но не имеет данных. Связано с задачей `sources-001`.

---

**Статус:** 🟡 Ожидает источник данных
**Версия:** 2.0
**Обновлено:** 2026-09-23
