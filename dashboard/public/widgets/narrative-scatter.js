// widgets/narrative-scatter.js — scatter «западный охват vs российский»
export async function mountNarrativeScatter(containerId = 'narrative-scatter') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/narrative-framing/topics?limit=50');
    const data = await res.json();
    const topics = data.topics || [];

    if (topics.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет данных</span>';
      return;
    }

    const W = 600, H = 500, PAD = 50;
    const maxX = Math.max(...topics.map(t => t.western_count || 0), 1);
    const maxY = Math.max(...topics.map(t => t.russian_count || 0), 1);
    const maxN = Math.max(maxX, maxY);

    const scaleX = x => PAD + (x / maxN) * (W - PAD * 2);
    const scaleY = y => H - PAD - (y / maxN) * (H - PAD * 2);

    const colors = { high: '#ef4444', normal: '#4ade80', critical: '#f59e0b' };

    let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:600px;height:auto;background:#0d0d1a;border-radius:8px;">`;

    // Сетка
    for (let i = 0; i <= maxN; i += Math.ceil(maxN / 5)) {
      svg += `<line x1="${scaleX(i)}" y1="${PAD}" x2="${scaleX(i)}" y2="${H - PAD}" stroke="#1a1a2e" stroke-width="1"/>`;
      svg += `<line x1="${PAD}" y1="${scaleY(i)}" x2="${W - PAD}" y2="${scaleY(i)}" stroke="#1a1a2e" stroke-width="1"/>`;
    }

    // Диагональ паритета
    svg += `<line x1="${scaleX(0)}" y1="${scaleY(0)}" x2="${scaleX(maxN)}" y2="${scaleY(maxN)}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.5"/>`;

    // Оси
    svg += `<text x="${W / 2}" y="${H - 10}" fill="#8899aa" font-size="13" text-anchor="middle">Западный охват →</text>`;
    svg += `<text x="15" y="${H / 2}" fill="#8899aa" font-size="13" text-anchor="middle" transform="rotate(-90 15 ${H / 2})">Российский охват ↑</text>`;

    // Точки
    topics.forEach(t => {
      const w = t.western_count || 0;
      const r = t.russian_count || 0;
      const cx = scaleX(w);
      const cy = scaleY(r);
      const rad = 4 + Math.min(t.total_events || 1, 20) * 0.5;
      const color = colors[t.severity] || '#4a5a6a';
      svg += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="1">
        <title>${t.name || t.topic}: r=${r} w=${w} (${t.severity})</title>
      </circle>`;
    });

    svg += `</svg>`;
    el.innerHTML = svg;
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountNarrativeScatter());
} else {
  mountNarrativeScatter();
}
