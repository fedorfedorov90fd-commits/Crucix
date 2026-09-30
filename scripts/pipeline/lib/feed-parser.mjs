/**
 * feed-parser.mjs — автономный парсер RSS 2.0 / Atom 1.0 / RDF (RSS 1.0)
 * Зависимости: ноль. Только встроенный fetch (Node 18+).
 * Портабельно: RSSHub-URL из env, никаких хардкодов путей.
 */

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(s) {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function extractCDATA(s) {
  if (!s) return '';
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}

function getText(parent, tag) {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`, 'i');
  const m = parent.match(re);
  return m ? decodeEntities(stripTags(extractCDATA(m[1]))) : '';
}

function getAttr(parent, tag, attr) {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*\\b${attr}="([^"]*)"`, 'i');
  const m = parent.match(re);
  return m ? decodeEntities(m[1]) : '';
}

function parseRSS(xml, url) {
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    items.push({
      guid: getText(block, 'guid') || getAttr(block, 'guid', 'isPermaLink'),
      title: getText(block, 'title'),
      link: getText(block, 'link'),
      description: getText(block, 'description'),
      pubDate: getText(block, 'pubDate'),
      author: getText(block, 'author') || getAttr(block, 'dc:creator', 'xmlns') || getText(block, 'creator'),
      categories: [],
      enclosure: getAttr(block, 'enclosure', 'url') || null,
      source: url,
    });
    const catRe = /<(?:[a-zA-Z0-9]+:)?category[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?category>/gi;
    let cm;
    while ((cm = catRe.exec(block)) !== null) {
      items[items.length - 1].categories.push(decodeEntities(stripTags(cm[1])));
    }
  }
  return { format: 'rss2.0', channel: getText(xml, 'title'), items };
}

function parseAtom(xml, url) {
  const items = [];
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[0];
    const linkHref = getAttr(block, 'link', 'href') || getText(block, 'link');
    items.push({
      guid: getText(block, 'id') || linkHref,
      title: getText(block, 'title'),
      link: linkHref,
      description: getText(block, 'summary') || getText(block, 'content'),
      pubDate: getText(block, 'updated') || getText(block, 'published'),
      author: getText(block, 'name'),
      categories: [],
      enclosure: getAttr(block, 'link') === 'enclosure' ? getAttr(block, 'link', 'href') : null,
      source: url,
    });
    const catRe = /<category[^>]*?(?:term|label)="([^"]*)"/gi;
    let cm;
    while ((cm = catRe.exec(block)) !== null) {
      items[items.length - 1].categories.push(decodeEntities(cm[1]));
    }
  }
  return { format: 'atom1.0', channel: getText(xml, 'title'), items };
}

function parseRDF(xml, url) {
  const items = [];
  const itemRe = /<(?:rdf:)?item[\s\S]*?<\/(?:rdf:)?item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    items.push({
      guid: getAttr(block, 'item', 'rdf:about') || getText(block, 'identifier'),
      title: getText(block, 'title'),
      link: getText(block, 'link') || getAttr(block, 'item', 'rdf:about'),
      description: getText(block, 'description'),
      pubDate: getText(block, 'date') || getText(block, 'dc:date'),
      author: getText(block, 'creator'),
      categories: [],
      enclosure: null,
      source: url,
    });
  }
  return { format: 'rdf1.0', channel: getText(xml, 'title'), items };
}

export function parseFeed(xml, url = '') {
  if (/xmlns.*atom/i.test(xml) || /<feed[\s>]/i.test(xml)) return parseAtom(xml, url);
  if (/xmlns.*rdf/i.test(xml) || /<rdf:RDF/i.test(xml)) return parseRDF(xml, url);
  return parseRSS(xml, url);
}

export async function fetchFeed(url, opts = {}) {
  // Прямой запрос (direct)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': opts.userAgent || 'Crucix/2.0 FeedParser', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: opts.timeout ? AbortSignal.timeout(opts.timeout) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, url);
  } catch (directErr) {
    // Fallback на RSSHub, если задан
    const rsshubUrl = process.env.RSSHUB_URL || '';
    if (rsshubUrl && opts.rsshubRoute) {
      const fullUrl = rsshubUrl.replace(/\/$/, '') + '/' + opts.rsshubRoute.replace(/^\//, '');
      const res = await fetch(fullUrl, {
        headers: { 'User-Agent': opts.userAgent || 'Crucix/2.0 FeedParser' },
        signal: opts.timeout ? AbortSignal.timeout(opts.timeout) : undefined,
      });
      if (!res.ok) throw new Error(`RSSHub HTTP ${res.status}: ${directErr.message}`);
      const xml = await res.text();
      return parseFeed(xml, fullUrl);
    }
    throw directErr;
  }
}

export default { parseFeed, fetchFeed };
