// apis/sources/currents-api.mjs
// Currents API - альтернатива GDELT

const API_KEY = process.env.CURRENTS_API_KEY || 'ваш_ключ_здесь';
const BASE_URL = 'https://api.currentsapi.services/v1';

export async function getCurrentsNews(query = 'world', maxRecords = 25) {
    const url = `${BASE_URL}/search?keywords=${encodeURIComponent(query)}&language=en&apiKey=${API_KEY}`;
    
    try {
        console.log(`[Currents] Запрос: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`[Currents] Ошибка ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        return parseCurrents(data);
    } catch (error) {
        console.error('[Currents] Ошибка:', error.message);
        return [];
    }
}

function parseCurrents(data) {
    if (!data.news || !Array.isArray(data.news)) return [];
    
    return data.news.slice(0, 25).map(article => ({
        id: article.url || `currents-${Date.now()}`,
        title: article.title || 'Без заголовка',
        description: article.description || article.summary || '',
        url: article.url || '',
        source: article.author || article.source || 'Currents',
        date: article.published || new Date().toISOString(),
        country: article.country || 'Unknown',
        category: article.category || 'General',
        coordinates: null,
        relevance: 0,
        tone: 0
    }));
}