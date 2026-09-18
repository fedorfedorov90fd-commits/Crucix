// ============================================================
// DASHBOARDS-NAV.JS — 2-й блок: 17 дашбордов
// ============================================================

const DASHBOARDS = [
    { name: '5in1', label: '🎯 Центр аналитики' },
    { name: 'economic', label: '📊 Экономика' },
    { name: 'financial', label: '💰 Финансы' },
    { name: 'military', label: '🛡️ Военный' },
    { name: 'geopolitical', label: '🌍 Геополитика' },
    { name: 'ecological', label: '🌿 Экология' },
    { name: 'cyber', label: '🔒 Кибер' },
    { name: 'space', label: '🚀 Космос' },
    { name: 'news', label: '📰 Новости' },
    { name: 'ai', label: '🧠 AI' },
    { name: 'scientific', label: '🔬 Наука' },
    { name: 'esg', label: '🌱 ESG' },
    { name: 'threats', label: '⚡ Угрозы' },
    { name: 'health', label: '🏥 Здоровье' },
    { name: 'energy', label: '⛽ Энергетика' },
    { name: 'transport', label: '🚛 Транспорт' },
    { name: 'regions', label: '🌏 Регионы' }
];

export function goToDashboard(name) {
    window.location.href = '/dashboard-' + name + '.html';
}

// Делаем функцию глобальной
window.goToDashboard = goToDashboard;
