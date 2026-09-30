# 14. Story Store

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/storage/story-store.mjs

## Purpose

File storage of stories and events.

## Class

StoryStore

## Methods

- getAllStories() - read all stories with cache
- getStory(id) - read single story
- getAllEvents() - read all events
- saveStories(stories) - save array of stories
- saveStory(story) - save single story
- deleteStory(id) - delete story
- invalidateCache() - reset cache
- getSize() - storage size

## Folder structure

data/smartscroll/
  stories/         - one JSON file per story
  events/          - backup events folder
  _index.json      - story index

## Relations

- Used by: 05-local-engine.md
