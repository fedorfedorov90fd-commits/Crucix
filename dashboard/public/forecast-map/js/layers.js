// ============================================================
// LAYERS.JS — 16 прогнозных слоёв Forecast Map (v3.1)
// ============================================================
// Специализация карты: Position + Color intensity + Transparency
// (Munzner 2014). Третий канал — прозрачность — кодирует confidence.
//
// Каждый слой несёт три параметра:
//   probability (0-100) — вероятность события → цвет, 5 классов
//   confidence  (0-1)   — уверенность модели  → прозрачность
//   horizon_days (30/90/180) — горизонт прогноза → popup
//
// v3.1: renderLayerPanel приведён к классам CSS (layer-grid,
// layer-btn, dot, icon, name, number). Рендерит в #layer-grid.
// ============================================================

console.log('LAYERS.JS загружен (v3.1, 16 прогнозных слоёв)');

const DEMO_LAYERS = [

    // === ПРОГНОЗЫ: СТРАТЕГИЧЕСКИЕ ИНДЕКСЫ (4) ===

    { id: 'ssi', name: 'Стратегический стресс-индекс', color: '#ff4444', icon: 'SSI',
      category: 'forecast', vizType: 'choropleth',
      choroplethConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdYlGn5',
        minLabel: 'Низкий', maxLabel: 'Критический',
        horizon_default: 90
      }
    },
    { id: 'predict', name: 'Прогноз событий', color: '#aa44ff', icon: 'PRD',
      category: 'forecast', vizType: 'choropleth',
      choroplethConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность',
        horizon_default: 30
      }
    },
    { id: 'war-preparation', name: 'Прогноз подготовки к войне', color: '#ff2200', icon: 'WAR',
      category: 'forecast', vizType: 'choropleth',
      choroplethConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdYlGn5',
        minLabel: 'Мирная', maxLabel: 'Критическая',
        horizon_default: 180
      }
    },
    { id: 'crucix-pattern-life', name: 'Прогноз аномального поведения', color: '#4466ff', icon: 'PTL',
      category: 'forecast', vizType: 'choropleth',
      choroplethConfig: { method: 'jenks', breaks: null, palette: 'BuPu5',
        minLabel: 'Стабильно', maxLabel: 'Аномально',
        horizon_default: 30
      }
    },

    // === ПРОГНОЗЫ: АНОМАЛИИ И ГЕОАНОМАЛИИ (2) ===

    { id: 'anomalies', name: 'Прогноз аномалий', color: '#ff00ff', icon: 'ANM',
      category: 'forecast', vizType: 'choropleth',
      choroplethConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'BuPu5',
        minLabel: 'Норма', maxLabel: 'Аномалия',
        horizon_default: 30
      }
    },
    { id: 'crucix-anomalies-geo', name: 'Прогноз геоаномалий', color: '#ff00ff', icon: 'GEO',
      category: 'forecast', vizType: 'choropleth',
      choroplethConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'BuPu5',
        minLabel: 'Норма', maxLabel: 'Аномалия',
        horizon_default: 30
      }
    },

    // === ПРОГНОЗЫ: КИБЕРУГРОЗЫ (6) ===

    { id: 'cyber-attacks-threat', name: 'Прогноз кибератак', color: '#ff0044', icon: 'CYB',
      category: 'forecast', vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность',
        horizon_default: 30
      }
    },
    { id: 'ddos-threat', name: 'Прогноз DDoS-атак', color: '#ff4400', icon: 'DDS',
      category: 'forecast', vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность',
        horizon_default: 30
      }
    },
    { id: 'malware-threat', name: 'Прогноз malware-кампаний', color: '#aa0044', icon: 'MLW',
      category: 'forecast', vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность',
        horizon_default: 30
      }
    },
    { id: 'phishing-threat', name: 'Прогноз фишинга', color: '#ff8800', icon: 'PHS',
      category: 'forecast', vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'YlOrRd5',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность',
        horizon_default: 30
      }
    },
    { id: 'ransomware-threat', name: 'Прогноз ransomware-эпидемий', color: '#dc2626', icon: 'RSW',
      category: 'forecast', vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность',
        horizon_default: 90
      }
    },
    { id: 'cve-threat', name: 'Прогноз эксплуатации CVE', color: '#ff6600', icon: 'CVE',
      category: 'forecast', vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'YlOrRd5',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность',
        horizon_default: 30
      }
    },

    // === ПРОГНОЗЫ: API-МОДУЛИ (4) ===

    { id: 'ai-forecasts-api', route: '/api/layers/ai-forecasts',
      name: 'AI-прогнозы', category: 'forecast', color: '#8b5cf6', icon: 'AIF',
      vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5',
        confidenceKey: 'confidence', horizonKey: 'horizon_days',
        minLabel: 'Низкая вероятность', maxLabel: 'Высокая вероятность'
      }
    },
    { id: 'central-bank-predictor-api', route: '/api/layers/central-bank-predictor',
      name: 'Прогноз решений ЦБ', category: 'forecast', color: '#0891b2', icon: 'CBP',
      vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5',
        confidenceKey: 'confidence', horizonKey: 'horizon_days',
        minLabel: 'Снижение ставки', maxLabel: 'Повышение ставки'
      }
    },
    { id: 'social-briefing-api', route: '/api/layers/social-briefing',
      name: 'Социальный брифинг', category: 'forecast', color: '#f59e0b', icon: 'SBR',
      vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'YlOrRd5',
        confidenceKey: 'confidence', horizonKey: 'horizon_days',
        minLabel: 'Стабильно', maxLabel: 'Высокий риск'
      }
    },
    { id: 'social-briefing-engine-api', route: '/api/layers/social-briefing-engine',
      name: 'Брифинг-движок', category: 'forecast', color: '#f97316', icon: 'SBE',
      vizType: 'probability',
      probabilityConfig: { method: 'manual', breaks: [20, 40, 60, 80], palette: 'YlOrRd5',
        confidenceKey: 'confidence', horizonKey: 'horizon_days',
        minLabel: 'Стабильно', maxLabel: 'Критический риск'
      }
    }
];

