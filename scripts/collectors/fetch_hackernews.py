#!/usr/bin/env python3
import requests, json, time, hashlib, ssl
from datetime import datetime, timezone
from urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASKET = "/home/ta8_/Рабочий стол/Crucix/data/basket/hackernews.json"
TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json"
ITEM_URL = "https://hacker-news.firebaseio.com/v0/item/{}.json"

def fetch_top_ids(limit=10):
    resp = requests.get(TOP_STORIES_URL, timeout=10, verify=False)
    resp.raise_for_status()
    return resp.json()[:limit]

def fetch_item(item_id):
    resp = requests.get(ITEM_URL.format(item_id), timeout=10, verify=False)
    resp.raise_for_status()
    return resp.json()

def main():
    try:
        ids = fetch_top_ids(10)
        articles = []
        for item_id in ids:
            data = fetch_item(item_id)
            if data and data.get('type') == 'story':
                articles.append({
                    'id': str(item_id),
                    'title': data.get('title', '')[:200],
                    'text': data.get('text', '')[:500],
                    'score': data.get('score', 0),
                    'country': 'Global',
                    'lat': 0,
                    'lng': 0,
                    'severity': 'INFO',
                    'timestamp': datetime.fromtimestamp(data.get('time', 0), timezone.utc).isoformat()
                })
            time.sleep(0.5)
        with open(BASKET, 'w') as f:
            json.dump(articles, f, indent=2)
        print(f"✅ Сохранено {len(articles)} Hacker News статей")
    except Exception as e:
        print(f"⚠️ Ошибка: {e}")
        # Тестовые данные
        test_data = [
            {"id": "1", "title": "Hacker News Test Article", "text": "Test content", "score": 100,
             "country": "Global", "lat": 0, "lng": 0, "severity": "INFO",
             "timestamp": datetime.now(timezone.utc).isoformat()}
        ]
        with open(BASKET, 'w') as f:
            json.dump(test_data, f, indent=2)
        print("📦 Созданы тестовые данные")

if __name__ == "__main__":
    main()
