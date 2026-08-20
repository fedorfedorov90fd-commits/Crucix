// ============================================================
// УПРАВЛЕНИЕ СЛОЯМИ — ПРОСТЕЙШЕЕ РЕШЕНИЕ
// ============================================================

// При загрузке страницы проверяем параметр layer
function getLayerFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('layer') || 'all';
}

// Переключение слоя через перезагрузку
function switchLayer(layer) {
  const url = new URL(window.location.href);
  url.searchParams.set('layer', layer);
  window.location.href = url.toString();
}

// Загружаем кнопки
function loadLayerButtons() {
  const container = document.getElementById('layer-controls');
  if (!container) return;
  
  const currentLayer = getLayerFromURL();
  
  const layers = {
    'all': { name: 'Все', icon: '🌍', color: '#44ccff' },
    'conflict': { name: 'Конфликты', icon: '⚔️', color: '#ef4444' },
    'protest': { name: 'Протесты', icon: '✊', color: '#f97316' },
    'economy': { name: 'Экономика', icon: '💰', color: '#eab308' },
    'military': { name: 'Военные', icon: '🎯', color: '#f59e0b' },
    'disaster': { name: 'Природа', icon: '🌋', color: '#22c55e' },
    'cyber': { name: 'Кибер', icon: '💻', color: '#3b82f6' },
    'diplomacy': { name: 'Дипломатия', icon: '🤝', color: '#a78bfa' }
  };
  
  let html = '<span class="topbar-bottom-label">🎯 Слои:</span>';
  
  for (const [key, layer] of Object.entries(layers)) {
    const isActive = (currentLayer === key);
    html += `
      <button class="layer-btn ${isActive ? 'active' : ''}" 
              style="color:${layer.color};border-color:${layer.color}40;"
              onclick="switchLayer('${key}')">
        ${layer.icon} ${layer.name}
      </button>
    `;
  }
  
  container.innerHTML = html;
}

// Экспортируем
window.switchLayer = switchLayer;
window.loadLayerButtons = loadLayerButtons;

// Автозагрузка
document.addEventListener('DOMContentLoaded', loadLayerButtons);

console.log('[Layers] Простейшее управление загружено');
