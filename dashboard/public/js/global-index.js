// Глобальный индекс напряжённости — Crucix
// Версия: 1.0

let chartInstance = null;

// ============================================================
// 1. ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadIndex() {
  try {
    const response = await fetch('/api/geo/index');
    const data = await response.json();

    if (data.success) {
      renderIndex(data);
      renderComponents(data.components);
      renderInterpretation(data);
      if (data.history && data.history.length > 0) {
        renderChart(data.history);
      }
    } else {
      showError(data.error || 'Ошибка загрузки данных');
    }
  } catch (e) {
    console.error('[GlobalIndex] Ошибка:', e);
    showError('Ошибка подключения к серверу');
  }
}

// ============================================================
// 2. ОТОБРАЖЕНИЕ ДАННЫХ
// ============================================================

function renderIndex(data) {
  const numberEl = document.querySelector('.index-number .number');
  const levelBadge = document.querySelector('.level-badge');
  const trendEl = document.getElementById('index-trend');
  const timestampEl = document.getElementById('index-timestamp');

  if (!numberEl) return;

  // Число
  numberEl.textContent = data.index;

  // Цвет числа
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    normal: '#22c55e'
  };
  numberEl.style.color = colors[data.level] || '#e0e0e0';

  // Уровень
  if (levelBadge) {
    const levelLabels = {
      critical: 'КРИТИЧЕСКИЙ',
      high: 'ВЫСОКИЙ',
      medium: 'СРЕДНИЙ',
      normal: 'НОРМАЛЬНЫЙ'
    };
    levelBadge.textContent = levelLabels[data.level] || '--';
    levelBadge.className = 'level-badge ' + data.level;
  }

  // Тренд
  if (trendEl) {
    const trendSymbols = {
      up: '📈 Растёт',
      down: '📉 Падает',
      stable: '➡️ Стабилен'
    };
    trendEl.textContent = trendSymbols[data.trend] || '--';
    trendEl.className = 'trend ' + data.trend;
  }

  // Время
  if (timestampEl) {
    const date = new Date(data.timestamp);
    timestampEl.textContent = 'Обновлено: ' + date.toLocaleString('ru-RU');
  }
}

function renderComponents(components) {
  if (!components) return;

  const names = {
    news: 'comp-news',
    thermal: 'comp-thermal',
    aviation: 'comp-aviation',
    geo: 'comp-geo',
    economy: 'comp-economy'
  };

  const barNames = {
    news: 'bar-news',
    thermal: 'bar-thermal',
    aviation: 'bar-aviation',
    geo: 'bar-geo',
    economy: 'bar-economy'
  };

  for (const [key, value] of Object.entries(components)) {
    const el = document.getElementById(names[key]);
    if (el) el.textContent = value;

    const bar = document.getElementById(barNames[key]);
    if (bar) {
      bar.style.width = Math.min(value, 100) + '%';
      bar.className = 'bar-fill ' + key;
    }
  }
}

function renderInterpretation(data) {
  const el = document.getElementById('interpretation-text');
  if (!el) return;

  const interpretations = {
    critical: 'КРИТИЧЕСКИЙ уровень напряжённости. Множественные конфликты, высокая военная активность, экономическая нестабильность. Рекомендуется повышенная бдительность и мониторинг.',
    high: 'ВЫСОКИЙ уровень напряжённости. Активные конфликты в нескольких регионах, значительная военная активность. Рекомендуется внимательное отслеживание ситуации.',
    medium: 'СРЕДНИЙ уровень напряжённости. Локальные конфликты, умеренная военная активность. Ситуация контролируемая, но требует мониторинга.',
    normal: 'НОРМАЛЬНЫЙ уровень напряжённости. Минимальная военная активность, стабильная экономическая ситуация.'
  };

  const detail = interpretations[data.level] || 'Данные загружаются...';
  el.textContent = detail;
  el.style.color = '#ccc';
}

// ============================================================
// 3. ГРАФИК (Chart.js)
// ============================================================

function renderChart(history) {
  const canvas = document.getElementById('index-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Удаляем старый график
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!history || history.length === 0) {
    return;
  }

  const labels = history.map(h => {
    const date = new Date(h.date);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  });

  const values = history.map(h => h.index);

  // Градиент для фона
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
  gradient.addColorStop(0.5, 'rgba(33, 150, 243, 0.1)');
  gradient.addColorStop(1, 'rgba(33, 150, 243, 0.02)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Индекс напряжённости',
        data: values,
        borderColor: '#2196f3',
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#2196f3',
        pointBorderColor: '#fff',
        pointBorderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Индекс: ' + context.parsed.y;
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#666',
            stepSize: 20
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#666',
            maxTicksLimit: 15
          }
        }
      }
    }
  });
}

// ============================================================
// 4. ОШИБКИ
// ============================================================

function showError(message) {
  const el = document.getElementById('interpretation-text');
  if (!el) return;
  el.textContent = '⚠️ ' + message;
  el.style.color = '#ef4444';
}

// ============================================================
// 5. АВТОЗАГРУЗКА И АВТООБНОВЛЕНИЕ
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadIndex();
  // Обновляем каждые 5 минут
  setInterval(loadIndex, 300000);
});

// ============================================================
// 6. ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ В HTML
// ============================================================

window.loadIndex = loadIndex;
