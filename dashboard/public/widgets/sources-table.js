// widgets/sources-table.js — таблица источников из /api/layers/sources
export async function mountSourcesTable(containerId = 'sources-table') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/sources?limit=30');
    const data = await res.json();
    const sources = data.sources || [];

    if (sources.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет источников</span>';
      return;
    }

    const groupColor = { russian: '#3b82f6', western: '#ef4444', neutral: '#10b981' };

    const header = `<tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:#8899aa;font-size:11px;text-transform:uppercase;">
      <th style="padding:6px 8px;text-align:left;">Источник</th>
      <th style="padding:6px 8px;text-align:center;">Группа</th>
      <th style="padding:6px 8px;text-align:right;">Статей</th>
      <th style="padding:6px 8px;text-align:right;">Last seen</th>
    </tr>`;

    const body = sources.map(s => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.03);font-size:11px;">
        <td style="padding:6px 8px;color:#e0e0e0;">${s.source}</td>
        <td style="padding:6px 8px;text-align:center;">
          <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;background:${groupColor[s.group] || '#4a5a6a'};color:#fff;">${s.group}</span>
        </td>
        <td style="padding:6px 8px;text-align:right;color:#fbbf24;font-weight:600;">${s.count}</td>
        <td style="padding:6px 8px;text-align:right;color:#4a5a6a;font-size:10px;">${s.last_seen ? new Date(s.last_seen).toLocaleString('ru-RU') : '—'}</td>
      </tr>
    `).join('');

    el.innerHTML = `<table style="width:100%;border-collapse:collapse;">${header}${body}</table>`;
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;max-height:500px;overflow-y:auto;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountSourcesTable());
} else {
  mountSourcesTable();
}
