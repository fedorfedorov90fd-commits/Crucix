#!/usr/bin/env python3
import requests, json, hashlib, ssl
from datetime import datetime, timezone
from urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASKET = "/home/ta8_/Рабочий стол/Crucix/data/basket/cisa.json"
CISA_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

def main():
    try:
        resp = requests.get(CISA_URL, timeout=30, verify=False)
        resp.raise_for_status()
        data = resp.json()
        vulns = data.get('vulnerabilities', [])
        articles = []
        for v in vulns[:10]:
            articles.append({
                'advisory': v.get('cveID', ''),
                'description': v.get('vulnerabilityName', '')[:500],
                'severity': v.get('vulnerabilityType', 'INFO'),
                'country': 'United States',
                'lat': 38.8951,
                'lng': -77.0364,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
        with open(BASKET, 'w') as f:
            json.dump(articles, f, indent=2)
        print(f"✅ Сохранено {len(articles)} CISA уязвимостей")
    except Exception as e:
        print(f"⚠️ Ошибка: {e}")
        test_data = [
            {"advisory": "CISA-2026-001", "description": "Test CISA advisory",
             "severity": "HIGH", "country": "United States", "lat": 38.8951, "lng": -77.0364,
             "timestamp": datetime.now(timezone.utc).isoformat()}
        ]
        with open(BASKET, 'w') as f:
            json.dump(test_data, f, indent=2)
        print("📦 Созданы тестовые данные")

if __name__ == "__main__":
    main()
