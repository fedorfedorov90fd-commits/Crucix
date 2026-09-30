console.log('dashboards-nav.js загружен');
var DASHBOARDS = [
    { name: '5in1', label: 'Центр' },
    { name: 'economic', label: 'Экономика' },
    { name: 'financial', label: 'Финансы' },
    { name: 'military', label: 'Военный' },
    { name: 'geopolitical', label: 'Геополитика' },
    { name: 'ecological', label: 'Экология' },
    { name: 'cyber', label: 'Кибер' },
    { name: 'space', label: 'Космос' },
    { name: 'news', label: 'Новости' },
    { name: 'ai', label: 'AI' },
    { name: 'scientific', label: 'Наука' },
    { name: 'esg', label: 'ESG' },
    { name: 'threats', label: 'Угрозы' },
    { name: 'health', label: 'Здоровье' },
    { name: 'energy', label: 'Энергетика' },
    { name: 'transport', label: 'Транспорт' },
    { name: 'regions', label: 'Регионы' }
];
function goToDashboard(name) { window.location.href = '/dashboard-' + name + '.html'; }
window.goToDashboard = goToDashboard;
console.log('dashboards-nav.js готов');
