/**
 * Модуль №6: Сравнительный исторический анализ
 * Клиентский скрипт с профессиональной событийной шкалой
 * Версия: 2.1
 */

let mainChart = null;
let currentData = null;
let eventsData = [];
let predictionsData = [];
let anomalyData = [];

// DOM-элементы
const elements = {
    periodDays: document.getElementById('periodDays'),
    compareBtn: document.getElementById('compareBtn'),
    predictDays: document.getElementById('predictDays'),
    predictBtn: document.getElementById('predictBtn'),
    showEvents: document.getElementById('showEvents'),
    showPredict: document.getElementById('showPredict'),
    showAnomalies: document.getElementById('showAnomalies'),

    currentIndex: document.getElementById('currentIndex'),
    currentDate: document.getElementById('currentDate'),
    avgIndex: document.getElementById('avgIndex'),
    periodInfo: document.getElementById('periodInfo'),
    changeValue: document.getElementById('changeValue'),
    changePercent: document.getElementById('changePercent'),
    totalDays: document.getElementById('totalDays'),
    dateRange: document.getElementById('dateRange'),
    dataCount: document.getElementById('dataCount'),

    currentPeriodVal: document.getElementById('currentPeriodVal'),
    currentPeriodDate: document.getElementById('currentPeriodDate'),
    historicalPeriodVal: document.getElementById('historicalPeriodVal'),
    historicalPeriodDate: document.getElementById('historicalPeriodDate'),
    diffValue: document.getElementById('diffValue'),
    diffPercent: document.getElementById('diffPercent'),

    anomaliesList: document.getElementById('anomaliesList'),
    eventsList: document.getElementById('eventsList'),
    eventsSection: document.getElementById('eventsSection'),

    trendValue: document.getElementById('trendValue'),
    confidenceValue: document.getElementById('confidenceValue'),
    predictList: document.getElementById('predictList'),
    predictDaysLabel: document.getElementById('predictDaysLabel'),

    exportDataBtn: document.getElementById('exportDataBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    copyAllBtn: document.getElementById('copyAllBtn'),
    copyStatus: document.getElementById('copyStatus'),
    coordX: document.getElementById('coordX'),
    coordY: document.getElementById('coordY'),
    coordDate: document.getElementById('coordDate')
};

/**
 * ПОКАЗАТЬ СТАТУС КОПИРОВАНИЯ
 */
function showCopyStatus(message, color = '#4ecdc4') {
    const status = elements.copyStatus;
    status.textContent = message;
    status.style.borderColor = color;
    status.style.color = color;
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 4000);
}

/**
 * ЗАГРУЗИТЬ ДАННЫЕ ИСТОРИИ
 */
async function loadData() {
    try {
        const response = await fetch('/api/analysis/history');
        const data = await response.json();

        if (!data.success || data.history.length === 0) {
            console.warn('Нет данных истории');
            return null;
        }

        currentData = data;
        elements.dataCount.textContent = `Записей: ${data.total}`;
        return data;
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        return null;
    }
}

/**
 * ЗАГРУЗИТЬ СТАТИСТИКУ
 */
