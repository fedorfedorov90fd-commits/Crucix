// Кросс-корреляционный анализатор — Crucix

class CorrelationAnalyzer {
  constructor() {
    this.chart1 = null;
    this.chart2 = null;
    this.currentData = null;
    
    this.init();
  }
  
  init() {
    document.getElementById('calculate-btn').addEventListener('click', () => this.calculate());
    document.getElementById('copy-btn').addEventListener('click', () => this.copyData());
    document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
    document.getElementById('export-csv').addEventListener('click', () => this.exportCSV());
    
    // Enter для расчёта
    document.getElementById('days').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.calculate();
    });
    
    // Автоматический расчёт при загрузке
    this.calculate();
    
    // Поиск аномалий
    this.findAnomalies();
  }
  
  async calculate() {
    const source1 = document.getElementById('source1').value;
    const source2 = document.getElementById('source2').value;
    const days = parseInt(document.getElementById('days').value) || 30;
    
    document.getElementById('correlation-value').textContent = '⏳';
    document.getElementById('correlation-interp').textContent = 'Расчёт...';
    
    try {
      const url = `/api/correlation/calculate?source1=${source1}&source2=${source2}&days=${days}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Ошибка расчёта');
      }
      
      this.currentData = data;
      this.displayResults(data);
      this.renderCharts(data);
      
    } catch (e) {
      console.error('[Correlation] Ошибка:', e);
      document.getElementById('correlation-value').textContent = '❌';
      document.getElementById('correlation-interp').textContent = e.message;
    }
  }
  
  displayResults(data) {
    const corr = data.correlation || 0;
    const corrElem = document.getElementById('correlation-value');
    const interpElem = document.getElementById('correlation-interp');
    
    corrElem.textContent = corr.toFixed(3);
    corrElem.className = 'stat-value';
    
    if (Math.abs(corr) >= 0.8) corrElem.classList.add('strong');
    else if (corr > 0) corrElem.classList.add('positive');
    else if (corr < 0) corrElem.classList.add('negative');
    
    interpElem.textContent = data.interpretation || 'Нет данных';
    
    // Задержка
    document.getElementById('lag-value').textContent = data.optimalLag !== undefined ? data.optimalLag : '—';
    document.getElementById('lag-interp').textContent = data.optimalLag !== undefined ? 
      `${data.optimalCorrelation ? data.optimalCorrelation.toFixed(3) : ''}` : 'дней';
    
    // Точки
    document.getElementById('points-value').textContent = data.days || '—';
    document.getElementById('days-value').textContent = data.days ? `дней` : '';
  }
  
  renderCharts(data) {
    if (!data.dates || data.dates.length < 2) return;
    
    // --- График 1: Два временных ряда ---
    const ctx1 = document.getElementById('correlation-chart').getContext('2d');
    
    if (this.chart1) this.chart1.destroy();
    
    this.chart1 = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: data.dates,
        datasets: [
          {
            label: data.source1,
            data: data.values1,
            borderColor: '#2196f3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: data.source2,
            data: data.values2,
            borderColor: '#ff9800',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e0e0e0' } }
        },
        scales: {
          x: { 
            ticks: { color: '#888', maxTicksLimit: 15 },
            grid: { color: 'rgba(255,255,255,0.03)' }
          },
          y: { 
            ticks: { color: '#888' },
            grid: { color: 'rgba(255,255,255,0.03)' }
          }
        }
      }
    });
    
    // --- График 2: Корреляция по задержкам ---
    if (data.allLags && data.allLags.length > 0) {
      const ctx2 = document.getElementById('lag-chart').getContext('2d');
      
      if (this.chart2) this.chart2.destroy();
      
      const labels = data.allLags.map(d => `+${d.lag}`);
      const values = data.allLags.map(d => d.correlation);
      
      this.chart2 = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Корреляция',
            data: values,
            backgroundColor: values.map(v => 
              Math.abs(v) >= 0.7 ? 'rgba(255, 152, 0, 0.8)' :
              v > 0 ? 'rgba(76, 175, 80, 0.6)' : 'rgba(244, 67, 54, 0.6)'
            ),
            borderColor: values.map(v =>
              Math.abs(v) >= 0.7 ? '#ff9800' :
              v > 0 ? '#4caf50' : '#f44336'
            ),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: '#888', maxTicksLimit: 15 } },
            y: { 
              ticks: { color: '#888' },
              grid: { color: 'rgba(255,255,255,0.03)' }
            }
          }
        }
      });
    }
  }
  
  async findAnomalies() {
    try {
      const response = await fetch('/api/correlation/anomalies?threshold=0.7&days=30');
      const data = await response.json();
      
      const list = document.getElementById('anomalies-list');
      
      if (!data.success || data.anomalies.length === 0) {
        list.innerHTML = '<div style="color:#666;font-size:13px;">Сильных корреляций не обнаружено</div>';
        return;
      }
      
      let html = '';
      for (const a of data.anomalies) {
        html += `
          <div class="anomaly-item">
            <span>${a.source1} ↔ ${a.source2}</span>
            <span class="strong">${a.correlation.toFixed(3)}</span>
            <span style="color:#888;">${a.interpretation}</span>
          </div>
        `;
      }
      list.innerHTML = html;
      
    } catch (e) {
      console.error('[Correlation] Ошибка поиска аномалий:', e);
    }
  }
  
  copyData() {
    if (!this.currentData) {
      alert('Сначала выполните расчёт');
      return;
    }
    
    const d = this.currentData;
    const text = `
--- КРОСС-КОРРЕЛЯЦИОННЫЙ АНАЛИЗ ---
Источник 1: ${d.source1}
Источник 2: ${d.source2}
Дней: ${d.days}
Корреляция: ${d.correlation.toFixed(3)}
Интерпретация: ${d.interpretation}
Оптимальная задержка: ${d.optimalLag} дн. (${d.optimalCorrelation.toFixed(3)})

Даты: ${d.dates.join(', ')}
Значения 1: ${d.values1.join(', ')}
Значения 2: ${d.values2.join(', ')}
    `.trim();
    
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Данные скопированы в буфер обмена');
    }).catch(() => {
      // fallback
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      alert('✅ Данные скопированы в буфер обмена');
    });
  }
  
  exportJSON() {
    if (!this.currentData) return;
    const blob = new Blob([JSON.stringify(this.currentData, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, 'correlation_data.json');
  }
  
  exportCSV() {
    if (!this.currentData) return;
    const d = this.currentData;
    let csv = 'Дата,Источник1,Источник2\n';
    for (let i = 0; i < d.dates.length; i++) {
      csv += `${d.dates[i]},${d.values1[i]},${d.values2[i]}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    this.downloadBlob(blob, 'correlation_data.csv');
  }
  
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
  window.correlation = new CorrelationAnalyzer();
});