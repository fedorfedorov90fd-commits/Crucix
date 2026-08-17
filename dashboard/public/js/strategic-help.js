// ============================================================
// HELP.JS — Универсальная система справки для Crucix
// ============================================================

// Получаем имя страницы из URL
function getPageName() {
  const path = window.location.pathname.replace(/^\/|\/$/g, '') || 'index';
  return path;
}

// Получаем название страницы из документа
function getPageTitle() {
  return document.title || document.querySelector('.page-title')?.textContent || 'Страница';
}

// Показываем справку
function showHelp() {
  const pageName = getPageName();
  const pageTitle = getPageTitle();
  
  // Создаём модальное окно
  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85);
    z-index: 100000;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: fadeIn 0.3s ease;
  `;
  
  // Содержимое модального окна
  modal.innerHTML = `
    <div style="
      background: #1a1a2e;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      max-width: 700px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 24px;
      color: #c8d0d8;
      position: relative;
    ">
      <button onclick="closeHelp()" style="
        position: sticky;
        top: 0;
        float: right;
        background: rgba(239,68,68,0.15);
        border: 1px solid rgba(239,68,68,0.3);
        color: #ef4444;
        font-size: 20px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s;
        z-index: 10;
      ">✕</button>
      
      <h2 style="color: #5bc0f8; margin-bottom: 8px; font-size: 22px;">❓ ${pageTitle}</h2>
      <p style="color: #666; margin-bottom: 16px; font-size: 13px;">URL: /${pageName}</p>
      
      <div id="help-content" style="color: #c8d0d8; line-height: 1.6;">
        <div style="text-align:center;padding:20px;color:#666;">⏳ Загрузка справки...</div>
      </div>
      
      <div style="
        margin-top: 16px;
        padding: 12px;
        background: rgba(255,255,255,0.03);
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.05);
      ">
        <p style="color: #666; font-size: 11px;">
          📄 Файл справки: <span id="help-file-path" style="color: #555;">/data/help/ru/${pageName}.txt</span>
          <br>
          🔄 <span style="color: #555;">Чтобы перевести справку — скопируйте текст выше и вставьте в переводчик.</span>
        </p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Загружаем справку
  loadHelpContent(pageName);
  
  // Добавляем стили для анимации
  if (!document.getElementById('help-styles')) {
    const style = document.createElement('style');
    style.id = 'help-styles';
    style.textContent = `
      @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
      #help-modal::-webkit-scrollbar { width: 4px; }
      #help-modal::-webkit-scrollbar-track { background: transparent; }
      #help-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
    `;
    document.head.appendChild(style);
  }
}

// Закрыть справку
function closeHelp() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.remove();
}

// Загрузить содержимое справки
async function loadHelpContent(pageName) {
  const contentDiv = document.getElementById('help-content');
  const pathSpan = document.getElementById('help-file-path');
  
  try {
    // Пробуем загрузить русскую версию
    let response = await fetch(`/api/help/${pageName}?lang=ru`);
    
    if (!response.ok) {
      // Если нет русской — пробуем английскую
      response = await fetch(`/api/help/${pageName}?lang=en`);
    }
    
    if (response.ok) {
      const text = await response.text();
      contentDiv.innerHTML = `<pre style="
        white-space: pre-wrap;
        word-break: break-word;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1.8;
        margin: 0;
        color: #c8d0d8;
        background: rgba(0,0,0,0.2);
        padding: 16px;
        border-radius: 6px;
      ">${text}</pre>`;
      
      // Обновляем путь к файлу
      const lang = response.url.includes('lang=en') ? 'en' : 'ru';
      if (pathSpan) {
        pathSpan.textContent = `/data/help/${lang}/${pageName}.txt`;
      }
    } else {
      contentDiv.innerHTML = `
        <div style="text-align:center;padding:20px;color:#666;">
          <p>📭 Справка для этой страницы ещё не создана.</p>
          <p style="font-size:12px;margin-top:8px;">Вы можете создать файл: <code style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;">/data/help/ru/${pageName}.txt</code></p>
          <p style="font-size:12px;margin-top:4px;color:#555;">Скопируйте шаблон из любой существующей справки.</p>
        </div>
      `;
    }
  } catch (e) {
    contentDiv.innerHTML = `
      <div style="text-align:center;padding:20px;color:#ef4444;">
        ❌ Ошибка загрузки справки: ${e.message}
      </div>
    `;
  }
}

// Закрытие по Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeHelp();
  }
});

// Закрытие по клику вне окна
document.addEventListener('click', function(e) {
  const modal = document.getElementById('help-modal');
  if (modal && e.target === modal) {
    closeHelp();
  }
});
