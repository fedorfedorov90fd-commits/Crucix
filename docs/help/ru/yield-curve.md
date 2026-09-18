# Yield Curve Module

## 📋 Описание
**Русский:**
Модуль **Yield Curve** отображает кривую доходности государственных облигаций по странам. Показывает спреды между краткосрочными и долгосрочными ставками. Инвертированная кривая — классический индикатор рецессии.

**English:**
The **Yield Curve** module displays government bond yield curves by country. Shows spreads between short-term and long-term rates. Inverted curve is a classic recession indicator.

## 🎯 Назначение
- Оценка денежно-кредитной политики
- Прогнозирование рецессии
- Мониторинг рынка облигаций

## 🚀 Использование
1. Страница: `/yield-curve`
2. API: `/api/yield-curve`
3. Параметры: `?country=US&maturity=2,10`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/yield-curve.html` |
| API | `apis/sources/yield-curve.mjs` |

**Статус:** 🟢 Активен
**Источники:** Treasury, Bloomberg
