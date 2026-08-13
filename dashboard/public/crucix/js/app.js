// ============================================================
// CRUCIX — Основная логика
// ============================================================

// Загрузка данных с сервера
async function loadData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();

    // Обновляем элементы по ID
    const ids = {
      sdrCount: data.sdr?.count || '—',
      sdrStatus: data.sdr?.status || '—',
      airActivity: data.air?.theaters || '—',
      thermalSpikes: data.thermal?.detections || '—',
      maritimeWatch: data.maritime?.chokepoints || '—',
      nuclearSites: data.nuclear?.monitors || '—',
      conflictEvents: data.acled?.totalEvents || '—',
      healthWatch: data.health?.alerts || '—',
      newsCount: data.news?.length || '—',
      newsStatus: data.news?.geolocated || '—',
      osintUrgent: data.osint?.urgent || '—',
      osintTotal: data.osint?.total || '—',
      basketTotal: data.basket?.total || '0',
      vix: data.risk?.vix || '—',
      hySpread: data.risk?.hySpread || '—',
      usdIndex: data.risk?.usdIndex || '—',
      joblessClaims: data.risk?.joblessClaims || '—',
      mortgage: data.risk?.mortgage || '—',
      m2Supply: data.risk?.m2Supply || '—',
      natDebt: data.risk?.natDebt || '—',
      newObjects: data.space?.newObjects || '—',
      militarySats: data.space?.militarySats || '—',
      starlink: data.space?.starlink || '—',
      oneweb: data.space?.oneweb || '—'
    };

    for (const [id, value] of Object.entries(ids)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
}

// Очистка корзины
function clearBasket() {
  if (!confirm('Удалить все новости из корзины?')) return;
  fetch('/api/basket/clean', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: 0 })
  })
    .then(() => {
      alert('✅ Корзина очищена');
      loadData();
    })
    .catch(() => alert('❌ Ошибка'));
}

// Автообновление
loadData();
setInterval(loadData, 30000);

console.log('🔴 CRUCIX v2.1 — разделённый интерфейс');
console.log('Кнопки: HIGH ALERT | RSS 30 | AI Чат | КАРТА | КОРЗИНА');
