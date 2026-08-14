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

            // Если ответ успешный, возвращаем его
            if (response.ok) {
                return response;
            }

            // Если сервер вернул ошибку 429 (Too Many Requests) или 5xx, пробуем снова
            if (response.status === 429 || response.status >= 500) {
                const waitTime = delay * Math.pow(2, attempt);
                console.warn(`[fetchWithRetry] Попытка ${attempt + 1}/${retries} не удалась (${response.status}), ждём ${waitTime}ms`);
                await sleep(waitTime);
                continue;
            }

            // Другие ошибки (400, 404, etc.) не повторяем
            return response;

        } catch (error) {
            lastError = error;
            console.warn(`[fetchWithRetry] Попытка ${attempt + 1}/${retries} упала с ошибкой:`, error.message);

            if (attempt < retries - 1) {
                const waitTime = delay * Math.pow(2, attempt);
                await sleep(waitTime);
            }
        }
    }

    throw new Error(`Не удалось выполнить запрос после ${retries} попыток: ${lastError?.message || 'неизвестная ошибка'}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
