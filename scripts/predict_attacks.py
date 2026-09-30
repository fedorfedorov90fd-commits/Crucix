#!/usr/bin/env python3
"""
Прогнозирование атак на основе всплеска новостей + CVE в регионе
"""
import json, os, sys
from datetime import datetime, timedelta
from collections import defaultdict

BASKET_DIR = "/home/ta8_/Рабочий стол/Crucix/data/basket"

def load_json(filename):
    path = os.path.join(BASKET_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, 'r') as f:
        return json.load(f)

def get_region(country):
    """Группировка стран по регионам"""
    regions = {
        'Europe': ['Russia', 'Ukraine', 'Germany', 'France', 'United Kingdom', 'Poland', 'Italy', 'Spain'],
        'North America': ['United States', 'Canada', 'Mexico'],
        'Asia': ['China', 'India', 'Japan', 'South Korea', 'North Korea', 'Iran', 'Israel'],
        'Middle East': ['Israel', 'Iran', 'Saudi Arabia', 'UAE', 'Turkey'],
        'Africa': ['South Africa', 'Nigeria', 'Egypt'],
        'South America': ['Brazil', 'Argentina', 'Colombia'],
        'Australia': ['Australia', 'New Zealand']
    }
    for region, countries in regions.items():
        if country in countries:
            return region
    return 'Global'

def main():
    # Загружаем данные
    cves = load_json('cve_events.json')
    news = load_json('gdelt_news.json')
    
    # Анализируем по регионам
    region_cves = defaultdict(int)
    region_news = defaultdict(int)
    region_severity = defaultdict(float)
    
    # Считаем CVE по регионам
    for cve in cves:
        country = cve.get('country', 'Global')
        region = get_region(country)
        region_cves[region] += 1
        cvss = cve.get('cvss_score', 0) or 0
        if cvss > 7:
            region_severity[region] += cvss
    
    # Считаем новости по регионам
    for item in news:
        country = item.get('country', 'Global')
        region = get_region(country)
        region_news[region] += 1
    
    # Определяем угрозы
    alerts = []
    for region in set(list(region_cves.keys()) + list(region_news.keys())):
        cve_count = region_cves.get(region, 0)
        news_count = region_news.get(region, 0)
        severity = region_severity.get(region, 0)
        
        # Если в регионе > 3 новостей и > 2 CVE за последнее время
        if news_count > 3 and cve_count > 2:
            risk = min(100, (news_count * 2) + (cve_count * 3) + (severity * 2))
            level = 'КРИТИЧЕСКАЯ' if risk > 70 else 'ВЫСОКАЯ' if risk > 40 else 'СРЕДНЯЯ'
            alerts.append({
                'region': region,
                'risk': round(risk, 1),
                'level': level,
                'cve_count': cve_count,
                'news_count': news_count,
                'message': f"🔴 {region}: {level} вероятность атаки (CVE: {cve_count}, новости: {news_count})"
            })
    
    # Сортируем по риску
    alerts.sort(key=lambda x: x['risk'], reverse=True)
    
    # Сохраняем прогноз
    output = {
        'timestamp': datetime.now().isoformat(),
        'alerts': alerts,
        'summary': {
            'total_cves': len(cves),
            'total_news': len(news),
            'regions_monitored': len(set(list(region_cves.keys()) + list(region_news.keys())))
        }
    }
    
    with open(os.path.join(BASKET_DIR, 'predictions.json'), 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    # Печатаем результат
    print("🔮 ПРОГНОЗ АТАК ПО РЕГИОНАМ")
    print("=" * 50)
    for alert in alerts:
        print(f"{alert['message']} (риск: {alert['risk']}%)")
    
    if not alerts:
        print("✅ Активных угроз не обнаружено")
    
    print(f"\n📊 Всего CVE: {len(cves)}, новостей: {len(news)}")

if __name__ == "__main__":
    main()
