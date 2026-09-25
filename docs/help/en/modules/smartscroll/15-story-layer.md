# 15. Entity Model

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/entity-model/story-layer.mjs

## Purpose

Entity model: mapping SmartScroll stories into Crucix knowledge graph.

## Class

StoryLayer

## Methods

- toGraph(story) - convert story to nodes and edges
- toGraphBatch(stories) - batch conversion with deduplication
- createEvolutionEdge(oldStory, newStory) - create evolution edge
- checkEvolution(story, allStories) - check evolution need

## Node types

- Story - story
- TimelineEvent - event
- Entity - entity (via resolver)

## Edge types

- contains - story contains event
- mentions - story mentions entity
- related_to - story related to another story
- evolves_into - closed story evolves into active

## Relations

- Used by: 16-event-ingestion.md
- Result passed to Crucix knowledge graph
