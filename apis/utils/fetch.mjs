// apis/utils/fetch.mjs
// Утилита для HTTP-запросов с повторными попытками

// ============================================================
// 1. БАЗОВЫЕ ФУНКЦИИ
// ============================================================

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

export function hoursAgo(hours) {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date.toISOString();
}

export function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// ============================================================
// 2. SAFE FETCH (С ПОВТОРНЫМИ ПОПЫТКАМИ)
// ============================================================

export async function safeFetch(url, options = {}, retries = 3, delay = 1000) {
    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined
            });

            if (response.ok) {
                return response;
            }

            if (response.status === 429 || response.status >= 500) {
                const waitTime = delay * Math.pow(2, attempt);
                console.warn(`[safeFetch] Попытка ${attempt + 1}/${retries} не удалась (${response.status}), ждём ${waitTime}ms`);
                await sleep(waitTime);
                continue;
            }

            return response;

        } catch (error) {
            lastError = error;
            if (attempt < retries - 1) {
                const waitTime = delay * Math.pow(2, attempt);
                console.warn(`[safeFetch] Ошибка ${attempt + 1}/${retries}, ждём ${waitTime}ms:`, error.message);
                await sleep(waitTime);
            }
        }
    }

    throw lastError || new Error(`Не удалось выполнить запрос после ${retries} попыток`);
}

// ============================================================
// 3. FETCH С ПОВТОРНЫМИ ПОПЫТКАМИ (АЛИАС)
// ============================================================

export async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
    return safeFetch(url, options, retries, delay);
}

// ============================================================
// 4. ПОЛУЧЕНИЕ JSON
// ============================================================

export async function fetchJSON(url, options = {}, retries = 3, delay = 1000) {
    const response = await safeFetch(url, options, retries, delay);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

// ============================================================
// 5. ПОЛУЧЕНИЕ ТЕКСТА
// ============================================================

export async function fetchText(url, options = {}, retries = 3, delay = 1000) {
    const response = await safeFetch(url, options, retries, delay);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
}

// ============================================================
// 6. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
    safeFetch,
    fetchWithRetry,
    fetchJSON,
    fetchText,
    sleep,
    daysAgo,
    hoursAgo,
    formatDate
};
