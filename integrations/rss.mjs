// integrations/rss.mjs
// RSS/Atom feed generator для Crucix.
// Три формата: Atom 1.0, RSS 2.0, JSON Feed 1.1.
// Zero dependencies: только node:fs, node:path.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LEVEL_LABELS = {
  low: '[LOW]',
  moderate: '[MOD]',
  elevated: '[ELEV]',
  high: '[HIGH]',
  critical: '[CRIT]',
};

class FeedGenerator {
  constructor({
    baseUrl = process.env.CRUCIX_BASE_URL || 'http://localhost:3118',
    title = 'Crucix Predictions',
    description = 'Multidisciplinary predictive intelligence alerts',
    language = 'ru',
    maxItems = 50,
  } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.title = title;
    this.description = description;
    this.language = language;
    this.maxItems = maxItems;
  }

  loadPredictions(runsDir) {
    if (!runsDir || !existsSync(runsDir)) return [];
    try {
      const files = readdirSync(runsDir)
        .filter(f => f.startsWith('prediction_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, this.maxItems);

      const predictions = [];
      for (const file of files) {
        try {
          const raw = readFileSync(join(runsDir, file), 'utf-8');
          const data = JSON.parse(raw);
          if (data && typeof data === 'object') predictions.push(data);
        } catch (_) { /* skip malformed */ }
      }
      return predictions;
    } catch (_) {
      return [];
    }
  }

  _ts(p) {
    const ts = p && p.timestamp;
    const d = ts ? new Date(ts) : new Date();
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  _levelLabel(level) {
    return LEVEL_LABELS[level] || '[UNKNOWN]';
  }

  _title(p) {
    const cr = (p && p.compositeRisk) || {};
    const composite = Number.isFinite(Number(cr.composite)) ? Number(cr.composite).toFixed(3) : '0.000';
    return this._levelLabel(cr.level) + ' ' + String(cr.level || 'unknown').toUpperCase() + ': ' + composite;
  }

  _link(p) {
    return this.baseUrl + '/prediction/' + encodeURIComponent(this._ts(p));
  }

  generateAtom(predictions) {
    const now = new Date().toISOString();
    const updated = predictions.length > 0 ? this._ts(predictions[0]) : now;

    const entries = predictions.map(p => {
      const cr = (p && p.compositeRisk) || {};
      const title = this._title(p);
      const composite = Number.isFinite(Number(cr.composite)) ? Number(cr.composite).toFixed(3) : '0.000';

      const drivers = (cr.topDrivers || []).slice(0, 3)
        .map(d => '- ' + this._escapeXml(d.name) + ': ' + (Number.isFinite(Number(d.value)) ? (Number(d.value) * 100).toFixed(1) : '0.0') + '%')
        .join('\n');

      const content =
        '<h2>' + this._escapeXml(title) + '</h2>' +
        '<p><strong>Composite Risk:</strong> ' + composite + '</p>' +
        '<p><strong>Level:</strong> ' + this._escapeXml(cr.level || 'unknown') + '</p>' +
        '<p><strong>Confidence:</strong> ' + this._escapeXml(cr.confidence || 'unknown') + '</p>' +
        '<h3>Top Drivers</h3>' +
        '<pre>' + this._escapeXml(drivers) + '</pre>';

      const id = this._link(p);
      const ts = this._ts(p);

      return '\n  <entry>\n' +
        '    <title>' + this._escapeXml(title) + '</title>\n' +
        '    <link href="' + this._escapeXml(id) + '"/>\n' +
        '    <id>' + this._escapeXml(id) + '</id>\n' +
        '    <updated>' + ts + '</updated>\n' +
        '    <author><name>Crucix</name></author>\n' +
        '    <category term="prediction"/>\n' +
        '    <category term="level-' + this._escapeXml(cr.level || 'unknown') + '"/>\n' +
        '    <content type="html">' + this._escapeXml(content) + '</content>\n' +
        '  </entry>';
    }).join('\n');

    return '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<feed xmlns="http://www.w3.org/2005/Atom">\n' +
      '  <title>' + this._escapeXml(this.title) + '</title>\n' +
      '  <subtitle>' + this._escapeXml(this.description) + '</subtitle>\n' +
      '  <link href="' + this._escapeXml(this.baseUrl) + '/feed.xml" rel="self"/>\n' +
      '  <link href="' + this._escapeXml(this.baseUrl) + '/"/>\n' +
      '  <id>' + this._escapeXml(this.baseUrl) + '/</id>\n' +
      '  <updated>' + updated + '</updated>\n' +
      '  <author><name>Crucix</name></author>\n' +
      '  <generator>Crucix Integrations 3.0.0</generator>\n' +
      '  <rights>MIT</rights>\n' +
      entries + '\n</feed>';
  }

  generateRSS(predictions) {
    const buildDate = new Date().toUTCString();

    const items = predictions.map(p => {
      const cr = (p && p.compositeRisk) || {};
      const title = this._title(p);
      const link = this._link(p);
      const composite = Number.isFinite(Number(cr.composite)) ? Number(cr.composite).toFixed(3) : '0.000';
      const signalsCount = Array.isArray(cr.signals) ? cr.signals.length : 0;
      const description =
        'Composite Risk: ' + composite +
        ' | Level: ' + (cr.level || 'unknown') +
        ' | Signals: ' + signalsCount;

      return '\n    <item>\n' +
        '      <title>' + this._escapeXml(title) + '</title>\n' +
        '      <link>' + this._escapeXml(link) + '</link>\n' +
        '      <guid isPermaLink="true">' + this._escapeXml(link) + '</guid>\n' +
        '      <pubDate>' + new Date(this._ts(p)).toUTCString() + '</pubDate>\n' +
        '      <category>prediction</category>\n' +
        '      <category>level-' + this._escapeXml(cr.level || 'unknown') + '</category>\n' +
        '      <description>' + this._escapeXml(description) + '</description>\n' +
        '    </item>';
    }).join('\n');

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
      '  <channel>\n' +
      '    <title>' + this._escapeXml(this.title) + '</title>\n' +
      '    <link>' + this._escapeXml(this.baseUrl) + '/</link>\n' +
      '    <description>' + this._escapeXml(this.description) + '</description>\n' +
      '    <language>' + this._escapeXml(this.language) + '</language>\n' +
      '    <lastBuildDate>' + buildDate + '</lastBuildDate>\n' +
      '    <generator>Crucix Integrations 3.0.0</generator>\n' +
      '    <atom:link href="' + this._escapeXml(this.baseUrl) + '/feed.rss" rel="self" type="application/rss+xml"/>\n' +
      items + '\n  </channel>\n</rss>';
  }

  generateJSONFeed(predictions) {
    const items = predictions.map(p => {
      const cr = (p && p.compositeRisk) || {};
      const composite = Number.isFinite(Number(cr.composite)) ? Number(cr.composite).toFixed(3) : '0.000';
      const id = this._link(p);

      return {
        id: id,
        url: id,
        title: this._title(p),
        content_text:
          'Composite Risk: ' + composite +
          '\nLevel: ' + (cr.level || 'unknown') +
          '\nConfidence: ' + (cr.confidence || 'unknown') +
          '\nSignals: ' + (Array.isArray(cr.signals) ? cr.signals.length : 0),
        date_published: this._ts(p),
        tags: ['prediction', 'level-' + (cr.level || 'unknown')],
      };
    });

    return JSON.stringify({
      version: 'https://jsonfeed.org/version/1.1',
      title: this.title,
      description: this.description,
      home_page_url: this.baseUrl,
      feed_url: this.baseUrl + '/feed.json',
      language: this.language,
      authors: [{ name: 'Crucix', url: this.baseUrl }],
      items: items,
    }, null, 2);
  }

  generateAll(predictions) {
    return {
      atom: this.generateAtom(predictions),
      rss: this.generateRSS(predictions),
      json: this.generateJSONFeed(predictions),
    };
  }

  getInfo() {
    return RSS_INFO;
  }

  _escapeXml(str) {
    if (str === undefined || str === null) return '';
    const s = String(str);
    if (s === 'NaN') return '0';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

function feedHandler(generator, runsDir, format = 'atom') {
  return (req, res) => {
    const predictions = generator.loadPredictions(runsDir);

    if (predictions.length === 0) {
      res.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Crucix-Module': 'rss',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify({ error: 'no_data', reason: 'no_predictions_available' }));
      return;
    }

    let content, contentType;
    if (format === 'atom') {
      content = generator.generateAtom(predictions);
      contentType = 'application/atom+xml; charset=utf-8';
    } else if (format === 'rss') {
      content = generator.generateRSS(predictions);
      contentType = 'application/rss+xml; charset=utf-8';
    } else if (format === 'json') {
      content = generator.generateJSONFeed(predictions);
      contentType = 'application/feed+json; charset=utf-8';
    } else {
      res.writeHead(400, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Crucix-Module': 'rss',
      });
      res.end(JSON.stringify({ error: 'bad_format', allowed: ['atom', 'rss', 'json'] }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Crucix-Module': 'rss',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(content);
  };
}

const RSS_INFO = {
  name: 'RSS/Atom Feed',
  description: 'Publish predictions as RSS/Atom/JSON feed',
  format: ['atom', 'rss', 'json'],
  optional: true,
};

export { FeedGenerator, feedHandler, RSS_INFO };
