# 11. Story Builder

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/story-builder.mjs

## Purpose

Clustering events into stories by similarity metric.

## Class

StoryBuilder

## Similarity metric

- Entity similarity (weight 0.5)
- Title similarity (weight 0.3)
- Body similarity (weight 0.2)

## Threshold

Default 0.45. Configured in config.

## Method

addToStories(newEvents, existingStories) - distributes events to existing stories or creates new ones.

## Story relations

With 3 or more shared entities between two stories, related_stories link is created.

## Relations

- Used by: 05-local-engine.md
- Result passed to: 12-summarizer.md, 14-story-store.md
