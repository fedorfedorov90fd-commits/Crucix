// ============================================================
// МОДУЛЬ №23: ЭКСПОРТ ДАННЫХ — КЛИЕНТСКАЯ ЧАСТЬ
// ============================================================

// Переключение выпадающего списка
function toggleExportDropdown() {
    const dd = document.getElementById('exportDropdown');
    if (dd) {
        dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
    }
}

// Закрытие при клике вне
document.addEventListener('click', function(e) {
    const dd = document.getElementById('exportDropdown');
    if (dd && !e.target.closest('.export-wrapper')) {
        dd.style.display = 'none';
    }
});

// Сбор данных со страницы
function collectPageData() {
    const data = {
        title: document.title || 'Crucix Отчёт',
        url: window.location.href,
        time: new Date().toISOString(),
        stats: {},
        cards: {},
        tables: [],
        lists: []
    };
    
    // Собираем статистику
    document.querySelectorAll('.stat-card, .stat-item').forEach((el, i) => {
        const label = el.querySelector('.stat-label, .stat-label-text')?.textContent?.trim() || `Показатель ${i+1}`;
        const value = el.querySelector('.stat-value, .stat-value-text')?.textContent?.trim() || '—';
        const sub = el.querySelector('.stat-sub, .stat-sub-text')?.textContent?.trim() || '';
        data.stats[label] = { value, sub };
    });
    
    // Собираем карточки
    document.querySelectorAll('.panel-card, .card').forEach((el, i) => {
        const header = el.querySelector('.panel-card-header, .card-header')?.textContent?.trim() || `Карточка ${i+1}`;
        const value = el.querySelector('.panel-value, .card-value')?.textContent?.trim() || '—';
        const desc = el.querySelector('.panel-sub, .card-desc')?.textContent?.trim() || '';
        data.cards[header] = { value, desc };
    });
    
    // Собираем таблицы
    document.querySelectorAll('table').forEach(table => {
        const rows = [];
        table.querySelectorAll('tr').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td, th').forEach(td => {
                cells.push(td.textContent?.trim() || '');
            });
            if (cells.length > 0) rows.push(cells);
        });
        if (rows.length > 0) data.tables.push(rows);
    });
    
    // Собираем списки
    document.querySelectorAll('ul, ol').forEach(list => {
        const items = [];
        list.querySelectorAll('li').forEach(li => {
            items.push(li.textContent?.trim() || '');
        });
        if (items.length > 0) data.lists.push(items);
    });
    
    return data;
}

// Экспорт данных
async function exportData(format) {
    const dd = document.getElementById('exportDropdown');
    if (dd) dd.style.display = 'none';
    
    const data = collectPageData();
    
    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                format: format,
                content: data,
                filename: 'crucix_export',
                title: data.title
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crucix_export.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification ? showNotification(`✅ Экспорт в ${format.toUpperCase()} завершён`) : alert(`✅ Экспорт в ${format.toUpperCase()} завершён`);
    } catch (e) {
        console.error('[Export] Ошибка:', e);
        showNotification ? showNotification('❌ Ошибка экспорта') : alert('❌ Ошибка экспорта');
    }
}

// Добавляем стили для кнопки экспорта
const exportStyles = document.createElement('style');
exportStyles.textContent = `
    .btn-export {
        color: #ffd700 !important;
        border-color: rgba(255, 215, 0, 0.2) !important;
        background: rgba(255, 215, 0, 0.06) !important;
    }
    .btn-export:hover {
        background: rgba(255, 215, 0, 0.15) !important;
    }
    .export-dropdown {
        animation: dropdownFade 0.15s ease;
    }
    @keyframes dropdownFade {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .export-option:hover {
        background: rgba(255,255,255,0.06) !important;
        color: #fff !important;
    }
`;
document.head.appendChild(exportStyles);

console.log('✅ Модуль №23: Экспорт данных загружен');
