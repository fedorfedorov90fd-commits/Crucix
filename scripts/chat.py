#!/usr/bin/env python3
import json
import subprocess
import sys
import os

# Простой промпт с базовой информацией о проекте
prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Что такое Crucix?"

# Базовая информация о проекте (известная нам)
project_info = """
CRUCIX — OSINT-платформа для сбора и анализа данных.

Основные модули в apis/sources/:
- gdelt.mjs — глобальные новости (GDELT)
- acled.mjs — конфликты и протесты (ACLED)
- opensky.mjs — авиационный трекинг
- ships.mjs — морской трекинг
- fred.mjs — экономические данные (FRED)
- global-index-api.mjs — глобальный индекс напряжённости
- geo-markers-api.mjs — геополитические маркеры
- rss-manager-api.mjs — управление RSS
- basket-api.mjs — корзина данных
- ai-chat-api.mjs — AI чат
- ai-news-rating.mjs — AI оценка новостей
- ai-news-analyzer.mjs — AI анализ новостей
- newsapi.mjs — NewsAPI
- и другие (всего 69 файлов)

Страницы:
- /jarvis — главная
- /global-index — глобальный индекс
- /geo-map — геополитическая карта
- /rss-feed — лента новостей
- /ai-chat — AI чат
- /basket — корзина

Вопрос: {question}
"""

full_prompt = project_info.format(question=prompt)

# Отправляем запрос в Ollama
payload = {
    "model": "deepseek-r1:1.5b",
    "prompt": full_prompt,
    "stream": False
}

try:
    result = subprocess.run(
        ["curl", "-s", "http://localhost:11434/api/generate",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True,
        text=True,
        timeout=60
    )
    data = json.loads(result.stdout)
    print(data.get("response", result.stdout))
except Exception as e:
    print(f"Ошибка: {e}")
