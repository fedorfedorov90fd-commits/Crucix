# OVX (Oil Volatility) Module

## 📋 Описание
**Русский:**
Модуль **OVX** отслеживает индекс волатильности нефти (OVX) — аналог VIX для нефтяного рынка. Показывает ожидания волатильности на основе опционов на нефть WTI. Используется для оценки рыночного страха и неопределённости.

**English:**
The **OVX** module tracks the oil volatility index (OVX) — VIX equivalent for the oil market. Shows volatility expectations based on WTI oil options. Used for market fear and uncertainty assessment.

## 🎯 Назначение
- Оценка волатильности нефти
- Индикатор рыночного страха
- Торговые сигналы

## 🚀 Использование
1. Страница: `/ovx`
2. API: `/api/ovx`
3. Параметры: `?interval=30d`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/ovx.html` |
| API | `apis/sources/ovx.mjs` |

**Статус:** 🟢 Активен
**Источник:** CBOE
