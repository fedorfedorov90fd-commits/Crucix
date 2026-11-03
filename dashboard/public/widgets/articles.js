// widgets/articles.js — список статей из /api/layers/articles
export async function mountArticles(containerId = 'articles') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/articles?limit=20');
    const data = await res.json();
    const items = data.items || [];

    if (items.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет статей</span>';
      return;
    }

    const groupColor = { russian: '#3b82f6', western: '#ef4444', neutral: '#10b981' };

    el.innerHTML = items.map(a => `
      <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;background:${groupColor[a.group]};color:#fff;">${a.group}</span>
          <span style="font-size:10px;color:#8899aa;">${a.source || '—'}</span>
          <span style="font-size:10px;color:#4a5a6a;margin-left:auto;">${a.published_at ? new Date(a.published_at).toLocaleTimeString('ru-RU') : ''}</span>
        </div>
        <a href="${a.link}" target="_blank" style="color:#e0e0e0;text-decoration:none;font-size:12px;line-height:1.4;">${a.title}</a>
      </div>
    `).join('');
    el.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px;max-height:500px;overflow-y:auto;';
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountArticles());
} else {
  mountArticles();
}
