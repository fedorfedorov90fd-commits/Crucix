// KiwiSDR — клиентская логика
document.addEventListener('DOMContentLoaded', function() {
  loadData();
});

async function loadData() {
  try {
    const response = await fetch('/api/kiwisdr/receivers');
    const data = await response.json();
    
    if (data.success && data.receivers) {
      const receivers = data.receivers;
      const total = receivers.length;
      const online = receivers.filter(r => !r.offline).length;
      const countries = [...new Set(receivers.map(r => r.country).filter(c => c))];
      
      document.getElementById('total-receivers').textContent = total || '—';
      document.getElementById('online-receivers').textContent = online || '—';
      document.getElementById('offline-receivers').textContent = total - online || '—';
      document.getElementById('countries-count').textContent = countries.length || '—';
      
      // Рендерим список стран
      const list = document.getElementById('countries-list');
      if (list) {
        list.innerHTML = countries.slice(0, 20).map(c => `<span class="country-tag">${c}</span>`).join('');
        if (countries.length > 20) {
          list.innerHTML += `<span class="country-tag">+${countries.length - 20} ещё</span>`;
        }
      }
    } else {
      showError('Не удалось загрузить данные');
    }
  } catch (e) {
    console.error('[KiwiSDR] Ошибка:', e);
    showError('Ошибка подключения к серверу');
  }
}

function showError(msg) {
  document.querySelectorAll('.stat-value').forEach(el => el.textContent = '❌');
  const list = document.getElementById('countries-list');
  if (list) list.innerHTML = `<span style="color:#666;">${msg}</span>`;
}
