// tests/predict/narrative_warfare.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NarrativeWarfareDetector, computeNarrativeConfidence, isPropagandaSource, crucixNarrativeWarfare } from '../../apis/predict/narrative_warfare.mjs';

describe('isPropagandaSource', () => {
  it('распознаёт RT', () => {
    assert.strictEqual(isPropagandaSource('https://rt.com/news/article'), true);
  });
  it('не распознаёт BBC', () => {
    assert.strictEqual(isPropagandaSource('https://bbc.com/news'), false);
  });
});

describe('NarrativeWarfareDetector', () => {
  it('не находит кампаний в малом количестве постов', () => {
    const d = new NarrativeWarfareDetector();
    const result = d.detectCampaigns([{ text: 'test', source: 'a.com', timestamp: new Date().toISOString() }]);
    assert.strictEqual(result.available, false);
  });

  it('обнаруживает скоординированную кампанию', () => {
    const d = new NarrativeWarfareDetector({ minSourcesForCampaign: 3, similarityThreshold: 0.4 });
    const now = Date.now();
    const sharedText = 'СРОЧНО катастрофа паника ужас шок';
    const posts = [
      { text: sharedText + ' 1', source: 'rt.com', timestamp: new Date(now).toISOString() },
      { text: sharedText + ' 2', source: 'sputniknews.com', timestamp: new Date(now + 60000).toISOString() },
      { text: sharedText + ' 3', source: 'tass.ru', timestamp: new Date(now + 120000).toISOString() },
      { text: sharedText + ' 4', source: 'ria.ru', timestamp: new Date(now + 180000).toISOString() },
    ];

    const result = d.detectCampaigns(posts);
    assert.strictEqual(result.available, true);
    assert.ok(result.campaignsDetected > 0);
    const campaign = result.campaigns[0];
    assert.ok(campaign.suspicionScore > 0.4);
    assert.ok(campaign.knownPropagandaSources.length > 0);
  });

  it('классифицирует state_propaganda', () => {
    const d = new NarrativeWarfareDetector();
    const result = d._classify(0.8, 0.7, 0.8);
    assert.strictEqual(result, 'state_propaganda');
  });
});

describe('computeNarrativeConfidence', () => {
  it('низкая уверенность при пропагандистских источниках', () => {
    const posts = [
      { text: 'test1', source: 'rt.com' },
      { text: 'test2', source: 'sputniknews.com' },
    ];
    const result = computeNarrativeConfidence(posts);
    assert.ok(result.confidence < 0.5);
    assert.strictEqual(result.propagandaSources, 2);
    assert.strictEqual(result.independentSources, 0);
  });

  it('высокая уверенность при независимых источниках', () => {
    const posts = [
      { text: 'unique text one', source: 'bbc.com' },
      { text: 'different text two', source: 'reuters.com' },
      { text: 'third independent three', source: 'apnews.com' },
      { text: 'fourth source text', source: 'nytimes.com' },
      { text: 'fifth original text', source: 'washingtonpost.com' },
    ];
    const result = computeNarrativeConfidence(posts);
    assert.ok(result.confidence > 0.4);
  });
});

describe('crucixNarrativeWarfare', () => {
  it('возвращает unavailable при малом количестве постов', () => {
    const result = crucixNarrativeWarfare({ gdelt: { rawEvents: [] } }, []);
    assert.strictEqual(result.available, false);
  });

  it('обрабатывает GDELT события', () => {
    const latest = {
      gdelt: {
        rawEvents: [
          { summary: 'Conflict in region A escalated today with multiple attacks', sourceUrl: 'https://reuters.com/x', timestamp: new Date().toISOString() },
          { summary: 'Conflict in region A escalated today with multiple attacks again', sourceUrl: 'https://bbc.com/y', timestamp: new Date().toISOString() },
          { summary: 'Reports of new attacks in region A conflict escalated', sourceUrl: 'https://apnews.com/z', timestamp: new Date().toISOString() },
        ],
      },
    };
    const result = crucixNarrativeWarfare(latest, []);
    assert.strictEqual(result.module, 'narrative_warfare');
  });
});
