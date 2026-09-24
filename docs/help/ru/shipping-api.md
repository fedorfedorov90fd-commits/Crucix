# shipping — Морской трекинг и детектор тёмных судов

## 📋 Описание
**Русский:**
Модуль **shipping-api** отдаёт морской трекинг AIS-судов с детектором тёмных судов (vessels с выключенным AIS или без сигнала). Отображает хотспоты: Суэц, Босфор, Ормуз, Малакка, Баб-эль-Мандеб.

**English:**
The **shipping-api** module provides AIS vessel tracking with dark vessel detection (vessels with disabled AIS or no signal). Displays hotspots: Suez, Bosphorus, Hormuz, Malacca, Bab-el-Mandeb.

## 🎯 Назначение
- Отображение морских судов на карте.
- Детектор тёмных судов (dark fleet).
- Мониторинг морских хотспотов.
- Анализ морской активности.

## 🚀 Использование
- Страница: `/shipping` (или через панель слоёв на `/geo-map`)
- API-эндпоинт: `GET /api/layers/shipping`
- Подпути: `?format=json|csv|series|stats|raw`
- Фильтры: `?type=`, `?flag=`, `?dark=true`, `?hotspot=`, `?limit=`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| API-модуль | `apis/sources/shipping-api.mjs` |
| Корзина | `data/basket/shipping.json` |
| Сборщик | `scripts/collectors/collect-shipping.mjs` |
| Help | `docs/help/ru/shipping.md` |

## 📊 Параметры слоя
| Параметр | Значение |
|----------|----------|
| Route | `/api/layers/shipping` |
| Method | `GET` |
| Category | `transport` |
| Icon | 🚢 |
| Color | `#0891b2` |
| VizType | `marker` |
| Cache | 300 сек |
| Unit | `vessels` |

## ⚠️ Статус
**Ожидает источник данных.** Basket-файл `data/basket/shipping.json` отсутствует — модуль зарегистрирован в реестре, синтаксически корректен, но не имеет данных. Связано с задачей `sources-001`. Смежные файлы: `data/basket/shipping-lanes.json`, `data/basket/shipping-route.json` — другие аспекты морской активности.

---

**Статус:** 🟡 Ожидает источник данных
**Версия:** 2.0
**Обновлено:** 2026-09-23
