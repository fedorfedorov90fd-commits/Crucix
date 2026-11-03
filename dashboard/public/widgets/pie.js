// widgets/pie.js — круговая диаграмма распределения по типам
export async function mountPie(containerId = 'pie') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const [gapsRes, framingRes] = await Promise.all([
      fetch('/api/layers/taxonomy-gaps/stats'),
      fetch('/api/layers/narrative-framing/stats'),
    ]);
    const gaps = await gapsRes.json();
    const framing = await framingRes.json();

    const byType = gaps.stats?.by_topic_type || {};
    const byGap = framing.stats?.by_gap_type || {};

    const COLORS = ['#5bc0f8', '#f59e0b', '#ef4444', '#4ade80', '#a78bfa', '#f472b6'];
    const labels = Object.keys(byType);
    const values = Object.values(byType);
    const total = values.reduce((a, b) => a + b, 0) || 1;

    const size = 200;
    const cx = size / 2, cy = size / 2, r = 80;
    let startAngle = -Math.PI / 2;
    const slices = [];
    const legend = [];

    for (let i = 0; i < labels.length; i++) {
      const value = values[i];
      const angle = (value / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      slices.push(`<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${COLORS[i % COLORS.length]}" opacity="0.85"/>`);
      legend.push(`<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:12px;"><span style="width:12px;height:12px;background:${COLORS[i % COLORS.length]};border-radius:2px;"></span><span style="color:#e0e0e0;">${labels[i]}: ${value}</span></div>`);
      startAngle = endAngle;
    }

    el.innerHTML = `
      <div style="display:flex;gap:24px;align-items:center;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${slices.join('')}</svg>
        <div style="flex:1;">
          <div style="font-size:11px;color:#8899aa;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Типы тем</div>
          ${legend.join('')}
          <div style="font-size:11px;color:#8899aa;margin-top:12px;text-transform:uppercase;letter-spacing:1px;">Типы gaps</div>
          ${Object.entries(byGap).map(([k, v], i) => `<div style="font-size:12px;color:#e0e0e0;margin:4px 0;"><span style="display:inline-block;width:12px;height:12px;background:${COLORS[(i+3) % COLORS.length]};border-radius:2px;margin-right:8px;vertical-align:middle;"></span>${k}: ${v}</div>`).join('')}
        </div>
      </div>
    `;
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountPie());
} else {
  mountPie();
}
