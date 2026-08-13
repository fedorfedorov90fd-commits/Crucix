import module from '../../../apis/sources/geopolitical-reports.mjs';

export default {
  id: 'geopolitical-reports',
  label: '📊 Геополитика + AI',
  icon: '📊',
  
  async render(container) {
    // Сначала отображаем настройки
    const settingsHtml = module.renderSettings();
    container.innerHTML = `
      <div class="geopolitical-panel" style="padding: 20px; background: #0d1117; border-radius: 8px;">
        <h2 style="color: #00d4ff;">Геополитические отчёты</h2>
        <p style="color: #888;">Сбор новостей из российских СМИ + AI-анализ</p>
        ${settingsHtml}
        <div style="margin-top: 20px; padding: 15px; background: #161b22; border-radius: 4px;">
          <p style="color: #888; font-size: 12px;">📌 Данные сохраняются в data/ai_raw/geopolitical-reports/</p>
          <p style="color: #888; font-size: 12px;">🤖 AI-анализ сохраняется как analysis_YYYY-MM-DD.md</p>
        </div>
      </div>
    `;

    // Вешаем обработчик на кнопку сохранения
    const saveBtn = container.querySelector('#saveAISettings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        module.handleSettingsSave();
      });
    }

    // Авто-сохранение при изменении провайдера
    const providerSelect = container.querySelector('#aiProvider');
    if (providerSelect) {
      providerSelect.addEventListener('change', () => {
        // Показываем/скрываем поле для API-ключа
        const apiKeyField = container.querySelector('#apiKeyField');
        const provider = providerSelect.value;
        const requiresKey = provider === 'deepseek' || provider === 'openrouter';
        apiKeyField.style.display = requiresKey ? 'block' : 'none';
        
        // Обновляем список моделей
        const modelSelect = container.querySelector('#aiModel');
        const models = {
          deepseek: ['deepseek-chat', 'deepseek-reasoner'],
          openrouter: ['deepseek/deepseek-v4-flash:free', 'mistralai/mistral-7b-instruct:free'],
          ollama: ['llama3.1', 'deepseek-r1:7b', 'mistral'],
          auto: ['Авто-выбор']
        };
        modelSelect.innerHTML = (models[provider] || []).map(m => 
          `<option value="${m}">${m}</option>`
        ).join('');
      });
    }
  }
};
