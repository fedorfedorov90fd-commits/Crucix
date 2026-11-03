// widgets/comparative-view.js — Source A vs Source B + heatmap
// Выбор двух источников → сравнение тональности и пересечения тем
export async function mountComparativeView(containerId = 'comparative-view') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/sources');
    const data = await res.json();
    const sources = data.sources || [];

    if (sources.length < 2) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нужно минимум 2 источника</span>';
      return;
    }

    // Selector для двух источников
    const options = sources.map(s => `<option value="${s.source}">${s.source} (${s.count})</option>`).join('');

    el.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
        <label style="font-size:12px;color:#8899aa;">Source A:</label>
        <select id="cmp-a" style="background:#0a0a1a;color:#e0e0e0;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 8px;font-size:12px;">
          ${options}
        </select>
        <label style="font-size:12px;color:#8899aa;">Source B:</label>
        <select id="cmp-b" style="background:#0a0a1a;color:#e0e0e0;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 8px;font-size:12px;">
          ${options}
        </select>
        <button id="cmp-run" style="background:#5bc0f8;color:#0a0a1a;border:none;border-radius:4px;padding:4px 16px;font-size:12px;font-weight:600;cursor:pointer;">Сравнить</button>
      </div>
      <div id="cmp-result" style="min-height:200px;"></div>
    `;
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;';

    // Выбираем разные источники по умолчанию
    if (sources.length >= 2) {
      document.getElementById('cmp-a').value = sources[0].source;
      document.getElementById('cmp-b').value = sources[1].source;
    }

    async function runComparison() {
      const a = document.getElementById('cmp-a').value;
      const b = document.getElementById('cmp-b').value;
      const resultEl = document.getElementById('cmp-result');
      resultEl.innerHTML = '<span style="color:#8899aa;">Загрузка...</span>';

      try {
        const [aRes, bRes] = await Promise.all([
          fetch(`/api/layers/articles?source=${encodeURIComponent(a)}&limit=200`),
          fetch(`/api/layers/articles?source=${encodeURIComponent(b)}&limit=200`),
        ]);
        const aData = await aRes.json();
        const bData = await bRes.json();
        const aItems = aData.items || [];
        const bItems = bData.items || [];

        // Пересечение слов в заголовках
        const wordsA = new Set(aItems.flatMap(it => (it.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4)));
        const wordsB = new Set(bItems.flatMap(it => (it.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4)));
        const common = [...wordsA].filter(w => wordsB.has(w));
        const jaccard = (wordsA.size + wordsB.size - common.length) > 0
          ? common.length / (wordsA.size + wordsB.size - common.length)
          : 0;

        // Топ-10 общих слов
        const topCommon = common.slice(0, 10);

        resultEl.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:8px;padding:12px;">
              <div style="font-size:12px;color:#3b82f6;font-weight:600;margin-bottom:4px;">Source A: ${a}</div>
              <div style="font-size:20px;color:#e0e0e0;font-weight:700;">${aItems.length} статей</div>
            </div>
            <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;">
              <div style="font-size:12px;color:#ef4444;font-weight:600;margin-bottom:4px;">Source B: ${b}</div>
              <div style="font-size:20px;color:#e0e0e0;font-weight:700;">${bItems.length} статей</div>
            </div>
          </div>

          <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:12px;margin-bottom:16px;">
            <div style="font-size:12px;color:#fbbf24;font-weight:600;margin-bottom:4px;">Согласованность (Jaccard)</div>
            <div style="font-size:20px;color:#e0e0e0;font-weight:700;">${(jaccard * 100).toFixed(1)}%</div>
            <div style="font-size:10px;color:#8899aa;margin-top:4px;">Пересечение слов в заголовках. 0% = ничего общего, 100% = идентичны.</div>
          </div>

          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:12px;">
            <div style="font-size:12px;color:#8899aa;font-weight:600;margin-bottom:8px;">Общие темы (${common.length} слов)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${topCommon.map(w => `<span style="background:rgba(91,192,248,0.2);color:#5bc0f8;padding:2px 8px;border-radius:3px;font-size:11px;">${w}</span>`).join('')}
              ${common.length > 10 ? `<span style="color:#4a5a6a;font-size:11px;">+${common.length - 10} ещё</span>` : ''}
            </div>
          </div>
        `;
      } catch (e) {
        resultEl.innerHTML = `<span style="color:#ef4444;">Ошибка: ${e.message}</span>`;
      }
    }

    document.getElementById('cmp-run').addEventListener('click', runComparison);
    runComparison(); // автозапуск
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountComparativeView());
} else {
  mountComparativeView();
}
