// widgets/real-chart.js — Plotly bar chart
export async function mountRealChart(containerId = 'real-chart') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/alerts?limit=50');
    const data = await res.json();
    const alerts = data.alerts || [];

    if (alerts.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет алертов для графика</span>';
      return;
    }

    const byType = {};
    for (const a of alerts) {
      byType[a.type] = (byType[a.type] || 0) + 1;
    }

    const types = Object.keys(byType);
    const counts = Object.values(byType);

    if (typeof Plotly !== 'undefined') {
      Plotly.newPlot(el, [{
        x: types,
        y: counts,
        type: 'bar',
        marker: { color: types.map(t => t === 'taxonomy_gap' ? '#5bc0f8' : t === 'narrative_framing' ? '#f59e0b' : '#ef4444') },
      }], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#e0e0e0', size: 11 },
        margin: { l: 40, r: 20, t: 20, b: 40 },
        xaxis: { gridcolor: 'rgba(255,255,255,0.05)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.05)' },
      }, { displayModeBar: false });
      el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;';
    } else {
      const max = Math.max(...counts) || 1;
      const bars = types.map((t, i) => {
        const h = (counts[i] / max) * 150;
        const color = t === 'taxonomy_gap' ? '#5bc0f8' : t === 'narrative_framing' ? '#f59e0b' : '#ef4444';
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="height:${h}px;width:100%;background:${color};border-radius:2px;"></div>
          <div style="font-size:10px;color:#8899aa;white-space:nowrap;">${t}</div>
        </div>`;
      }).join('');
      el.innerHTML = `<div style="display:flex;align-items:flex-end;height:180px;gap:8px;padding:8px 0;">${bars}</div>`;
      el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;';
    }
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountRealChart());
} else {
  mountRealChart();
}