window.allLayers = DEMO_LAYERS;

// ============================================================
// РЕНДЕРИНГ ПАНЕЛИ СЛОЁВ (v3.1)
// ============================================================
// Структура HTML соответствует CSS layers-panel.css:
//   .layer-category
//     .layer-category-header (arrow + name + badge)
//     .layer-grid
//       .layer-btn (dot + icon + name + number)
// ============================================================

function renderLayerPanel(layers) {
    const grid = document.getElementById('layer-grid');
    if (!grid) {
        console.warn('[Forecast Map] #layer-grid не найден');
        return;
    }

    const categoryNames = { forecast: 'Прогнозы' };

    // Группировка по категориям
    const categories = {};
    layers.forEach(l => {
        if (!categories[l.category]) categories[l.category] = [];
        categories[l.category].push(l);
    });

    let html = '';
    Object.keys(categories).sort().forEach(cat => {
        const catLayers = categories[cat];

        // Заголовок категории
        html += '<div class="layer-category">';
        html += '<div class="layer-category-header">';
        html += '<span class="arrow open">▼</span>';
        html += '<span>' + (categoryNames[cat] || cat) + '</span>';
        html += '<span class="badge">' + catLayers.length + '</span>';
        html += '</div>';

        // Сетка слоёв
        html += '<div class="layer-grid">';
        catLayers.forEach((l, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const checked = (l.id === 'ssi') ? 'checked' : '';
            html += '<label class="layer-btn" data-layer-id="' + l.id + '" title="' + l.name + '">';
            html += '<span class="dot" style="background:' + (l.color || '#5bc0f8') + ';"></span>';
            html += '<input type="checkbox" id="layer-' + l.id + '" ' + checked + ' onchange="toggleLayer(\'' + l.id + '\')" style="display:none;" />';
            html += '<span class="icon">' + (l.icon || '') + '</span>';
            html += '<span class="name">' + l.name + '</span>';
            html += '<span class="number">' + num + '</span>';
            html += '</label>';
        });
        html += '</div>';
        html += '</div>';
    });

    grid.innerHTML = html;

    // Обновляем счётчики
    const layerCountEl = document.getElementById('layer-count');
    if (layerCountEl) layerCountEl.textContent = layers.length;

    console.log('[Forecast Map] Панель слоёв: ' + layers.length + ' слоёв');
}

function toggleLayer(layerId) {
    const cb = document.getElementById('layer-' + layerId);
    if (!cb) return;

    // Визуальный toggle класса .active на label
    const label = document.querySelector('[data-layer-id="' + layerId + '"]');
    if (label) {
        if (cb.checked) label.classList.add('active');
        else label.classList.remove('active');
    }

    if (cb.checked) {
        if (typeof window.loadLayer === 'function') {
            window.loadLayer(layerId);
        } else {
            console.warn('[Forecast Map] window.loadLayer не найден');
        }
    } else {
        if (typeof window.removeLayer === 'function') {
            window.removeLayer(layerId);
        }
    }
}

window.renderLayerPanel = renderLayerPanel;
window.toggleLayer = toggleLayer;
console.log('LAYERS.JS готов (v3.1, 16 прогнозных слоёв)');
