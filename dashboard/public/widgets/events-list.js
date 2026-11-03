// widgets/events-list.js — список событий из /api/layers/events
export async function mountEventsList(containerId = 'events-list') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/events?limit=30');
    const data = await res.json();
    const events = data.events || [];

    if (events.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет событий</span>';
      return;
    }

    const severityColor = { high: '#ef4444', normal: '#4ade80', critical: '#f59e0b' };
    const gapLabel = {
      western_silence: 'Запад молчит',
      russian_silence: 'РФ молчит',
      western_undercovered: 'Запад недопокрывает',
      russian_undercovered: 'РФ недопокрывает',
    };

    el.innerHTML = events.map(e => `
      <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <span style="display:inline-block;padding:1px 8px;border-radius:3px;font-size:10px;font-weight:600;background:${severityColor[e.severity] || '#4a5a6a'};color:#fff;">${e.severity}</span>
          <span style="font-size:11px;color:#8899aa;">${e.topic_type || '—'}</span>
          <span style="font-size:11px;color:#fbbf24;margin-left:auto;">${e.articles_count} статей</span>
        </div>
        <div style="font-size:13px;color:#e0e0e0;font-weight:600;margin-bottom:4px;">${e.name || e.topic}</div>
        <div style="font-size:11px;color:#8899aa;margin-bottom:4px;">
          RU: ${e.russian_count} | WEST: ${e.western_count} | NEUTRAL: ${e.neutral_count}
          ${e.gap_type ? `| <span style="color:#f59e0b;">${gapLabel[e.gap_type] || e.gap_type}</span>` : ''}
        </div>
        ${e.sample_titles && e.sample_titles[0] ? `<div style="font-size:10px;color:#4a5a6a;font-style:italic;">"${e.sample_titles[0]}"</div>` : ''}
      </div>
    `).join('');
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;max-height:600px;overflow-y:auto;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountEventsList());
} else {
  mountEventsList();
}
