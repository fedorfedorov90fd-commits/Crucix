// widgets/source-matrix.js — матрица источников
export async function mountSourceMatrix(containerId = 'source-matrix') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/taxonomy-gaps/topics?limit=20');
    const data = await res.json();
    const rows = (data.topics || []).map(t => ({
      name: t.name || t.topic,
      type: t.topic_type || 'unknown',
      russian: t.russian_count || 0,
      western: t.western_count || 0,
      neutral: t.neutral_count || 0,
      total: t.total_events || 0,
      ratio: t.ratio || 0,
      severity: t.severity || 'normal',
    }));

    if (rows.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет данных</span>';
      return;
    }

    const header = `<tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:#8899aa;font-size:11px;text-transform:uppercase;">
      <th style="padding:8px;text-align:left;">Тема</th>
      <th style="padding:8px;text-align:right;">RU</th>
      <th style="padding:8px;text-align:right;">WEST</th>
      <th style="padding:8px;text-align:right;">Ratio</th>
      <th style="padding:8px;text-align:right;">Total</th>
      <th style="padding:8px;text-align:center;">Severity</th>
    </tr>`;

    const body = rows.map(r => {
      const sevColor = r.severity === 'high' ? '#ef4444' : r.severity === 'normal' ? '#4ade80' : '#8899aa';
      const ratioColor = r.ratio > 10 ? '#ef4444' : r.ratio > 5 ? '#f59e0b' : '#4ade80';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);font-size:12px;">
        <td style="padding:8px;color:#e0e0e0;">${r.name}</td>
        <td style="padding:8px;text-align:right;color:#5bc0f8;">${r.russian}</td>
        <td style="padding:8px;text-align:right;color:#f59e0b;">${r.western}</td>
        <td style="padding:8px;text-align:right;color:${ratioColor};font-weight:700;">${r.ratio || '—'}</td>
        <td style="padding:8px;text-align:right;color:#e0e0e0;">${r.total}</td>
        <td style="padding:8px;text-align:center;color:${sevColor};">${r.severity}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `<table style="width:100%;border-collapse:collapse;">${header}${body}</table>`;
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;overflow-x:auto;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountSourceMatrix());
} else {
  mountSourceMatrix();
}
