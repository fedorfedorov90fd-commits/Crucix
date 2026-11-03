// widgets/rss-graph.js — граф связей тем (D3 force, SVG)
// Читает /api/layers/taxonomy-gaps/topics + narrative-framing
// Строит граф: тема → тип (country/city/person/organization) + связь с gap_type
// Использование: <div id="rss-graph"></div> + <script type="module" src="/widgets/rss-graph.js"></script>

export async function mountRssGraph(containerId = 'rss-graph') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/taxonomy-gaps/topics?limit=25');
    const data = await res.json();
    const topics = data.topics || [];

    if (topics.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет данных</span>';
      return;
    }

    // Строим узлы: темы + типы + gap_types
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    const addNode = (id, label, type, weight = 1) => {
      if (nodeMap.has(id)) return;
      const node = { id, label, type, weight };
      nodes.push(node);
      nodeMap.set(id, node);
    };

    // Узлы: типы
    const types = new Set(topics.map(t => t.topic_type || 'unknown'));
    for (const t of types) addNode(`type-${t}`, t, 'type', 2);

    // Узлы: gap_types
    const gapTypes = new Set(topics.map(t => t.gap_type));
    for (const g of gapTypes) addNode(`gap-${g}`, g, 'gap', 3);

    // Узлы: темы + связи
    for (const t of topics) {
      const topicId = `topic-${t.topic}`;
      addNode(topicId, t.name || t.topic, 'topic', Math.log((t.total_events || 1) + 1) * 2);
      links.push({ source: topicId, target: `type-${t.topic_type || 'unknown'}`, weight: 1 });
      links.push({ source: topicId, target: `gap-${t.gap_type}`, weight: 1 });
    }

    // Простая force-directed раскладка через симуляцию (без D3, чтобы не тянуть библиотеку)
    const width = el.clientWidth || 800;
    const height = 400;

    // Инициализация позиций
    for (const n of nodes) {
      n.x = Math.random() * width;
      n.y = Math.random() * height;
      n.vx = 0;
      n.vy = 0;
    }

    // Симуляция (100 итераций)
    const iterations = 200;
    for (let it = 0; it < iterations; it++) {
      const alpha = 1 - it / iterations;
      // Отталкивание
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 5000 / (dist * dist);
          const fx = (dx / dist) * force * alpha;
          const fy = (dy / dist) * force * alpha;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      // Притяжение по связям
      for (const l of links) {
        const a = nodeMap.get(l.source), b = nodeMap.get(l.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.05 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Применяем
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        n.vx *= 0.5; n.vy *= 0.5;
        n.x = Math.max(20, Math.min(width - 20, n.x));
        n.y = Math.max(20, Math.min(height - 20, n.y));
      }
    }

    // Рисуем SVG
    const typeColor = { topic: '#5bc0f8', type: '#f59e0b', gap: '#ef4444' };
    const linksSvg = links.map(l => {
      const a = nodeMap.get(l.source), b = nodeMap.get(l.target);
      if (!a || !b) return '';
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    }).join('');
    const nodesSvg = nodes.map(n => {
      const r = Math.max(3, Math.min(20, n.weight || 5));
      const color = typeColor[n.type] || '#8899aa';
      return `<g><circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${color}" opacity="0.8"/>
        <text x="${n.x + r + 2}" y="${n.y + 4}" font-size="10" fill="#e0e0e0" font-family="system-ui">${n.label}</text></g>`;
    }).join('');

    el.innerHTML = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="background:rgba(0,0,0,0.2);border-radius:6px;">${linksSvg}${nodesSvg}</svg>
      <div style="font-size:10px;color:#8899aa;margin-top:8px;">
        <span style="color:#5bc0f8;">●</span> тема &nbsp;
        <span style="color:#f59e0b;">●</span> тип &nbsp;
        <span style="color:#ef4444;">●</span> gap_type
      </div>`;
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountRssGraph());
} else {
  mountRssGraph();
}
