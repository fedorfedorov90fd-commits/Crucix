// widgets/coordination-heatmap.js — heatmap согласованности источников
export async function mountCoordinationHeatmap(containerId = 'coordination-heatmap') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const [sourcesRes, articlesRes] = await Promise.all([
      fetch('/api/layers/sources'),
      fetch('/api/layers/articles?limit=500'),
    ]);
    const sourcesData = await sourcesRes.json();
    const articlesData = await articlesRes.json();
    const sources = sourcesData.sources || [];
    const articles = articlesData.items || [];

    if (sources.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет источников</span>';
      return;
    }

    // Строим матрицу: source × source → пересечение (общие слова в заголовках)
    const bySource = {};
    for (const s of sources) bySource[s.source] = [];
    for (const a of articles) {
      if (!bySource[a.source]) bySource[a.source] = [];
      bySource[a.source].push(a.title.toLowerCase().split(/\s+/).filter(w => w.length > 4));
    }

    const sourcesList = sources.map(s => s.source);
    const matrix = [];
    for (const srcA of sourcesList) {
      const row = [];
      const wordsA = new Set(bySource[srcA]?.flat() || []);
      for (const srcB of sourcesList) {
        if (srcA === srcB) { row.push(null); continue; }
        const wordsB = new Set(bySource[srcB]?.flat() || []);
        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const union = wordsA.size + wordsB.size - intersection;
        row.push(union > 0 ? intersection / union : 0);
      }
      matrix.push(row);
    }

    // SVG heatmap
    const cellSize = 40;
    const width = sourcesList.length * cellSize + 120;
    const height = sourcesList.length * cellSize + 60;
    let svg = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:${width}px;background:#0d0d1a;border-radius:8px;">`;

    // Y labels
    sourcesList.forEach((s, i) => {
      svg += `<text x="110" y="${30 + i * cellSize + cellSize / 2 + 4}" fill="#8899aa" font-size="10" text-anchor="end">${s.slice(0, 14)}</text>`;
    });
    // X labels (rotated)
    sourcesList.forEach((s, i) => {
      svg += `<text x="${120 + i * cellSize + cellSize / 2}" y="25" fill="#8899aa" font-size="10" text-anchor="start" transform="rotate(-45 ${120 + i * cellSize + cellSize / 2} 25)">${s.slice(0, 14)}</text>`;
    });

    // Cells
    matrix.forEach((row, i) => {
      row.forEach((val, j) => {
        if (val === null) {
          svg += `<rect x="${120 + j * cellSize}" y="${30 + i * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0a0a1a" stroke="#1a1a2e" stroke-width="1"/>`;
          return;
        }
        const intensity = Math.min(1, val * 3);
        const r = Math.round(91 + intensity * 148);
        const g = Math.round(192 - intensity * 140);
        const b = Math.round(248 - intensity * 220);
        svg += `<rect x="${120 + j * cellSize}" y="${30 + i * cellSize}" width="${cellSize}" height="${cellSize}" fill="rgb(${r},${g},${b})" fill-opacity="0.8" stroke="#1a1a2e" stroke-width="1">
          <title>${sourcesList[i]} × ${sourcesList[j]}: ${(val * 100).toFixed(1)}%</title>
        </rect>`;
      });
    });

    svg += `</svg>`;
    el.innerHTML = svg + '<div style="font-size:10px;color:#8899aa;margin-top:8px;">Пересечение слов в заголовках (Jaccard). Красное = высокая согласованность.</div>';
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;overflow-x:auto;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountCoordinationHeatmap());
} else {
  mountCoordinationHeatmap();
}
