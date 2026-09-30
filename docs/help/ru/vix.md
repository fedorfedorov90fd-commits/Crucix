# VIX Module

## 📋 Описание
**Русский:**
Модуль **VIX** отслеживает индекс волатильности CBOE VIX — "индекс страха" фондового рынка. Показывает ожидания волатильности S&P 500 на ближайшие 30 дней. Используется для оценки рыночного риска и настроений инвесторов.

**English:**
The **VIX** module tracks the CBOE Volatility Index VIX — the "fear index" of the stock market. Shows S&P 500 volatility expectations for the next 30 days. Used for market risk and investor sentiment assessment.

## 🎯 Назначение
- Оценка рыночного страха
- Индикатор риска
- Торговые сигналы

## 🚀 Использование
1. Страница: `/vix`
2. API: `/api/vix`
3. Параметры: `?interval=30d`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/vix.html` |
| API | `apis/sources/vix.mjs` |

**Статус:** 🟢 Активен
**Источник:** CBOE
