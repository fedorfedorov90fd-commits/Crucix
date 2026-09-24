# emotion — Анализ эмоций в тексте

## 📋 Описание
**Русский:**
Модуль **emotion-api** выполняет анализ эмоций в тексте: выделяет 8 базовых эмоций (радость, грусть, гнев, страх, удивление, отвращение, доверие, ожидание) и общую тональность (позитивную, негативную, нейтральную).

**English:**
The **emotion-api** module performs sentiment analysis on text: extracts 8 basic emotions (joy, sadness, anger, fear, surprise, disgust, trust, anticipation) and overall sentiment (positive, negative, neutral).

## 🎯 Назначение
- Оценка эмоциональной окраски новостей и текстов.
- Классификация по 8 базовым эмоциям.
- Определение тональности (позитив/негатив/нейтраль).
- Мониторинг эмоционального фона по регионам.

## 🚀 Использование
- Страница: `/emotion` (или через панель слоёв на `/geo-map`)
- API-эндпоинт: `GET /api/layers/emotion`
- Подпути: `?format=json|csv|series|stats|raw`
- Фильтры: `?emotion=`, `?sentiment=`, `?region=`, `?limit=`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| API-модуль | `apis/sources/emotion-api.mjs` |
| Корзина | `data/basket/emotion.json` |
| Сборщик | `scripts/collectors/collect-emotion.mjs` |
| Help | `docs/help/ru/emotion.md` |

## 📊 Параметры слоя
| Параметр | Значение |
|----------|----------|
| Route | `/api/layers/emotion` |
| Method | `GET` |
| Category | `semantic` |
| Icon | 😊 |
| Color | `#ffd700` |
| VizType | `marker` |
| Cache | 300 сек |
| Unit | `score` |

## ⚠️ Статус
**Ожидает источник данных.** Basket-файл `data/basket/emotion.json` отсутствует — модуль зарегистрирован в реестре, синтаксически корректен, но не имеет данных. Связано с задачей `sources-001`. Внутренний fallback: `data/emotion/analyses.json`.

---

**Статус:** 🟡 Ожидает источник данных
**Версия:** 2.0
**Обновлено:** 2026-09-23
