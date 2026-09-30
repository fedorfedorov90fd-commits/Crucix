#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CRUCIX ANALYTICS ENGINE
Аналитический движок для Crucix — вычисление индексов, аномалий и прогнозов
Версия: 1.0.0
"""

import json
import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
import math

# ============================================================
# КОНФИГУРАЦИЯ
# ============================================================

CONFIG = {
    "basket_path": "/home/ta8_/Рабочий стол/Crucix/data/basket/",
    "output_path": "/home/ta8_/Рабочий стол/Crucix/data/analytics/",
    "sources": {
        "acled": {"file": "acled.json", "category": "conflict"},
        "gdelt": {"file": "gdelt.json", "category": "news"},
        "cisa_kev": {"file": "cisa_kev.json", "category": "cyber"},
        "usgs": {"file": "usgs.json", "category": "natural"},
        "noaa": {"file": "noaa.json", "category": "natural"},
        "firms": {"file": "firms.json", "category": "natural"},
        "ofac": {"file": "ofac.json", "category": "economic"},
        "eia": {"file": "eia.json", "category": "economic"},
        "fred": {"file": "fred.json", "category": "economic"},
        "opensky": {"file": "opensky.json", "category": "transport"}
    }
}

# ============================================================
# КЛАСС АНАЛИТИКИ
# ============================================================

class CrucixAnalytics:
    def __init__(self, basket_path, output_path):
        self.basket_path = Path(basket_path)
        self.output_path = Path(output_path)
        self.data = {}
        self.indices = {}
        self.anomalies = []
        
        # Создаём папку для выходных данных
        self.output_path.mkdir(parents=True, exist_ok=True)
        
    def load_data(self):
        """Загружает все данные из корзины"""
        print("📂 Загрузка данных из корзины...")
        
        for source_name, config in CONFIG["sources"].items():
            file_path = self.basket_path / config["file"]
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = json.load(f)
                        self.data[source_name] = {
                            "data": content if isinstance(content, list) else [content],
                            "category": config["category"],
                            "count": len(content) if isinstance(content, list) else 1
                        }
                        print(f"  ✅ {source_name}: {self.data[source_name]['count']} записей")
                except Exception as e:
                    print(f"  ⚠️ {source_name}: ошибка загрузки - {e}")
                    self.data[source_name] = {"data": [], "category": config["category"], "count": 0}
            else:
                print(f"  ⚠️ {source_name}: файл не найден")
                self.data[source_name] = {"data": [], "category": config["category"], "count": 0}
        
        print(f"✅ Загружено {len(self.data)} источников")
        return self.data

    def calculate_indices(self):
        """Вычисляет аналитические индексы"""
        print("\n📊 Вычисление аналитических индексов...")
        
        # 1. Индекс конфликтности
        conflict_score = self._calculate_conflict_index()
        self.indices["conflict_index"] = conflict_score
        print(f"  🔴 Индекс конфликтности: {conflict_score:.2f}")
        
        # 2. Индекс киберугроз
        cyber_score = self._calculate_cyber_index()
        self.indices["cyber_index"] = cyber_score
        print(f"  🟠 Индекс киберугроз: {cyber_score:.2f}")
        
        # 3. Индекс экономической нестабильности
        economic_score = self._calculate_economic_index()
        self.indices["economic_index"] = economic_score
        print(f"  🟡 Индекс экономической нестабильности: {economic_score:.2f}")
        
        # 4. Индекс природных катастроф
        natural_score = self._calculate_natural_index()
        self.indices["natural_index"] = natural_score
        print(f"  🟢 Индекс природных катастроф: {natural_score:.2f}")
        
        # 5. Глобальный индекс риска (Composite)
        global_risk = (
            conflict_score * 0.35 +
            cyber_score * 0.25 +
            economic_score * 0.25 +
            natural_score * 0.15
        )
        self.indices["global_risk_index"] = global_risk
        print(f"  🌍 Глобальный индекс риска: {global_risk:.2f}")
        
        return self.indices

    def _calculate_conflict_index(self):
        """Вычисляет индекс конфликтности на основе ACLED и GDELT"""
        score = 0.0
        total_events = 0
        recent_events = 0
        
        # ACLED
        acled = self.data.get("acled", {}).get("data", [])
        if acled:
            total_events += len(acled)
            # Считаем события за последние 7 дней
            now = datetime.now()
            for event in acled:
                if event.get("event_date"):
                    try:
                        date = datetime.fromisoformat(event["event_date"].replace("Z", ""))
                        if (now - date).days <= 7:
                            recent_events += 1
                    except:
                        pass
        
        # GDELT (используем как дополнительный индикатор)
        gdelt = self.data.get("gdelt", {}).get("data", [])
        if gdelt:
            total_events += len(gdelt) * 0.5
            recent_events += len(gdelt) * 0.3
        
        # Нормализация (0-100)
        if total_events > 0:
            score = min(100, (recent_events / max(1, total_events)) * 100 + (total_events / 1000) * 20)
        
        return round(score, 2)

    def _calculate_cyber_index(self):
        """Вычисляет индекс киберугроз на основе CISA KEV"""
        score = 0.0
        cisa = self.data.get("cisa_kev", {}).get("data", [])
        
        if cisa:
            # Считаем уязвимости с высоким уровнем
            high_count = 0
            critical_count = 0
            for item in cisa:
                if item.get("severity"):
                    if "critical" in item["severity"].lower():
                        critical_count += 1
                    elif "high" in item["severity"].lower():
                        high_count += 1
            
            total = len(cisa)
            if total > 0:
                score = min(100, (critical_count / total) * 60 + (high_count / total) * 30 + 10)
        
        # Добавляем данные из other cyber sources если есть
        cyber_data = self.data.get("cyber_intel", {}).get("data", [])
        if cyber_data:
            score = min(100, score + len(cyber_data) * 0.5)
        
        return round(score, 2)

    def _calculate_economic_index(self):
        """Вычисляет индекс экономической нестабильности"""
        score = 0.0
        indicators = []
        
        # OFAC (санкции)
        ofac = self.data.get("ofac", {}).get("data", [])
        if ofac:
            indicators.append(len(ofac) * 0.1)
        
        # EIA (энергетика)
        eia = self.data.get("eia", {}).get("data", [])
        if eia:
            # Ищем резкие изменения
            for item in eia:
                if item.get("change") and abs(item["change"]) > 5:
                    indicators.append(abs(item["change"]) * 0.5)
        
        # FRED (экономические данные)
        fred = self.data.get("fred", {}).get("data", [])
        if fred:
            for item in fred:
                if item.get("value") and item.get("indicator"):
                    if "inflation" in item["indicator"].lower():
                        indicators.append(item["value"] * 0.2)
                    elif "unemployment" in item["indicator"].lower():
                        indicators.append(item["value"] * 0.3)
        
        if indicators:
            score = min(100, sum(indicators) / len(indicators) * 10)
        
        return round(score, 2)

    def _calculate_natural_index(self):
        """Вычисляет индекс природных катастроф"""
        score = 0.0
        
        # USGS (землетрясения)
        usgs = self.data.get("usgs", {}).get("data", [])
        if usgs:
            strong = sum(1 for e in usgs if e.get("magnitude", 0) > 5)
            score += strong * 5
        
        # NOAA (погода)
        noaa = self.data.get("noaa", {}).get("data", [])
        if noaa:
            severe = sum(1 for e in noaa if e.get("severity") in ["high", "extreme"])
            score += severe * 3
        
        # FIRMS (пожары)
        firms = self.data.get("firms", {}).get("data", [])
        if firms:
            score += len(firms) * 0.05
        
        return min(100, round(score, 2))

    def detect_anomalies(self):
        """Обнаруживает аномалии в данных"""
        print("\n🔍 Поиск аномалий...")
        anomalies = []
        
        # Аномалии в конфликтах
        acled = self.data.get("acled", {}).get("data", [])
        if acled:
            # Ищем всплески событий
            daily_counts = defaultdict(int)
            for event in acled:
                date = event.get("event_date", "unknown")[:10]
                daily_counts[date] += 1
            
            if daily_counts:
                avg = sum(daily_counts.values()) / len(daily_counts)
                for date, count in daily_counts.items():
                    if count > avg * 3:
                        anomalies.append({
                            "type": "conflict_spike",
                            "date": date,
                            "value": count,
                            "threshold": avg * 3,
                            "severity": "high"
                        })
        
        # Аномалии в киберугрозах
        cisa = self.data.get("cisa_kev", {}).get("data", [])
        if cisa:
            # Ищем резкое увеличение новых уязвимостей
            recent = [item for item in cisa if item.get("dateAdded")]
            if len(recent) > 10:
                anomalies.append({
                    "type": "cyber_surge",
                    "value": len(recent),
                    "threshold": 10,
                    "severity": "medium"
                })
        
        # Аномалии в экономике
        eia = self.data.get("eia", {}).get("data", [])
        if eia:
            for item in eia:
                if item.get("change") and abs(item["change"]) > 10:
                    anomalies.append({
                        "type": "economic_shock",
                        "indicator": item.get("indicator", "unknown"),
                        "value": item["change"],
                        "threshold": 10,
                        "severity": "high"
                    })
        
        self.anomalies = anomalies
        print(f"  ✅ Обнаружено {len(anomalies)} аномалий")
        return anomalies

    def generate_report(self):
        """Генерирует отчёт"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "indices": self.indices,
            "anomalies": self.anomalies,
            "data_summary": {
                source: info["count"]
                for source, info in self.data.items()
            }
        }
        return report

    def save_results(self):
        """Сохраняет результаты в JSON"""
        report = self.generate_report()
        
        # Сохраняем полный отчёт
        report_path = self.output_path / "analytics_report.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Сохраняем индексы отдельно
        indices_path = self.output_path / "indices.json"
        with open(indices_path, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": report["timestamp"],
                "indices": self.indices
            }, f, indent=2, ensure_ascii=False)
        
        # Сохраняем аномалии
        anomalies_path = self.output_path / "anomalies.json"
        with open(anomalies_path, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": report["timestamp"],
                "anomalies": self.anomalies
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Результаты сохранены в {self.output_path}")
        return report_path

    def run(self):
        """Запускает полный цикл анализа"""
        print("=" * 60)
        print("🧠 CRUCIX ANALYTICS ENGINE v1.0.0")
        print("=" * 60)
        print(f"📂 Корзина: {self.basket_path}")
        print(f"📂 Выход: {self.output_path}")
        print("=" * 60)
        
        self.load_data()
        self.calculate_indices()
        self.detect_anomalies()
        self.save_results()
        
        print("\n✅ Анализ завершён!")
        return self.generate_report()

# ============================================================
# ЗАПУСК
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Crucix Analytics Engine")
    parser.add_argument("--basket", help="Путь к корзине Crucix")
    parser.add_argument("--output", help="Путь для сохранения результатов")
    parser.add_argument("--indices", action="store_true", help="Только вычисление индексов")
    parser.add_argument("--anomalies", action="store_true", help="Только поиск аномалий")
    
    args = parser.parse_args()
    
    basket_path = args.basket or CONFIG["basket_path"]
    output_path = args.output or CONFIG["output_path"]
    
    analytics = CrucixAnalytics(basket_path, output_path)
    
    if args.indices:
        analytics.load_data()
        analytics.calculate_indices()
        # Сохраняем только индексы
        indices_path = analytics.output_path / "indices.json"
        with open(indices_path, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "indices": analytics.indices
            }, f, indent=2, ensure_ascii=False)
        print(f"✅ Индексы сохранены в {indices_path}")
    elif args.anomalies:
        analytics.load_data()
        analytics.detect_anomalies()
        anomalies_path = analytics.output_path / "anomalies.json"
        with open(anomalies_path, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "anomalies": analytics.anomalies
            }, f, indent=2, ensure_ascii=False)
        print(f"✅ Аномалии сохранены в {anomalies_path}")
    else:
        analytics.run()

if __name__ == "__main__":
    main()
