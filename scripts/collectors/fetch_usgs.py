#!/usr/bin/env python3
import requests, json, ssl
from datetime import datetime, timezone
from urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASKET = "/home/ta8_/Рабочий стол/Crucix/data/basket/usgs.json"
USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"

def main():
    try:
        resp = requests.get(USGS_URL, timeout=30, verify=False)
        resp.raise_for_status()
        data = resp.json()
        features = data.get('features', [])
        articles = []
        for f in features[:20]:
            props = f.get('properties', {})
            geom = f.get('geometry', {})
            coords = geom.get('coordinates', [0, 0, 0])
            articles.append({
                'place': props.get('place', 'Unknown'),
                'magnitude': props.get('mag', 0),
                'country': 'Global',
                'lat': coords[1],
                'lng': coords[0],
                'severity': 'HIGH' if props.get('mag', 0) > 5 else 'MEDIUM' if props.get('mag', 0) > 4 else 'LOW',
                'timestamp': datetime.fromtimestamp(props.get('time', 0)/1000, timezone.utc).isoformat()
            })
        with open(BASKET, 'w') as f:
            json.dump(articles, f, indent=2)
        print(f"✅ Сохранено {len(articles)} землетрясений")
    except Exception as e:
        print(f"⚠️ Ошибка: {e}")
        test_data = [
            {"place": "California", "magnitude": 4.2, "country": "United States",
             "lat": 36.7783, "lng": -119.4179, "severity": "LOW",
             "timestamp": datetime.now(timezone.utc).isoformat()}
        ]
        with open(BASKET, 'w') as f:
            json.dump(test_data, f, indent=2)
        print("📦 Созданы тестовые данные")

if __name__ == "__main__":
    main()
