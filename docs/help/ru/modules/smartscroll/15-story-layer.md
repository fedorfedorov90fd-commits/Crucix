# 15. Модель сущностей

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/entity-model/story-layer.mjs

## Назначение

Модель сущностей: маппинг сюжетов SmartScroll в граф знаний Crucix.

## Класс

StoryLayer

## Методы

- toGraph(story) — конвертация сюжета в узлы и рёбра
- toGraphBatch(stories) — пакетная конвертация с дедупликацией
- createEvolutionEdge(oldStory, newStory) — создание ребра эволюции
- checkEvolution(story, allStories) — проверка необходимости эволюции

## Типы узлов

- Story — сюжет
- TimelineEvent — событие
- Entity — сущность (через резолвер)

## Типы рёбер

- contains — сюжет содержит событие
- mentions — сюжет упоминает сущность
- related_to — сюжет связан с другим сюжетом
- evolves_into — закрытый сюжет эволюционирует в активный

## Связи

- Используется: 16-event-ingestion.md
- Результат передаётся в граф знаний Crucix
