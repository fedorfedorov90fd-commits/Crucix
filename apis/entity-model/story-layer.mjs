// apis/entity-model/story-layer.mjs
// Модель сущностей: маппинг сюжетов SmartScroll в граф знаний Crucix.
// Создаёт узлы Story, TimelineEvent и рёбра:
// contains, mentions, related_to, evolves_into.

export class StoryLayer {
  constructor(options = {}) {
    this.prefix = options.prefix || 'smartscroll';
    this.storyType = options.story_node_type || 'Story';
    this.eventType = options.event_node_type || 'TimelineEvent';
  }

  toGraph(story) {
    const nodes = [];
    const edges = [];

    const storyNode = {
      id: `${this.prefix}:story:${story.id}`,
      type: this.storyType,
      properties: {
        title: story.title,
        summary: story.summary,
        status: story.status,
        start_time: story.start_time,
        end_time: story.end_time,
        source: this.prefix,
        entity_count: story.entities?.length || 0,
        event_count: story.events?.length || 0,
      },
    };
    nodes.push(storyNode);

    for (const ev of (story.events || [])) {
      const evNodeId = `${this.prefix}:event:${ev.id}`;
      nodes.push({
        id: evNodeId,
        type: this.eventType,
        properties: {
          title: ev.title,
          body: ev.body?.slice(0, 1000) || '',
          published_at: ev.published_at,
          source: ev.source,
          url: ev.url || '',
        },
      });

      edges.push({
        from: storyNode.id,
        to: evNodeId,
        type: 'contains',
        properties: {},
      });
    }

    for (const entity of (story.entities || [])) {
      const entityId = `entity:${entity}`;
      edges.push({
        from: storyNode.id,
        to: entityId,
        type: 'mentions',
        properties: {
          confidence: 1.0,
        },
      });
    }

    for (const relatedId of (story.related_stories || [])) {
      edges.push({
        from: storyNode.id,
        to: `${this.prefix}:story:${relatedId}`,
        type: 'related_to',
        properties: {},
      });
    }

    return { nodes, edges };
  }

  toGraphBatch(stories) {
    let allNodes = [];
    let allEdges = [];

    for (const story of stories) {
      const { nodes, edges } = this.toGraph(story);
      allNodes.push(...nodes);
      allEdges.push(...edges);
    }

    const seenNodes = new Set();
    allNodes = allNodes.filter(n => {
      if (seenNodes.has(n.id)) return false;
      seenNodes.add(n.id);
      return true;
    });

    const seenEdges = new Set();
    allEdges = allEdges.filter(e => {
      const key = `${e.from}:${e.type}:${e.to}`;
      if (seenEdges.has(key)) return false;
      seenEdges.add(key);
      return true;
    });

    return { nodes: allNodes, edges: allEdges };
  }

  createEvolutionEdge(oldStory, newStory) {
    return {
      from: `${this.prefix}:story:${oldStory.id}`,
      to: `${this.prefix}:story:${newStory.id}`,
      type: 'evolves_into',
      properties: {
        transition_time: new Date().toISOString(),
        shared_entities: oldStory.entities.filter(e =>
          newStory.entities.includes(e)
        ),
      },
    };
  }

  checkEvolution(story, allStories) {
    if (story.status !== 'closed') return null;

    for (const relatedId of (story.related_stories || [])) {
      const related = allStories.find(s => s.id === relatedId);
      if (!related || related.status !== 'active') continue;

      const shared = story.entities.filter(e =>
        related.entities.includes(e)
      );
      if (shared.length >= 3) {
        return { oldStory: story, newStory: related };
      }
    }
    return null;
  }
}
