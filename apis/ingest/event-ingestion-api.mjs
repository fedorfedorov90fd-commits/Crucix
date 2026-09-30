// apis/ingest/event-ingestion-api.mjs
// Single entry point for SmartScroll events into Crucix pipeline.
// Built-in HTTP server with endpoints:
//   GET  /health
//   GET  /metrics
//   GET  /stats
//   GET  /stories?limit=N&since=ISO
//   GET  /stories/:id
//   GET  /stories/:id/timeline
//   POST /run       (ingestion of stories into graph)
//   POST /collect   (full collect cycle from sources)

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { createSmartScrollSource } from '../sources/smartscroll-local/index.mjs';
import { StoryLayer } from '../entity-model/story-layer.mjs';
import { Deduplicator } from '../sources/smartscroll-local/processing/dedup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = process.env.SMARTSCROLL_CONFIG ||
  join(__dirname, '../../config/smartscroll.json');
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

const source = createSmartScrollSource();
const storyLayer = new StoryLayer(config.entity_model || {});
const dedup = new Deduplicator(config.local?.dedup_threshold || 0.75);

let graph = null;

export function setGraphAdapter(graphAdapter) {
  graph = graphAdapter;
}

export async function ingestStories(opts = {}) {
  const errors = [];
  let imported = 0;
  let deduped = 0;
  let skipped = 0;

  try {
    const stories = await source.fetchStories(opts);

    for (const story of stories) {
      try {
        if (story.events?.length > 1) {
          const before = story.events.length;
          story.events = dedup.deduplicate(story.events, []);
          deduped += before - story.events.length;
        }

        const { nodes, edges } = storyLayer.toGraph(story);

        if (graph) {
          for (const node of nodes) {
            await graph.addNode(node);
          }
          for (const edge of edges) {
            await graph.addEdge(edge);
          }
          for (const entity of (story.entities || [])) {
            try {
              await graph.resolveEntity(entity);
            } catch (err) {
              errors.push(`entity resolution "${entity}": ${err.message}`);
            }
          }
        }

        const allStories = await source.fetchStories({ limit: 1000 });
        const evolution = storyLayer.checkEvolution(story, allStories);
        if (evolution && graph) {
          const edge = storyLayer.createEvolutionEdge(
            evolution.oldStory,
            evolution.newStory
          );
          await graph.addEdge(edge);
        }

        imported++;
      } catch (err) {
        errors.push(`story ${story.id}: ${err.message}`);
        skipped++;
      }
    }
  } catch (err) {
    errors.push(`ingestion failed: ${err.message}`);
  }

  return { imported, deduped, skipped, errors };
}

export async function runCollectCycle() {
  if (typeof source.runCycle === 'function') {
    return await source.runCycle();
  }
  if (source.local && typeof source.local.runCycle === 'function') {
    return await source.local.runCycle();
  }
  return { error: 'runCycle not available on source' };
}

export async function getTimeline(storyId) {
  return source.fetchTimeline(storyId);
}

export async function getStoryDetail(storyId) {
  return source.fetchStoryDetail(storyId);
}

export async function healthCheck() {
  const sourceHealth = await source.healthCheck();
  return {
    ok: sourceHealth.ok,
    mode: sourceHealth.mode,
    details: {
      source: sourceHealth.details,
      graph: graph ? 'connected' : 'not-connected',
    },
  };
}

export function startIngestionLoop(intervalMs = 300000) {
  console.log(`[event-ingestion-api] starting loop, interval=${intervalMs}ms`);
  const timer = setInterval(async () => {
    try {
      const result = await ingestStories({ limit: 50 });
      console.log(`[event-ingestion-api] ingested: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error('[event-ingestion-api] loop error:', err.message);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

// --- HTTP server ---

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message, status });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (path === '/health' && method === 'GET') {
    const health = await healthCheck();
    return sendJson(res, 200, health);
  }

  if (path === '/metrics' && method === 'GET') {
    if (typeof source.getMetrics === 'function') {
      const metrics = source.getMetrics();
      if (metrics) return sendJson(res, 200, metrics);
    }
    return sendJson(res, 200, {
      mode: source.mode,
      note: 'metrics unavailable',
    });
  }

  if (path === '/stats' && method === 'GET') {
    try {
      const stories = await source.fetchStories({ limit: 10000 });
      const totalEvents = stories.reduce((sum, s) => sum + (s.events?.length || 0), 0);
      return sendJson(res, 200, {
        stories: stories.length,
        events: totalEvents,
        mode: config.mode || 'auto',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (path === '/stories' && method === 'GET') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const since = url.searchParams.get('since') || undefined;
      const stories = await source.fetchStories({ limit, since });
      return sendJson(res, 200, { items: stories, count: stories.length });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  const timelineMatch = path.match(/^\/stories\/([^/]+)\/timeline$/);
  if (timelineMatch && method === 'GET') {
    try {
      const timeline = await getTimeline(timelineMatch[1]);
      return sendJson(res, 200, { items: timeline, count: timeline.length });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  const storyMatch = path.match(/^\/stories\/([^/]+)$/);
  if (storyMatch && method === 'GET') {
    try {
      const story = await getStoryDetail(storyMatch[1]);
      if (!story) return sendError(res, 404, 'Story not found');
      return sendJson(res, 200, story);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (path === '/run' && method === 'POST') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const result = await ingestStories({ limit });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (path === '/collect' && method === 'POST') {
    try {
      const result = await runCollectCycle();
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  return sendError(res, 404, 'Not found: ' + path);
}

export function startHttpServer(port = 3157) {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch(err => {
      console.error('[event-ingestion-api] handler error:', err.message);
      sendError(res, 500, err.message);
    });
  });

  server.listen(port, () => {
    console.log(`[event-ingestion-api] HTTP server listening on http://localhost:${port}`);
  });

  return server;
}

const isMain = process.argv[1]?.endsWith('event-ingestion-api.mjs');
if (isMain) {
  const stopFn = startIngestionLoop(config.local?.collect_interval_ms || 300000);
  const httpPort = parseInt(process.env.SMARTSCROLL_HTTP_PORT || '3157', 10);
  const httpServer = startHttpServer(httpPort);
  console.log('[event-ingestion-api] running. Press Ctrl+C to stop.');

  process.on('SIGINT', () => {
    stopFn();
    httpServer.close();
    console.log('[event-ingestion-api] stopped.');
    process.exit(0);
  });
}
