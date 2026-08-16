// apis/utils/fetch.mjs
// Утилита для HTTP-запросов с повторными попытками

export async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
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
                console.warn(`[fetchWithRetry] Попытка ${attempt + 1}/${retries} не удалась (${response.status}), ждём ${waitTime}ms`);
                await sleep(waitTime);
                continue;
            }

            return response;

        } catch (error) {
            lastError = error;
            if (attempt < retries - 1) {
                const waitTime = delay * Math.pow(2, attempt);
                console.warn(`[fetchWithRetry] Ошибка: ${error.message}, повтор через ${waitTime}ms`);
                await sleep(waitTime);
            }
        }
    }

    throw lastError || new Error('Неизвестная ошибка fetch');
}

// ============================================================
// safeFetch — полная копия fetchWithRetry для совместимости
// ============================================================
export async function safeFetch(url, options = {}, retries = 3, delay = 1000) {
    return fetchWithRetry(url, options, retries, delay);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default { fetchWithRetry, safeFetch };
