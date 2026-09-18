# 🧠 Crucix RAG-модуль

**Retrieval-Augmented Generation** для Crucix — AI-аналитика на основе данных из корзины.

## 📋 Возможности

- ✅ Читает данные из корзины Crucix (`/data/basket/`)
- ✅ Ищет релевантные записи по запросу
- ✅ Отправляет в AI для анализа
- ✅ Поддерживает **множество AI-движков**:
  - 🦙 **Ollama** (локальный, без ключей)
  - 🧊 **DeepSeek локальный** (через Ollama)
  - 🌐 **DeepSeek API** (внешний, с ключом)
  - 📊 **Fallback** (поиск по ключевым словам, без AI)
- ✅ Гибкая конфигурация через `.env`
- ✅ Веб-чат для общения с AI
- ✅ Полностью независим от ядра Crucix

---

## 🚀 Быстрый старт

```bash
# 1. Перейдите в папку модуля
cd /home/ta8_/Рабочий стол/Crucix/rag-module

# 2. Установите зависимости
chmod +x INSTALL.sh
./INSTALL.sh

# 3. Запустите сервер
node rag-server.mjs
```

---

## 🌐 Доступ

- **API-сервер:** `http://localhost:3120`
- **Чат-интерфейс:** `http://localhost:3120/rag-chat.html`
- **Статус:** `http://localhost:3120/api/rag/status`
- **Статистика:** `http://localhost:3120/api/rag/stats`

---

## 🔧 Настройка AI-движков

Отредактируйте файл `.env`:

```
# Включить Ollama (локальный, без ключей)
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3.2

# Включить локальный DeepSeek (через Ollama)
DEEPSEEK_LOCAL_ENABLED=true
DEEPSEEK_LOCAL_MODEL=deepseek-r1:7b

# Включить внешний DeepSeek API
DEEPSEEK_API_ENABLED=true
DEEPSEEK_API_KEY=sk-ваш_ключ
```

---

## 📡 API-эндпоинты

### POST `/api/rag/query`

Главный эндпоинт для AI-запросов.

**Тело запроса:**

```
{
  "query": "Какая ситуация в Донбассе?",
  "useEngine": "auto",
  "limit": 30
}
```

**Ответ:**

```
{
  "query": "Какая ситуация в Донбассе?",
  "answer": "Аналитический ответ...",
  "usedEngine": "ollama",
  "confidence": 0.7,
  "sources": ["acled", "gdelt", "news"],
  "sourceCount": 12,
  "timestamp": "2026-08-29T16:30:00Z"
}
```

### POST `/api/rag/search`

Поиск по корзине без AI.

### GET `/api/rag/status`

Статус сервера и доступные движки.

### GET `/api/rag/stats`

Статистика корзины.

---

## 🧩 Интеграция с Crucix

1. Скопируйте `rag-chat.html` в `/dashboard/public/`
2. Добавьте ссылку в навигацию:

```
<a href="/rag-chat.html">🧠 RAG-аналитика</a>
```

---

## 📂 Структура

```
rag-module/
├── rag-server.mjs       # Главный сервер
├── rag-indexer.mjs      # Чтение и индексация корзины
├── rag-ai-router.mjs    # Маршрутизация к AI-движкам
├── rag-chat.html        # Веб-чат
├── .env.example         # Пример конфигурации
├── package.json         # Зависимости
├── INSTALL.sh           # Установщик
├── README.md            # Документация
└── rag_data/            # Данные модуля
    ├── vectors.json
    └── cache.json
```

---

## 🧠 Установка Ollama (для локального AI)

```
# Установка Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Запуск модели (базовая)
ollama run llama3.2

# Запуск DeepSeek локально
ollama run deepseek-r1:7b
```

---

## 📋 Лицензия

AGPL-3.0

