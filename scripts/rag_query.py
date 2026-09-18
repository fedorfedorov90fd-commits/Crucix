#!/usr/bin/env python3
"""
RAG-поиск по корзине Crucix с использованием Ollama
"""
import json, os, sys, requests
from datetime import datetime

BASKET_DIR = "/home/ta8_/Рабочий стол/Crucix/data/basket"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.2:latest"

def load_all_data():
    """Загружает все данные из корзины"""
    all_data = []
    for file in os.listdir(BASKET_DIR):
        if file.endswith('.json') and file not in ['predictions.json', 'cve_events.json']:
            path = os.path.join(BASKET_DIR, file)
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        all_data.extend(data)
                    elif isinstance(data, dict):
                        all_data.append(data)
            except:
                pass
    return all_data

def search_by_keyword(query, data):
    """Простой поиск по ключевым словам"""
    results = []
    for item in data:
        text = str(item).lower()
        if query.lower() in text:
            results.append(item)
    return results[:10]

def rag_query(query):
    """Выполняет RAG-запрос через Ollama"""
    # 1. Загружаем данные
    all_data = load_all_data()
    
    # 2. Ищем релевантные записи
    results = search_by_keyword(query, all_data)
    
    if not results:
        return f"По запросу '{query}' ничего не найдено"
    
    # 3. Формируем контекст
    context = "\n".join([json.dumps(r, ensure_ascii=False)[:500] for r in results[:5]])
    
    # 4. Отправляем в Ollama
    prompt = f"""Ты аналитик Crucix. Ответь на вопрос, используя только следующие данные:

Данные:
{context}

Вопрос: {query}

Ответ:"""
    
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        }, timeout=60)
        resp.raise_for_status()
        return resp.json().get('response', 'Ошибка генерации')
    except Exception as e:
        return f"Ошибка Ollama: {e}"

def main():
    if len(sys.argv) < 2:
        print("Использование: python3 rag_query.py 'ваш запрос'")
        sys.exit(1)
    
    query = ' '.join(sys.argv[1:])
    print(f"🔍 Запрос: {query}")
    print("-" * 50)
    result = rag_query(query)
    print(result)

if __name__ == "__main__":
    main()
