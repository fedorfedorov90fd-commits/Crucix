# 14. Хранилище сюжетов

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/storage/story-store.mjs

## Назначение

Файловое хранилище сюжетов и событий.

## Класс

StoryStore

## Методы

- getAllStories() — чтение всех сюжетов с кэшем
- getStory(id) — чтение одного сюжета
- getAllEvents() — чтение всех событий
- saveStories(stories) — сохранение массива сюжетов
- saveStory(story) — сохранение одного сюжета
- deleteStory(id) — удаление сюжета
- invalidateCache() — сброс кэша
- getSize() — размер хранилища

## Структура папок

data/smartscroll/
  stories/         — по одному JSON-файлу на сюжет
  events/          — резервная папка событий
  _index.json      — индекс сюжетов

## Связи

- Используется: 05-local-engine.md
