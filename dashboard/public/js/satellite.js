// ============================================================
// СПУТНИКОВЫЙ МОНИТОРИНГ — Скрипт (Модуль №9)
// ============================================================

class SatelliteMonitor {
    constructor() {
        this.map = null;
        this.markers = [];
        this.images = [];
        this.orbits = {};
        this.changes = [];
        this.status = {};
        this.selectedImage = null;
        this.init();
    }

    init() {
        // Кнопка копирования
        document.getElementById('copy-btn')?.addEventListener('click', () => this.copyData());

        // Кнопки поиска и обновления
        document.getElementById('search-btn')?.addEventListener('click', () => this.loadImages());
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.loadAll());

        // Закрытие деталей
        document.getElementById('detail-close')?.addEventListener('click', () => {
            document.getElementById('detail-panel')?.classList.remove('visible');
            this.selectedImage = null;
        });

        // Инициализация карты
        this.initMap();

        // Загрузка данных
        this.loadAll();

        // Автообновление каждые 5 минут
        setInterval(() => this.loadAll(), 5 * 60 * 1000);
    }

    // ============================================================
    // КАРТА
    // ============================================================
    initMap() {
        const container = document.getElementById('satellite-map');
        if (!container) return;

        this.map = L.map('satellite-map', {
            center: [30, 20],
            zoom: 2,
            zoomControl: false,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CartoDB'
        }).addTo(this.map);

        L.control.zoom({ position: 'topright' }).addTo(this.map);

        this.map.on('click', () => {
            document.getElementById('detail-panel')?.classList.remove('visible');
            this.selectedImage = null;
        });
    }

    // ============================================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================================
    async loadAll() {
        await this.loadStatus();
        await this.loadImages();
        await this.loadOrbits();
        await this.loadChanges();
        this.renderStats();
    }

    async loadStatus() {
        try {
            const response = await fetch('/api/satellite/status');
            const data = await response.json();
            if (data.success) {
                this.status = data;
            }
        } catch (e) {
            console.error('[Satellite] Ошибка загрузки статуса:', e);
        }
    }

    async loadImages() {
        try {
            const satellite = document.getElementById('satellite-filter')?.value || 'all';
            const type = document.getElementById('type-filter')?.value || 'all';
            const date = document.getElementById('date-filter')?.value || '';

            let url = '/api/satellite/search';
            const params = [];
            if (satellite !== 'all') params.push(`satellite=${satellite}`);
            if (date) params.push(`date=${date}`);
            if (params.length > 0) url += '?' + params.join('&');

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                let images = data.images || [];

                // Фильтр по типу
                if (type !== 'all') {
                    const satTypes = {
                        'optical': ['sentinel2', 'landsat9', 'modis'],
                        'radar': ['sentinel1']
                    };
                    images = images.filter(img => satTypes[type]?.includes(img.satellite));
                }

                this.images = images;
                this.renderGallery(images);
                this.renderMarkers(images);
                this.renderStats();
            }
        } catch (e) {
            console.error('[Satellite] Ошибка загрузки снимков:', e);
        }
    }

    async loadOrbits() {
        try {
            const response = await fetch('/api/satellite/orbits');
            const data = await response.json();
            if (data.success) {
                this.orbits = data.constellations || {};
                this.renderOrbits();
            }
        } catch (e) {
            console.error('[Satellite] Ошибка загрузки орбит:', e);
        }
    }

    async loadChanges() {
        try {
            const response = await fetch('/api/satellite/changes');
            const data = await response.json();
            if (data.success) {
                this.changes = data.changes || [];
                this.renderChanges();
            }
        } catch (e) {
            console.error('[Satellite] Ошибка загрузки изменений:', e);
        }
    }

    // ============================================================
    // ОТОБРАЖЕНИЕ
    // ============================================================
    renderGallery(images) {
        const container = document.getElementById('gallery-grid');
        if (!container) return;

        if (!images || images.length === 0) {
            container.innerHTML = '<div style="grid-column:span 2;text-align:center;color:#666;padding:20px;">Снимков не найдено</div>';
            return;
        }

        const satNames = {
            sentinel2: 'Sentinel-2',
            sentinel1: 'Sentinel-1 (Radar)',
            landsat9: 'Landsat 9',
            modis: 'MODIS'
        };

        const typeLabels = {
            sentinel1: 'radar',
            sentinel2: 'optical',
            landsat9: 'optical',
            modis: 'optical'
        };

        let html = '';
        for (const img of images) {
            const typeClass = typeLabels[img.satellite] === 'radar' ? 'badge-radar' : 'badge-optical';
            const typeName = typeLabels[img.satellite] === 'radar' ? 'радар' : 'оптический';
            const icon = typeLabels[img.satellite] === 'radar' ? '📡' : '🛰️';
            html += `
                <div class="gallery-item" data-id="${img.id}" onclick="window.satellite?.showDetail('${img.id}')">
                    <div class="thumb">${icon}</div>
                    <div class="info">
                        <div class="name">${img.location || 'Без названия'}</div>
                        <div class="meta">${satNames[img.satellite] || img.satellite} · ${img.date}</div>
                        <span class="badge ${typeClass}">${typeName}</span>
                        <span style="font-size:10px;color:#666;margin-left:6px;">☁️ ${img.cloudCover || 0}%</span>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    renderMarkers(images) {
        if (!this.map) return;

        // Очищаем старые маркеры
        for (const marker of this.markers) {
            this.map.removeLayer(marker);
        }
        this.markers = [];

        const colors = {
            sentinel2: '#5bc0f8',
            sentinel1: '#ffd700',
            landsat9: '#4caf50',
            modis: '#f26522'
        };

        for (const img of images) {
            if (!img.coordinates) continue;

            const color = colors[img.satellite] || '#888';
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="
                        width: 10px;
                        height: 10px;
                        background: ${color};
                        border-radius: 50%;
                        border: 2px solid rgba(255,255,255,0.3);
                        box-shadow: 0 0 15px ${color}40;
                        cursor: pointer;
                    "></div>
                `,
                iconSize: [10, 10],
                iconAnchor: [5, 5]
            });

            const marker = L.marker([img.coordinates.lat, img.coordinates.lng], { icon })
                .addTo(this.map)
                .on('click', () => {
                    this.showDetail(img.id);
                });

            marker.bindTooltip(`
                <div style="
                    background: rgba(10,10,20,0.95);
                    color: #c8d0d8;
                    padding: 8px 12px;
                    border-radius: 4px;
                    border: 1px solid rgba(255,255,255,0.06);
                    font-size: 12px;
                    max-width: 200px;
                ">
                    <strong style="color:#e8f0f8;">${img.location || 'Снимок'}</strong><br>
                    <span style="color:#888;">${img.satellite}</span><br>
                    <span style="color:#666;">${img.date}</span>
                </div>
            `, { direction: 'top', offset: [0, -10] });

            this.markers.push(marker);
        }

        // Центрируем карту на маркерах
        if (images.length > 0) {
            const bounds = L.latLngBounds(images
                .filter(img => img.coordinates)
                .map(img => [img.coordinates.lat, img.coordinates.lng])
            );
            if (bounds.isValid()) {
                this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
            }
        }
    }

    renderOrbits() {
        const container = document.getElementById('orbits-grid');
        if (!container) return;

        const entries = Object.entries(this.orbits);
        if (entries.length === 0) {
            container.innerHTML = '<div style="grid-column:span 2;text-align:center;color:#666;padding:10px;">Нет данных об орбитах</div>';
            return;
        }

        const typeColors = {
            LEO: '#5bc0f8',
            MEO: '#ffd700',
            GEO: '#f26522'
        };

        let html = '';
        for (const [key, orbit] of entries) {
            const color = typeColors[orbit.type] || '#888';
            html += `
                <div class="orbit-card">
                    <div class="name">${orbit.name || key}</div>
                    <span class="count" style="color:${color};">${orbit.count || 0}</span>
                    <div class="type">${orbit.type || '—'} · ${orbit.altitude || '—'} км</div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    renderChanges() {
        const container = document.getElementById('changes-list');
        if (!container) return;

        if (!this.changes || this.changes.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#666;padding:10px;">Изменений не обнаружено</div>';
            return;
        }

        const typeIcons = {
            construction: '🏗️',
            damage: '💥',
            destruction: '🔥',
            default: '📌'
        };

        let html = '';
        for (const c of this.changes) {
            const icon = typeIcons[c.type] || typeIcons.default;
            html += `
                <div class="change-item">
                    <span class="icon">${icon}</span>
                    <div class="info">
                        <div class="title">${c.location}</div>
                        <div class="desc">${c.description} (${c.dateFrom} → ${c.dateTo})</div>
                    </div>
                    <span class="confidence">${c.confidence || 0}%</span>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    renderStats() {
        const total = this.images.length;
        const satellites = this.status.satellites ? Object.keys(this.status.satellites).length : 0;
        const totalOrbits = Object.values(this.orbits).reduce((sum, o) => sum + (o.count || 0), 0);
        const changes = this.changes.length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-satellites').textContent = satellites;
        document.getElementById('stat-orbits').textContent = totalOrbits.toLocaleString();
        document.getElementById('stat-changes').textContent = changes;
    }

    // ============================================================
    // ДЕТАЛИ СНИМКА
    // ============================================================
    async showDetail(id) {
        try {
            const response = await fetch(`/api/satellite/image/${id}`);
            const data = await response.json();

            if (data.success) {
                this.selectedImage = data.image;
                const img = data.image;
                const panel = document.getElementById('detail-panel');
                if (!panel) return;

                panel.classList.add('visible');

                document.getElementById('detail-name').textContent = img.location || 'Снимок';
                document.getElementById('detail-satellite').textContent = img.satellite || '—';
                document.getElementById('detail-date').textContent = img.date || '—';
                document.getElementById('detail-resolution').textContent = img.resolution || '—';
                document.getElementById('detail-cloud').textContent = `${img.cloudCover || 0}%`;
                document.getElementById('detail-coords').textContent =
                    `${img.coordinates?.lat?.toFixed(4) || '—'}, ${img.coordinates?.lng?.toFixed(4) || '—'}`;
                document.getElementById('detail-desc').textContent = img.description || 'Нет описания';
            }
        } catch (e) {
            console.error('[Satellite] Ошибка загрузки деталей:', e);
        }
    }

    // ============================================================
    // КОПИРОВАНИЕ ДАННЫХ
    // ============================================================
    copyData() {
        let text = `=== Спутниковый мониторинг ===\n`;
        text += `Дата: ${new Date().toLocaleString()}\n\n`;

        text += `--- СТАТИСТИКА ---\n`;
        text += `Всего снимков: ${this.images.length}\n`;
        text += `Активных спутников: ${this.status.satellites ? Object.keys(this.status.satellites).length : 0}\n`;
        text += `Орбитальных спутников: ${Object.values(this.orbits).reduce((sum, o) => sum + (o.count || 0), 0)}\n`;
        text += `Обнаружено изменений: ${this.changes.length}\n\n`;

        text += `--- СПУТНИКИ ---\n`;
        for (const [key, orbit] of Object.entries(this.orbits)) {
            text += `${orbit.name || key}: ${orbit.count || 0} (${orbit.type || '—'}, ${orbit.altitude || '—'} км)\n`;
        }

        text += `\n--- СНИМКИ (${this.images.length}) ---\n`;
        for (const img of this.images) {
            text += `${img.date} | ${img.satellite} | ${img.location || 'Без названия'}\n`;
        }

        text += `\n--- ИЗМЕНЕНИЯ (${this.changes.length}) ---\n`;
        for (const c of this.changes) {
            text += `${c.location}: ${c.description} (${c.confidence || 0}%)\n`;
        }

        text += `\n--- JSON ДАННЫЕ ---\n`;
        text += JSON.stringify({
            images: this.images,
            orbits: this.orbits,
            changes: this.changes,
            status: this.status
        }, null, 2);

        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('✅ Данные скопированы в буфер обмена');
        }).catch(() => {
            const area = document.createElement('textarea');
            area.value = text;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
            this.showNotification('✅ Данные скопированы');
        });
    }

    showNotification(msg) {
        const el = document.createElement('div');
        el.className = 'notification';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
}

// ============================================================
// ЗАПУСК
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    window.satellite = new SatelliteMonitor();
});