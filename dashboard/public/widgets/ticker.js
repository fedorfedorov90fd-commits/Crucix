// widgets/ticker.js — бегущая строка для критических алертов
// Читает /api/layers/alerts/ticker, крутит по кругу.
// Использование: <div id="ticker"></div> + <script type="module" src="/widgets/ticker.js"></script>

export async function mountTicker(containerId = 'ticker') {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch('/api/layers/alerts/ticker');
    const data = await res.json();
    const alerts = data.alerts || [];

    if (alerts.length === 0) {
      el.innerHTML = '<span style="color:#4a5a6a;padding:8px;">Нет критических алертов</span>';
      return;
    }

    // Собираем HTML для тикера
    const items = alerts.map(a => {
      const icon = a.type === 'silence' ? '🔇' : a.type === 'taxonomy_gap' ? '📊' : '⚖️';
      const url = a.url || '#';
      return `<a href="${url}" style="color:#e0e0e0;text-decoration:none;padding:0 20px;white-space:nowrap;">${icon} ${a.short}</a>`;
    }).join('<span style="color:#4a5a6a;padding:0 8px;">|</span>');

    el.innerHTML = `<div class="ticker-track">${items}${items}</div>`;
    el.style.cssText = 'overflow:hidden;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:6px;height:32px;display:flex;align-items:center;font-size:13px;';

    // CSS-анимация
    const style = document.createElement('style');
    style.textContent = `
      .ticker-track {
        display: inline-block;
        white-space: nowrap;
        animation: ticker-scroll 60s linear infinite;
      }
      @keyframes ticker-scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .ticker-track:hover { animation-play-state: paused; }
    `;
    if (!document.querySelector('style[data-ticker]')) {
      style.setAttribute('data-ticker', '1');
      document.head.appendChild(style);
    }
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountTicker());
} else {
  mountTicker();
}
