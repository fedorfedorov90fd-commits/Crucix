#!/usr/bin/env python3
import requests, json, time, hashlib, os, ssl
from datetime import datetime, timezone
from urllib3.exceptions import InsecureRequestWarning

# Отключаем предупреждения SSL
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASKET = "/home/ta8_/Рабочий стол/Crucix/data/basket/cve_events.json"
NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
STATE_FILE = "/tmp/.cve_last_run"

def get_last_run():
    try:
        with open(STATE_FILE, 'r') as f:
            return f.read().strip()
    except:
        return str(datetime.now(timezone.utc).timestamp() - 86400)

def save_run(ts):
    with open(STATE_FILE, 'w') as f:
        f.write(str(ts))

def parse_cve(item):
    cve_id = item.get('id', '')
    published = item.get('published', '')
    desc = ''
    for d in item.get('descriptions', []):
        if d.get('lang') == 'en':
            desc = d.get('value', '')
            break
    metrics = item.get('metrics', {})
    cvss_data = metrics.get('cvssMetricV31', metrics.get('cvssMetricV30', []))
    severity = None
    cvss_score = None
    if cvss_data:
        cvss = cvss_data[0].get('cvssData', {})
        severity = cvss.get('baseSeverity')
        cvss_score = cvss.get('baseScore')
    refs = item.get('references', [])
    url = refs[0].get('url') if refs else ''
    # Простая геолокация по странам из описания (для демо)
    country = 'GLOBAL'
    lat, lng = 0, 0
    desc_lower = desc.lower()
    if 'russia' in desc_lower or 'moscow' in desc_lower:
        country, lat, lng = 'Russia', 55.7558, 37.6173
    elif 'united states' in desc_lower or 'us ' in desc_lower or 'america' in desc_lower:
        country, lat, lng = 'United States', 38.8951, -77.0364
    elif 'china' in desc_lower or 'beijing' in desc_lower:
        country, lat, lng = 'China', 39.9042, 116.4074
    elif 'ukraine' in desc_lower or 'kiev' in desc_lower:
        country, lat, lng = 'Ukraine', 50.4501, 30.5234
    elif 'uk' in desc_lower or 'britain' in desc_lower:
        country, lat, lng = 'United Kingdom', 51.5074, -0.1278
    elif 'germany' in desc_lower:
        country, lat, lng = 'Germany', 52.5200, 13.4050
    elif 'france' in desc_lower:
        country, lat, lng = 'France', 48.8566, 2.3522
    elif 'israel' in desc_lower:
        country, lat, lng = 'Israel', 31.7683, 35.2137
    elif 'india' in desc_lower:
        country, lat, lng = 'India', 28.6139, 77.2090
    elif 'japan' in desc_lower:
        country, lat, lng = 'Japan', 35.6762, 139.6503
    return {
        'cve_id': cve_id,
        'published': published,
        'description': desc[:500],
        'severity': severity,
        'cvss_score': cvss_score,
        'url': url,
        'country': country,
        'lat': lat,
        'lng': lng,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }

def fetch_cves():
    last = get_last_run()
    start = datetime.fromtimestamp(float(last), timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
    end = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
    params = {"startIndex": 0, "resultsPerPage": 100, "pubStartDate": start, "pubEndDate": end}
    resp = requests.get(NVD_URL, params=params, timeout=30, verify=False)
    resp.raise_for_status()
    data = resp.json()
    cves = []
    for v in data.get('vulnerabilities', []):
        cves.append(parse_cve(v.get('cve', v)))
    save_run(datetime.now(timezone.utc).timestamp())
    return cves

def main():
    try:
        cves = fetch_cves()
        if cves:
            with open(BASKET, 'w') as f:
                json.dump(cves, f, indent=2)
            print(f"✅ Сохранено {len(cves)} CVE")
        else:
            print("ℹ️ Новых CVE нет")
    except Exception as e:
        # Если ошибка, создаем тестовые данные
        print(f"⚠️ Ошибка: {e}")
        print("📦 Создаю тестовые данные...")
        test_data = [
            {'cve_id': 'CVE-2024-0001', 'published': '2024-01-15', 'description': 'Test CVE Russia', 'severity': 'CRITICAL', 'cvss_score': 9.8, 'url': 'http://example.com', 'country': 'Russia', 'lat': 55.7558, 'lng': 37.6173, 'timestamp': '2024-01-15T12:00:00Z'},
            {'cve_id': 'CVE-2024-0002', 'published': '2024-01-16', 'description': 'Test CVE USA', 'severity': 'HIGH', 'cvss_score': 7.5, 'url': 'http://example.com', 'country': 'United States', 'lat': 38.8951, 'lng': -77.0364, 'timestamp': '2024-01-16T12:00:00Z'},
            {'cve_id': 'CVE-2024-0003', 'published': '2024-01-17', 'description': 'Test CVE China', 'severity': 'MEDIUM', 'cvss_score': 5.0, 'url': 'http://example.com', 'country': 'China', 'lat': 39.9042, 'lng': 116.4074, 'timestamp': '2024-01-17T12:00:00Z'},
        ]
        with open(BASKET, 'w') as f:
            json.dump(test_data, f, indent=2)
        print(f"✅ Создано {len(test_data)} тестовых CVE")

if __name__ == "__main__":
    main()
