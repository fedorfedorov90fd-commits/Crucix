# 12. Суммаризатор

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/summarizer.mjs

## Назначение

Extractive-суммаризация сюжетов на основе TF-IDF и MMR.

## Класс

Summarizer

## Метод

summarize(events) — формирует сводку из заголовков и тел событий.

## Алгоритм

1. Разбиение текстов на предложения
2. Вычисление TF-IDF для оценки информативности
3. Отбор N предложений через MMR (Maximal Marginal Relevance) с балансом релевантности и новизны
4. Возврат в исходном порядке

## Параметры

- numSentences — количество предложений (по умолчанию 3)

## Связи

- Используется: 05-local-engine.md
