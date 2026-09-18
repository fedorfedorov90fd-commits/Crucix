#!/usr/bin/env python3
import requests, json, hashlib, time, os
from datetime import datetime, timezone
from urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASKET = "/home/ta8_/Рабочий стол/Crucix/data/basket/gdelt_news.json"
GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
KEYWORDS = ["cybersecurity", "ransomware", "data breach", "critical infrastructure"]

COORDS = {
    "Russia": (55.7558, 37.6173), "United States": (38.8951, -77.0364),
    "China": (39.9042, 116.4074), "Ukraine": (50.4501, 30.5234),
    "United Kingdom": (51.5074, -0.1278), "Germany": (52.5200, 13.4050),
    "France": (48.8566, 2.3522), "Israel": (31.7683, 35.2137),
    "India": (28.6139, 77.2090), "Japan": (35.6762, 139.6503)
}

def fetch_articles(keyword):
    params = {"query": f"({keyword})", "mode": "artlist", "maxrecords": 50,
              "timespan": "24h", "sort": "datedesc", "format": "json"}
    resp = requests.get(GDELT_URL, params=params, timeout=30, verify=False)
    resp.raise_for_status()
    return resp.json().get('articles', [])

def main():
    try:
        all_articles = []
        for kw in KEYWORDS:
            articles = fetch_articles(kw)
            for art in articles:
                url = art.get('url', '')
                title = art.get('title', '')
                if not url or not title:
                    continue
                country = art.get('sourcecountry', '')
                lat, lng = COORDS.get(country, (0, 0))
                all_articles.append({
                    'id': hashlib.md5(f"{url}|{title}".encode()).hexdigest()[:16],
                    'title': title[:200],
                    'description': title[:500],
                    'url': url,
                    'country': country,
                    'lat': lat,
                    'lng': lng,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                })
            time.sleep(2)
        if all_articles:
            with open(BASKET, 'w') as f:
                json.dump(all_articles, f, indent=2)
            print(f"✅ Сохранено {len(all_articles)} новостей")
        else:
            # Тестовые данные
            print("📦 Создаю тестовые новости...")
            test_data = [
                {'id': 'test1', 'title': 'Cyber attack on critical infrastructure in Ukraine', 'description': 'News about cyber attack', 'url': 'http://example.com', 'country': 'Ukraine', 'lat': 50.4501, 'lng': 30.5234, 'timestamp': '2024-01-15T12:00:00Z'},
                {'id': 'test2', 'title': 'Ransomware attack hits US government agencies', 'description': 'Ransomware news', 'url': 'http://example.com', 'country': 'United States', 'lat': 38.8951, 'lng': -77.0364, 'timestamp': '2024-01-16T12:00:00Z'},
                {'id': 'test3', 'title': 'Data breach exposes millions of Russian citizens', 'description': 'Data breach news', 'url': 'http://example.com', 'country': 'Russia', 'lat': 55.7558, 'lng': 37.6173, 'timestamp': '2024-01-17T12:00:00Z'},
            ]
            with open(BASKET, 'w') as f:
                json.dump(test_data, f, indent=2)
            print(f"✅ Создано {len(test_data)} тестовых новостей")
    except Exception as e:
        print(f"⚠️ Ошибка: {e}")

if __name__ == "__main__":
    main()
