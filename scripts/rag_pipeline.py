#!/usr/bin/env python3
import chromadb
import ollama
import json
import os
import hashlib
from sentence_transformers import SentenceTransformer

CHROMA_PATH = "/home/ta8_/5/BD/chroma"
BASKET_DIR = "/home/ta8_/Рабочий стол/Crucix/data/basket"
MODEL_NAME = "llama3.2:latest"
COLLECTION_NAME = "crucix_events"

print("🚀 Загрузка модели для эмбеддингов...")
embedder = SentenceTransformer('all-MiniLM-L6-v2')

print("🔗 Подключение к ChromaDB...")
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)

def load_basket():
    events = []
    if not os.path.exists(BASKET_DIR):
        return events
    for fname in os.listdir(BASKET_DIR):
        if not fname.endswith('.json'):
            continue
        path = os.path.join(BASKET_DIR, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        item['_source_file'] = fname
                        events.append(item)
        except:
            pass
    return events

def index_events():
    events = load_basket()
    if not events:
        print("ℹ️ Нет данных для индексации")
        return 0
    texts, metadatas, ids = [], [], []
    seen = set()
    for ev in events:
        text = f"{ev.get('cve_id','')} {ev.get('title','')} {ev.get('description','')} {ev.get('country','')}".strip()
        if not text:
            continue
        # Генерируем уникальный ID
        raw_id = ev.get('id') or hashlib.md5(text.encode()).hexdigest()[:16]
        # Добавляем суффикс, если ID уже существует
        counter = 0
        final_id = str(raw_id)
        while final_id in seen:
            counter += 1
            final_id = f"{raw_id}_{counter}"
        seen.add(final_id)
        
        texts.append(text)
        metadatas.append({
            'source': ev.get('_source_file', ''),
            'country': ev.get('country', ''),
            'severity': ev.get('severity', ''),
            'title': ev.get('title', '')[:100],
            'cve_id': ev.get('cve_id', '')
        })
        ids.append(final_id)
    
    print(f"📊 Векторизация {len(texts)} документов...")
    embeddings = embedder.encode(texts, show_progress_bar=True).tolist()
    collection.upsert(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
    print(f"✅ Индексировано {len(ids)} событий")
    return len(ids)

def query_rag(question, n_results=5):
    query_embedding = embedder.encode([question])[0].tolist()
    results = collection.query(query_embeddings=[query_embedding], n_results=n_results)
    if not results['documents'] or not results['documents'][0]:
        return "Ничего не найдено."
    context = ""
    for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
        context += f"\n[{meta.get('cve_id','')}] {meta.get('title','')} ({meta.get('country','')})\n{doc[:300]}\n"
    prompt = f"""Ты — аналитик Crucix. Ответь на вопрос на основе данных.

Данные:
{context}

Вопрос: {question}

Ответ:"""
    response = ollama.generate(model=MODEL_NAME, prompt=prompt, options={"temperature": 0.3})
    return response['response']

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: index | query '...'")
        sys.exit(1)
    if sys.argv[1] == "index":
        index_events()
    elif sys.argv[1] == "query" and len(sys.argv) >= 3:
        print(query_rag(sys.argv[2]))
    else:
        print("Unknown command")
