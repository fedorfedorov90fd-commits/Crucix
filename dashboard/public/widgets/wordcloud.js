// widgets/wordcloud.js — облако тегов из taxonomy-gaps + narrative-framing
// Простой SVG word cloud без внешних библиотек.
// Использование: <div id="wordcloud"></div> + <script type="module" src="/widgets/wordcloud.js"></script>

export async function mountWordCloud(containerId = 'wordcloud') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    // Собираем темы из двух источников
    const [gapsRes, framingRes] = await Promise.all([
      fetch('/api/layers/taxonomy-gaps/topics?limit=20'),
      fetch('/api/layers/narrative-framing/topics?limit=20'),
    ]);
    const gaps = await gapsRes.json();
    const framing = await framingRes.json();

    // Объединяем: тема → вес (total_events)
    const weights = new Map();
    for (const t of (gaps.topics || [])) {
      const name = t.name || t.topic;
      weights.set(name, (weights.get(name) || 0) + (t.total_events || 1));
    }
    for (const t of (framing.topics || [])) {
      const name = t.name || t.topic;
      weights.set(name, (weights.get(name) || 0) + (t.russian_count || 0) + (t.western_count || 0));
    }

    if (weights.size === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет данных</span>';
      return;
    }

    const maxWeight = Math.max(...weights.values());
    const minWeight = Math.min(...weights.values());
    const words = [...weights.entries()].map(([word, weight]) => {
      const norm = (weight - minWeight) / (maxWeight - minWeight || 1);
      const fontSize = 12 + norm * 32;  // 12..44px
      const color = weight > maxWeight * 0.6 ? '#ef4444' : weight > maxWeight * 0.3 ? '#f59e0b' : '#5bc0f8';
      return { word, weight, fontSize, color };
    });

    // Простая раскладка: строки с случайным сдвигом
    words.sort((a, b) => b.weight - a.weight);
    const svgWidth = el.clientWidth || 800;
    const svgHeight = 300;
    const lines = [];
    let currentLine = { words: [], width: 0 };
    for (const w of words) {
      const wordWidth = w.word.length * w.fontSize * 0.6;
      if (currentLine.width + wordWidth > svgWidth && currentLine.words.length > 0) {
        lines.push(currentLine);
        currentLine = { words: [], width: 0 };
      }
      currentLine.words.push(w);
      currentLine.width += wordWidth + 10;
    }
    if (currentLine.words.length > 0) lines.push(currentLine);

    let y = 50;
    const elements = [];
    for (const line of lines) {
      let x = (svgWidth - line.width) / 2;
      for (const w of line.words) {
        const jitter = (Math.random() - 0.5) * 10;
        elements.push(`<text x="${x}" y="${y + jitter}" font-size="${w.fontSize}" fill="${w.color}" font-weight="700" font-family="system-ui">${w.word}</text>`);
        x += w.word.length * w.fontSize * 0.6 + 10;
      }
      y += 50;
    }

    el.innerHTML = `<svg width="100%" height="${Math.max(svgHeight, y + 40)}" viewBox="0 0 ${svgWidth} ${Math.max(svgHeight, y + 40)}">${elements.join('')}</svg>`;
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;min-height:200px;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountWordCloud());
} else {
  mountWordCloud();
}