async function loadStatistics() {
    try {
        const response = await fetch('/api/analysis/statistics');
        const data = await response.json();

        if (!data.success) return;

        elements.currentIndex.textContent = data.latest?.toFixed(1) || '—';
        elements.currentDate.textContent = data.latestDate || '—';
        elements.totalDays.textContent = data.totalDays || '—';
        elements.dateRange.textContent = `${data.firstDate} — ${data.latestDate}`;

        return data;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

/**
 * ЗАГРУЗИТЬ СРАВНЕНИЕ
 */
async function loadComparison(days) {
    try {
        const response = await fetch(`/api/analysis/compare?days=${days}`);
        const data = await response.json();

        if (!data.success) {
            elements.avgIndex.textContent = '—';
            elements.periodInfo.textContent = 'Нет данных';
            return;
        }

        elements.avgIndex.textContent = data.average?.toFixed(1) || '—';
        elements.periodInfo.textContent = `${data.period} дней (${data.periodStart} — ${data.periodEnd})`;

        const diffVal = data.diff || 0;
        const sign = diffVal > 0 ? '+' : '';
        elements.changeValue.textContent = `${sign}${diffVal.toFixed(1)}`;
        elements.changeValue.className = 'stat-value ' + (diffVal > 0 ? 'positive' : diffVal < 0 ? 'negative' : '');
        elements.changePercent.textContent = `${sign}${data.percent || 0}% | ${data.status || 'стабильно'}`;

        elements.currentPeriodVal.textContent = data.current?.toFixed(1) || '—';
        elements.currentPeriodDate.textContent = data.currentDate || '—';
        elements.historicalPeriodVal.textContent = data.average?.toFixed(1) || '—';
        elements.historicalPeriodDate.textContent = `${data.periodStart} — ${data.periodEnd}`;
        elements.diffValue.textContent = `${sign}${diffVal.toFixed(1)}`;
        elements.diffValue.className = 'compare-value ' + (diffVal > 0 ? 'positive' : diffVal < 0 ? 'negative' : '');
        elements.diffPercent.textContent = `${sign}${data.percent || 0}%`;

        return data;
    } catch (error) {
        console.error('Ошибка загрузки сравнения:', error);
    }
}

/**
 * ЗАГРУЗИТЬ АНОМАЛИИ
 */
async function loadAnomalies() {
    try {
        const response = await fetch('/api/analysis/anomalies?threshold=2');
        const data = await response.json();

        if (!data.success || data.anomalies.length === 0) {
            elements.anomaliesList.innerHTML = '<p class="loading">Аномалий не обнаружено</p>';
            anomalyData = [];
            return;
        }

        anomalyData = data.anomalies;
        let html = '';
        data.anomalies.forEach(a => {
            html += `
                <div class="anomaly-item">
                    <span class="date">${a.date}</span>
                    <span class="value">Индекс: ${a.index.toFixed(1)}</span>
                    <span class="diff">Отклонение: ${a.diff.toFixed(1)}</span>
                </div>
            `;
        });
        elements.anomaliesList.innerHTML = html;

        return data.anomalies;
    } catch (error) {
        console.error('Ошибка загрузки аномалий:', error);
        elements.anomaliesList.innerHTML = '<p class="loading">Ошибка загрузки аномалий</p>';
    }
}

/**
 * ЗАГРУЗИТЬ ПРОГНОЗ
 */
async function loadPredict(days) {
    try {
        const response = await fetch(`/api/analysis/predict?days=${days}`);
        const data = await response.json();

        if (!data.success) {
            elements.trendValue.textContent = '—';
            elements.confidenceValue.textContent = 'Недостаточно данных';
            elements.predictList.innerHTML = '<p class="loading">Недостаточно данных для прогноза</p>';
            return;
        }

        predictionsData = data.predictions || [];

        elements.trendValue.textContent = data.trend || '—';
        elements.confidenceValue.textContent = `Уверенность: ${data.confidence || 0}%`;
        elements.predictDaysLabel.textContent = days;

        if (predictionsData.length > 0) {
            let html = '<div class="predict-list">';
            predictionsData.forEach(p => {
                html += `
                    <div class="predict-item">
                        <span class="date">${p.date}</span>
                        <span class="value">${p.index.toFixed(1)}</span>
                    </div>
                `;
            });
            html += '</div>';
            elements.predictList.innerHTML = html;
        } else {
            elements.predictList.innerHTML = '<p class="loading">Нет прогнозов</p>';
        }

        return data;
    } catch (error) {
        console.error('Ошибка загрузки прогноза:', error);
        elements.trendValue.textContent = 'Ошибка';
    }
}

/**
 * ЗАГРУЗИТЬ СОБЫТИЯ
 */
async function loadEvents() {
    try {
        const response = await fetch('/api/analysis/events');
        const data = await response.json();

        if (!data.success || data.events.length === 0) {
            elements.eventsList.innerHTML = '<p class="loading">Нет значимых событий</p>';
            elements.eventsSection.classList.add('hidden');
            eventsData = [];
            return;
        }

        eventsData = [];

        let html = '';
        data.events.forEach(day => {
            day.events.forEach(e => {
                eventsData.push({
                    date: day.date,
                    title: e.title,
                    type: e.type,
                    correlation: e.correlation,
                    indexValue: e.indexValue
                });
            });

            const typeIcons = {
                military: '🛡️',
                economic: '💰',
                diplomatic: '🤝',
                disaster: '🌋',
                political: '🏛️'
            };

            const typeLabels = {
                military: 'Военные',
                economic: 'Экономика',
                diplomatic: 'Дипломатия',
                disaster: 'Природные',
                political: 'Политика'
            };

            html += `
                <div class="event-group">
                    <div class="event-date">${day.date}</div>
                    <div class="event-items">
            `;

            day.events.forEach(e => {
                const icon = typeIcons[e.type] || '📌';
                const label = typeLabels[e.type] || e.type;
                const color = e.correlation > 0.8 ? '#ff6b6b' : e.correlation > 0.6 ? '#ffe66d' : '#4ecdc4';
                html += `
                    <div class="event-item" style="border-left-color: ${color}">
                        <span class="event-icon">${icon}</span>
                        <span class="event-type">${label}</span>
                        <span class="event-title">${e.title}</span>
                        <span class="event-correlation">корр: ${(e.correlation * 100).toFixed(0)}%</span>
                        <span class="event-impact">индекс: ${e.indexValue.toFixed(1)}</span>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        elements.eventsList.innerHTML = html;
        elements.eventsSection.classList.remove('hidden');

        return data;
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
        elements.eventsList.innerHTML = '<p class="loading">Ошибка загрузки событий</p>';
    }
}

/**
 * СОЗДАТЬ ГРАФИК
 */
function createChart(history) {
    const ctx = document.getElementById('mainChart').getContext('2d');

    if (mainChart) {
        mainChart.destroy();
    }

    if (!history || history.length === 0) {
        return;
    }

    const dates = history.map(d => d.date);
    const values = history.map(d => d.index);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const avgLine = new Array(values.length).fill(avg);
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length);

    const datasets = [
        {
            label: 'Индекс напряжённости',
            data: values,
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: '#ff6b6b',
            tension: 0.4,
            fill: true,
            order: 3
        },
        {
            label: 'Среднее',
            data: avgLine,
            borderColor: '#4ecdc4',
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
            order: 4
        }
    ];

    if (elements.showAnomalies.checked && anomalyData.length > 0) {
        const anomalyPoints = anomalyData.map(a => ({
            x: a.date,
            y: a.index
        }));
        datasets.push({
            label: '⚠️ Аномалии',
            type: 'scatter',
            data: anomalyPoints,
            backgroundColor: '#ffe66d',
            borderColor: '#ffe66d',
            pointRadius: 10,
            pointHoverRadius: 14,
            pointStyle: 'triangle',
            showLine: false,
            order: 0
        });
    }

    if (elements.showPredict.checked && predictionsData.length > 0) {
        const predictValues = predictionsData.map(p => p.index);
        datasets.push({
            label: '🔮 Прогноз',
            data: predictValues,
            borderColor: '#a29bfe',
            backgroundColor: 'rgba(162, 155, 254, 0.1)',
            borderDash: [5, 5],
            pointRadius: 4,
            pointBackgroundColor: '#a29bfe',
            tension: 0.3,
            fill: false,
            order: 2
        });
    }

    if (elements.showEvents.checked && eventsData.length > 0) {
        const eventPoints = eventsData.map(e => ({
            x: e.date,
            y: e.indexValue,
            title: e.title,
            type: e.type,
            correlation: e.correlation
        }));

        const typeColors = {
            military: '#ff6b6b',
            economic: '#4ecdc4',
            diplomatic: '#ffe66d',
            disaster: '#ff9f43',
            political: '#a29bfe'
        };

        const eventColors = eventPoints.map(e => typeColors[e.type] || '#ffffff');

        datasets.push({
            label: '📌 События',
            type: 'scatter',
            data: eventPoints,
            backgroundColor: eventColors,
            borderColor: eventColors,
            pointRadius: 6,
            pointHoverRadius: 12,
            pointStyle: 'rectRot',
            showLine: false,
            order: 1
        });
    }

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === '⚠️ Аномалии') {
                                return `⚠️ Аномалия: ${context.parsed.y.toFixed(1)}`;
                            }
                            if (context.dataset.label === '📌 События') {
                                const raw = context.raw;
                                const typeLabels = {
                                    military: '🛡️ Военные',
                                    economic: '💰 Экономика',
                                    diplomatic: '🤝 Дипломатия',
                                    disaster: '🌋 Природные',
                                    political: '🏛️ Политика'
                                };
                                return `${typeLabels[raw.type] || '📌'}: ${raw.title} (корр: ${(raw.correlation * 100).toFixed(0)}%)`;
                            }
                            if (context.dataset.label === '🔮 Прогноз') {
                                return `🔮 Прогноз: ${context.parsed.y.toFixed(1)}`;
                            }
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255,255,255,0.05)'
                    },
                    ticks: {
                        color: '#667788',
                        maxTicksLimit: 20,
                        maxRotation: 45
                    }
                },
                y: {
                    min: 0,
                    max: 10,
                    grid: {
                        color: 'rgba(255,255,255,0.05)'
                    },
                    ticks: {
                        color: '#667788'
                    }
                }
            }
        },
        plugins: [ChartZoom]
    });

    // КООРДИНАТЫ ПРИ НАВЕДЕНИИ НА ГРАФИК
    ctx.canvas.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        elements.coordX.textContent = Math.round(x);
        elements.coordY.textContent = Math.round(y);

        if (mainChart && mainChart.scales && mainChart.scales.x) {
            const xScale = mainChart.scales.x;
            const pixelPosition = xScale.left + (x / rect.width) * (xScale.right - xScale.left);
            const dateIndex = Math.round((pixelPosition - xScale.left) / (xScale.right - xScale.left) * (mainChart.data.labels.length - 1));
            if (dateIndex >= 0 && dateIndex < mainChart.data.labels.length) {
                elements.coordDate.textContent = mainChart.data.labels[dateIndex] || '—';
            }
        }
    });
}

/**
 * ═══════════════════════════════════════════════════════════
 * КНОПКА КОПИРОВАНИЯ - ЕДИНЫЙ СТАНДАРТ ДЛЯ ВСЕХ СТРАНИЦ
 * ═══════════════════════════════════════════════════════════
 */
function copyAllData() {
    console.log('[Копирование] Начато...');

    if (!currentData) {
        showCopyStatus('❌ Нет данных для копирования', '#ff6b6b');
        return;
    }

    try {
        // Формируем структурированные данные
        const dataForCopy = {
            page: 'Исторический анализ индекса',
            module: 'Модуль №6',
            timestamp: new Date().toISOString(),
            statistics: {
                currentIndex: elements.currentIndex.textContent,
                currentDate: elements.currentDate.textContent,
                averageIndex: elements.avgIndex.textContent,
                periodInfo: elements.periodInfo.textContent,
                change: elements.changeValue.textContent,
                changePercent: elements.changePercent.textContent,
                totalDays: elements.totalDays.textContent,
                dateRange: elements.dateRange.textContent
            },
            comparison: {
                currentPeriod: elements.currentPeriodVal.textContent,
                currentPeriodDate: elements.currentPeriodDate.textContent,
                historicalPeriod: elements.historicalPeriodVal.textContent,
                historicalPeriodDate: elements.historicalPeriodDate.textContent,
                diff: elements.diffValue.textContent,
                diffPercent: elements.diffPercent.textContent
            },
            anomalies: anomalyData.map(a => ({
                date: a.date,
                index: a.index,
                deviation: a.diff
            })),
            predictions: predictionsData.map(p => ({
                date: p.date,
                index: p.index
            })),
            events: eventsData.map(e => ({
                date: e.date,
                title: e.title,
                type: e.type,
                correlation: e.correlation,
                indexValue: e.indexValue
            })),
            history: currentData.history.map(d => ({
                date: d.date,
                index: d.index,
                components: d.components || {}
            }))
        };

        // Формируем текст для копирования
        let text = '============================================================\n';
        text += '📊 СРАВНИТЕЛЬНЫЙ ИСТОРИЧЕСКИЙ АНАЛИЗ — CRUCIX\n';
        text += '============================================================\n';
        text += `📅 Дата экспорта: ${dataForCopy.timestamp}\n`;
        text += `📦 Модуль: ${dataForCopy.module}\n`;
        text += `📊 Всего записей: ${dataForCopy.history.length}\n`;
        text += '\n--- СТАТИСТИКА ---\n';
        text += `📊 Текущий индекс: ${dataForCopy.statistics.currentIndex}\n`;
        text += `📅 Дата: ${dataForCopy.statistics.currentDate}\n`;
        text += `📈 Средний за период: ${dataForCopy.statistics.averageIndex}\n`;
        text += `📉 Изменение: ${dataForCopy.statistics.change} (${dataForCopy.statistics.changePercent})\n`;
        text += `📅 Всего дней: ${dataForCopy.statistics.totalDays} (${dataForCopy.statistics.dateRange})\n`;
        text += '\n--- СРАВНИТЕЛЬНЫЙ АНАЛИЗ ---\n';
        text += `Текущий период: ${dataForCopy.comparison.currentPeriod} (${dataForCopy.comparison.currentPeriodDate})\n`;
        text += `Исторический период: ${dataForCopy.comparison.historicalPeriod} (${dataForCopy.comparison.historicalPeriodDate})\n`;
        text += `Разница: ${dataForCopy.comparison.diff} (${dataForCopy.comparison.diffPercent})\n`;

        if (dataForCopy.anomalies.length > 0) {
            text += '\n--- АНОМАЛИИ ---\n';
            dataForCopy.anomalies.forEach(a => {
                text += `  ${a.date}: Индекс ${a.index.toFixed(1)} (отклонение ${a.deviation.toFixed(1)})\n`;
            });
        }

        if (dataForCopy.predictions.length > 0) {
            text += '\n--- ПРОГНОЗ ---\n';
            dataForCopy.predictions.forEach(p => {
                text += `  ${p.date}: ${p.index.toFixed(1)}\n`;
            });
        }

        if (dataForCopy.events.length > 0) {
            text += '\n--- СОБЫТИЯ (корреляция) ---\n';
            const typeLabels = {
                military: '🛡️',
                economic: '💰',
                diplomatic: '🤝',
                disaster: '🌋',
                political: '🏛️'
            };
            dataForCopy.events.forEach(e => {
                const icon = typeLabels[e.type] || '📌';
                text += `  ${e.date} ${icon} ${e.title} (корр: ${(e.correlation * 100).toFixed(0)}%, индекс: ${e.indexValue.toFixed(1)})\n`;
            });
        }

        text += '\n--- ИСТОРИЯ ИНДЕКСА ---\n';
        dataForCopy.history.forEach(d => {
            text += `  ${d.date}: ${d.index.toFixed(1)}`;
            if (d.components) {
                text += ` (компоненты: ${d.components.news?.toFixed(1) || '—'}`;
                text += `, ${d.components.thermal?.toFixed(1) || '—'}`;
                text += `, ${d.components.aviation?.toFixed(1) || '—'}`;
                text += `, ${d.components.geopolitics?.toFixed(1) || '—'}`;
                text += `, ${d.components.economy?.toFixed(1) || '—'})`;
            }
            text += '\n';
        });

        text += '\n============================================================\n';
        text += '📋 Данные скопированы из Crucix — Historical Analysis\n';
        text += '============================================================\n';

        // Копируем в буфер обмена
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log('[Копирование] Успешно!');
                showCopyStatus('✅ Все данные скопированы в буфер обмена!', '#4ecdc4');
            }).catch((err) => {
                console.error('[Копирование] Ошибка clipboard API:', err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }

    } catch (error) {
        console.error('[Копирование] Ошибка:', error);
        showCopyStatus('❌ Ошибка при копировании данных', '#ff6b6b');
    }
}

/**
 * РЕЗЕРВНЫЙ СПОСОБ КОПИРОВАНИЯ (для старых браузеров)
 */
function fallbackCopy(text) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        console.log('[Копирование] Успешно (fallback)!');
        showCopyStatus('✅ Все данные скопированы в буфер обмена!', '#4ecdc4');
    } catch (err) {
        console.error('[Копирование] Ошибка fallback:', err);
        showCopyStatus('❌ Ошибка при копировании. Попробуйте Ctrl+C', '#ff6b6b');
    }
}

/**
 * ОБНОВИТЬ ВСЕ ДАННЫЕ
 */
async function refreshAll() {
    const data = await loadData();
    if (!data) return;

    await loadStatistics();
    const days = parseInt(elements.periodDays.value) || 30;
    await loadComparison(days);
    await loadAnomalies();
    const predictDays = parseInt(elements.predictDays.value) || 7;
    await loadPredict(predictDays);
    await loadEvents();

    createChart(data.history);
}

/**
 * ЭКСПОРТ ДАННЫХ
 */
function exportData() {
    if (!currentData) return;

    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historical-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportCSV() {
    if (!currentData || !currentData.history) return;

    const headers = ['date', 'index', 'news', 'thermal', 'aviation', 'geopolitics', 'economy'];
    const rows = currentData.history.map(d => [
        d.date,
        d.index.toFixed(2),
        d.components?.news?.toFixed(2) || '',
        d.components?.thermal?.toFixed(2) || '',
        d.components?.aviation?.toFixed(2) || '',
        d.components?.geopolitics?.toFixed(2) || '',
        d.components?.economy?.toFixed(2) || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historical-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// СОБЫТИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Модуль №6: Исторический анализ загружен');

    await refreshAll();

    // КНОПКА КОПИРОВАНИЯ - ГЛАВНЫЙ ОБРАБОТЧИК
    if (elements.copyAllBtn) {
        elements.copyAllBtn.addEventListener('click', copyAllData);
        console.log('[Копирование] Кнопка привязана ✅');
    } else {
        console.error('[Копирование] Кнопка не найдена!');
    }

    // Кнопка сравнения
    elements.compareBtn.addEventListener('click', async () => {
        const days = parseInt(elements.periodDays.value) || 30;
        await loadComparison(days);
        if (currentData) createChart(currentData.history);
    });

    // Кнопка прогноза
    elements.predictBtn.addEventListener('click', async () => {
        const days = parseInt(elements.predictDays.value) || 7;
        await loadPredict(days);
        if (currentData) createChart(currentData.history);
    });

    // Чекбоксы
    elements.showEvents.addEventListener('change', () => {
        if (currentData) createChart(currentData.history);
    });
    elements.showPredict.addEventListener('change', () => {
        if (currentData) createChart(currentData.history);
    });
    elements.showAnomalies.addEventListener('change', () => {
        if (currentData) createChart(currentData.history);
    });

    // Экспорт
    elements.exportDataBtn.addEventListener('click', exportData);
    elements.exportCsvBtn.addEventListener('click', exportCSV);
});

// ============================================================
// КООРДИНАТНАЯ СЕТКА (Ctrl+Shift+G)
// ============================================================

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'г')) {
        e.preventDefault();
        const grid = document.getElementById('gridOverlay');
        if (grid) {
            grid.classList.toggle('active');
            console.log('[Сетка] ' + (grid.classList.contains('active') ? 'Включена' : 'Выключена'));
        }
    }
});

console.log('📐 Координатная сетка: Ctrl+Shift+G');

// Автообновление каждые 5 минут
setInterval(refreshAll, 5 * 60 * 1000);

console.log('📌 Профессиональная событийная шкала активна');
console.log('📋 Кнопка копирования: единый стандарт');
