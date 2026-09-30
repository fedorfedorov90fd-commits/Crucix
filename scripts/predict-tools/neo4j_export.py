# scripts/neo4j_export.py
# Экспорт Multi-Layer Causal Graph в Neo4j для визуализации
#
# Использование:
#   python neo4j_export.py [--uri bolt://localhost:7687] [--user neo4j] [--password password]
#
# Требуется: pip install neo4j
#
# Экспортирует:
#   - Узлы: 4 слоя (cyber, info, finance, physical)
#   - Рёбра: CAUSES с весами strength, lagHours, crossLayer
#   - Атрибуты: currentProb, baseProb, name, category
#
# После импорта можно визуализировать в Neo4j Browser:
#   MATCH (n) RETURN n LIMIT 100
#   MATCH (a)-[r:CAUSES]->(b) WHERE r.crossLayer = true RETURN a, r, b

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from neo4j import GraphDatabase
except ImportError:
    print("ERROR: neo4j driver not installed. Run: pip install neo4j")
    sys.exit(1)


# --- КОНФИГУРАЦИЯ ---

DEFAULT_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
DEFAULT_USER = os.environ.get("NEO4J_USER", "neo4j")
DEFAULT_PASSWORD = os.environ.get("NEO4J_PASSWORD", "password")

ROOT = Path(__file__).resolve().parent.parent
FORECAST_FILE = ROOT / "runs" / "predictions" / "latest_forecast.json"


# --- ЗАГРУЗКА ДАННЫХ ---

def load_forecast(path=None):
    """Загрузка latest_forecast.json"""
    filepath = path or FORECAST_FILE
    if not filepath.exists():
        print(f"ERROR: {filepath} not found")
        return None

    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


# --- EXPORTER ---

class Neo4jExporter:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.stats = {"nodes": 0, "edges": 0, "layers": 0}

    def close(self):
        self.driver.close()

    def clear_database(self):
        """Очистка БД перед импортом"""
        with self.driver.session() as session:
            session.run("MATCH (n:CrucixNode) DETACH DELETE n")
            print("OK Database cleared")

    def create_constraints(self):
        """Создание индексов и ограничений"""
        with self.driver.session() as session:
            session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (n:CrucixNode) REQUIRE n.id IS UNIQUE")
            session.run("CREATE INDEX IF NOT EXISTS FOR (n:CrucixNode) ON (n.layer)")
            session.run("CREATE INDEX IF NOT EXISTS FOR (n:CrucixNode) ON (n.category)")
            print("OK Constraints and indexes created")

    def export_nodes(self, forecast):
        """Экспорт узлов графа"""
        graph = forecast.get("multiLayerCausal", {})
        nodes = graph.get("nodes", [])

        if not nodes:
            print("WARN No nodes in forecast, using default definitions")
            nodes = self._get_default_nodes()

        with self.driver.session() as session:
            for node in nodes:
                session.run(
                    """
                    MERGE (n:CrucixNode {id: $id})
                    SET n.name = $name,
                        n.layer = $layer,
                        n.category = $category,
                        n.currentProb = $currentProb,
                        n.baseProb = $baseProb,
                        n.updatedAt = datetime()
                    """,
                    id=node.get("id"),
                    name=node.get("name", node.get("id")),
                    layer=node.get("layer", "unknown"),
                    category=node.get("category", "event"),
                    currentProb=float(node.get("currentProb", node.get("prob", 0.5))),
                    baseProb=float(node.get("baseProb", 0.5)),
                )
                self.stats["nodes"] += 1

        print(f"OK Exported {self.stats['nodes']} nodes")

    def export_edges(self, forecast):
        """Экспорт рёбер с атрибутами"""
        graph = forecast.get("multiLayerCausal", {})
        edges = graph.get("edges", [])

        if not edges:
            print("WARN No edges in forecast, using default edges")
            edges = self._get_default_edges()

        with self.driver.session() as session:
            for edge in edges:
                session.run(
                    """
                    MATCH (a:CrucixNode {id: $from})
                    MATCH (b:CrucixNode {id: $to})
                    MERGE (a)-[r:CAUSES {id: $edgeId}]->(b)
                    SET r.strength = $strength,
                        r.lagHours = $lagHours,
                        r.crossLayer = $crossLayer,
                        r.description = $description,
                        r.updatedAt = datetime()
                    """,
                    from_=edge.get("from"),
                    to=edge.get("to"),
                    edgeId=f"{edge.get('from')}_to_{edge.get('to')}",
                    strength=float(edge.get("strength", 1.0)),
                    lagHours=float(edge.get("lagHours", 0)),
                    crossLayer=bool(edge.get("crossLayer", False)),
                    description=edge.get("description", ""),
                )
                self.stats["edges"] += 1

        print(f"OK Exported {self.stats['edges']} edges")

    def export_layers(self):
        """Экспорт слоёв как мета-узлов"""
        layers = [
            {"id": "layer_cyber", "name": "Кибер", "color": "#ec4899"},
            {"id": "layer_info", "name": "Информация", "color": "#8b5cf6"},
            {"id": "layer_finance", "name": "Финансы", "color": "#3b82f6"},
            {"id": "layer_physical", "name": "Физический", "color": "#22c55e"},
        ]

        with self.driver.session() as session:
            for layer in layers:
                session.run(
                    """
                    MERGE (l:CrucixLayer {id: $id})
                    SET l.name = $name, l.color = $color
                    """,
                    id=layer["id"], name=layer["name"], color=layer["color"],
                )
                self.stats["layers"] += 1

            # Связываем узлы со слоями
            for layer in layers:
                layer_key = layer["id"].replace("layer_", "")
                session.run(
                    """
                    MATCH (n:CrucixNode {layer: $layer})
                    MATCH (l:CrucixLayer {id: $layerId})
                    MERGE (n)-[:BELONGS_TO]->(l)
                    """,
                    layer=layer_key, layerId=layer["id"],
                )

        print(f"OK Exported {self.stats['layers']} layers")

    def export_narratives(self, forecast):
        """Экспорт нарративов (если есть unified narrative)"""
        narratives = forecast.get("narrative", {}).get("narratives", [])
        if not narratives:
            return

        with self.driver.session() as session:
            for i, n in enumerate(narratives[:20]):
                narrative_id = f"narrative_{i}_{n.get('id', i)}"
                session.run(
                    """
                    MERGE (n:CrucixNarrative {id: $id})
                    SET n.keywords = $keywords,
                        n.documentCount = $documentCount,
                        n.threatLevel = $threatLevel,
                        n.originType = $originType
                    """,
                    id=narrative_id,
                    keywords=n.get("keywords", [])[:5],
                    documentCount=int(n.get("documentCount", 0)),
                    threatLevel=float(n.get("threatLevel", 0)),
                    originType=n.get("originType", "unknown"),
                )

                # Связь с info-слоем
                session.run(
                    """
                    MATCH (l:CrucixLayer {id: 'layer_info'})
                    MATCH (n:CrucixNarrative {id: $id})
                    MERGE (n)-[:PART_OF]->(l)
                    """,
                    id=narrative_id,
                )

        print(f"OK Exported {min(len(narratives), 20)} narratives")

    def export_scenarios(self, forecast):
        """Экспорт сценариев"""
        scenarios = forecast.get("scenarios", {}).get("scenarios", [])
        if not scenarios:
            return

        with self.driver.session() as session:
            for i, sc in enumerate(scenarios[:10]):
                scenario_id = f"scenario_{i}"
                session.run(
                    """
                    MERGE (s:CrucixScenario {id: $id})
                    SET s.name = $name,
                        s.description = $description,
                        s.probability = $probability,
                        s.severity = $severity,
                        s.horizonHours = $horizonHours
                    """,
                    id=scenario_id,
                    name=sc.get("name", "Unknown"),
                    description=sc.get("description", ""),
                    probability=float(sc.get("probability", 0)),
                    severity=sc.get("severity", "medium"),
                    horizonHours=int(sc.get("horizonHours", 0)),
                )

        print(f"OK Exported {min(len(scenarios), 10)} scenarios")

    def create_summary_view(self):
        """Создание материализованного представления для быстрого доступа"""
        with self.driver.session() as session:
            session.run(
                """
                MATCH (n:CrucixNode)
                WITH n.layer AS layer, count(n) AS cnt,
                     avg(n.currentProb) AS avgProb
                MERGE (s:CrucixLayerSummary {layer: layer})
                SET s.nodeCount = cnt, s.avgProbability = avgProb
                """
            )
        print("OK Created layer summary")

    # --- Fallback данные ---

    def _get_default_nodes(self):
        """Узлы по умолчанию (из multilayer_causal.mjs)"""
        return [
            # CYBER
            {"id": "cyberAttack", "name": "Кибератака", "layer": "cyber", "category": "event", "currentProb": 0.3},
            {"id": "dataLeak", "name": "Утечка данных", "layer": "cyber", "category": "event", "currentProb": 0.3},
            {"id": "ransomwareWave", "name": "Ransomware", "layer": "cyber", "category": "event", "currentProb": 0.2},
            {"id": "infrastructureBreach", "name": "Взлом инфры", "layer": "cyber", "category": "event", "currentProb": 0.2},
            # INFO
            {"id": "disinformation", "name": "Дезинформация", "layer": "info", "category": "event", "currentProb": 0.4},
            {"id": "narrativeShift", "name": "Смена нарратива", "layer": "info", "category": "event", "currentProb": 0.3},
            {"id": "propagandaSpike", "name": "Пропаганда", "layer": "info", "category": "event", "currentProb": 0.3},
            {"id": "panicSelling", "name": "Паника", "layer": "info", "category": "state", "currentProb": 0.2},
            # FINANCE
            {"id": "vixSpike", "name": "VIX spike", "layer": "finance", "category": "market", "currentProb": 0.4},
            {"id": "marketCrash", "name": "Обвал", "layer": "finance", "category": "market", "currentProb": 0.2},
            {"id": "sanctionsExpansion", "name": "Санкции", "layer": "finance", "category": "policy", "currentProb": 0.3},
            {"id": "creditFreeze", "name": "Кредит. сжатие", "layer": "finance", "category": "market", "currentProb": 0.15},
            # PHYSICAL
            {"id": "satelliteAnomaly", "name": "Спутн. аномалия", "layer": "physical", "category": "observation", "currentProb": 0.2},
            {"id": "navalMovement", "name": "Флот", "layer": "physical", "category": "observation", "currentProb": 0.3},
            {"id": "militaryBuildUp", "name": "Наращивание", "layer": "physical", "category": "observation", "currentProb": 0.3},
            {"id": "conflictEscalation", "name": "Конфликт", "layer": "physical", "category": "event", "currentProb": 0.3},
            {"id": "radiationAnomaly", "name": "Радиация", "layer": "physical", "category": "observation", "currentProb": 0.1},
        ]

    def _get_default_edges(self):
        """Рёбра по умолчанию"""
        return [
            {"from": "cyberAttack", "to": "vixSpike", "strength": 1.5, "lagHours": 2, "crossLayer": True, "description": "Кибератака -> VIX"},
            {"from": "infrastructureBreach", "to": "marketCrash", "strength": 2.2, "lagHours": 6, "crossLayer": True, "description": "Взлом -> обвал"},
            {"from": "cyberAttack", "to": "disinformation", "strength": 1.6, "lagHours": 1, "crossLayer": True, "description": "Атака -> дезинфо"},
            {"from": "disinformation", "to": "panicSelling", "strength": 2.0, "lagHours": 4, "crossLayer": True, "description": "Дезинфо -> паника"},
            {"from": "panicSelling", "to": "vixSpike", "strength": 2.5, "lagHours": 1, "crossLayer": True, "description": "Паника -> VIX"},
            {"from": "conflictEscalation", "to": "vixSpike", "strength": 2.8, "lagHours": 2, "crossLayer": True, "description": "Конфликт -> VIX"},
            {"from": "sanctionsExpansion", "to": "militaryBuildUp", "strength": 1.7, "lagHours": 168, "crossLayer": True, "description": "Санкции -> наращивание"},
            {"from": "vixSpike", "to": "marketCrash", "strength": 2.4, "lagHours": 4, "crossLayer": False, "description": "VIX -> обвал"},
            {"from": "militaryBuildUp", "to": "conflictEscalation", "strength": 2.5, "lagHours": 48, "crossLayer": False, "description": "Наращивание -> конфликт"},
            {"from": "radiationAnomaly", "to": "vixSpike", "strength": 3.0, "lagHours": 1, "crossLayer": True, "description": "Радиация -> VIX"},
        ]


# --- QUERIES ---

CYPHER_QUERIES = {
    "cross_layer_edges": """
        MATCH (a:CrucixNode)-[r:CAUSES]->(b:CrucixNode)
        WHERE r.crossLayer = true
        RETURN a.name, a.layer, r.strength, r.lagHours, b.name, b.layer
        ORDER BY r.strength DESC
        LIMIT 20
    """,
    "high_probability_nodes": """
        MATCH (n:CrucixNode)
        WHERE n.currentProb > 0.5
        RETURN n.name, n.layer, n.currentProb
        ORDER BY n.currentProb DESC
    """,
    "propagation_paths": """
        MATCH path = (start:CrucixNode {id: $startId})-[:CAUSES*1..3]->(end:CrucixNode)
        RETURN path
        LIMIT 10
    """,
    "layer_influence": """
        MATCH (a:CrucixNode)-[r:CAUSES]->(b:CrucixNode)
        WHERE r.crossLayer = true
        RETURN a.layer AS from_layer, b.layer AS to_layer,
               count(r) AS edge_count, avg(r.strength) AS avg_strength
        ORDER BY edge_count DESC
    """,
}


def run_analysis_queries(driver):
    """Запуск аналитических запросов"""
    print("\n=======================================")
    print("  ANALYSIS QUERIES")
    print("=======================================\n")

    with driver.session() as session:
        # Cross-layer influence
        print("Cross-layer influence:")
        result = session.run(CYPHER_QUERIES["layer_influence"])
        for record in result:
            print(f"  {record['from_layer']} -> {record['to_layer']}: "
                  f"{record['edge_count']} edges, avg strength {record['avg_strength']:.2f}")

        # High probability nodes
        print("\nHigh probability nodes (>50%):")
        result = session.run(CYPHER_QUERIES["high_probability_nodes"])
        for record in result:
            print(f"  [{record['n.layer']}] {record['n.name']}: {record['n.currentProb']*100:.0f}%")

        # Top cross-layer edges
        print("\nTop cross-layer edges:")
        result = session.run(CYPHER_QUERIES["cross_layer_edges"])
        for record in result:
            print(f"  {record['a.name']} ({record['a.layer']}) "
                  f"-> {record['r.strength']:.1f}* -> "
                  f"{record['b.name']} ({record['b.layer']}) "
                  f"[+{record['r.lagHours']}h]")


# --- MAIN ---

def main():
    parser = argparse.ArgumentParser(description="Export Crucix causal graph to Neo4j")
    parser.add_argument("--uri", default=DEFAULT_URI, help="Neo4j URI")
    parser.add_argument("--user", default=DEFAULT_USER, help="Neo4j user")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Neo4j password")
    parser.add_argument("--file", default=None, help="Path to latest_forecast.json")
    parser.add_argument("--clear", action="store_true", help="Clear database before import")
    parser.add_argument("--analyze", action="store_true", help="Run analysis queries after import")
    args = parser.parse_args()

    print("=======================================")
    print("  Crucix -> Neo4j Exporter")
    print("=======================================\n")

    # Загрузка данных
    forecast = load_forecast(args.file)
    if not forecast:
        sys.exit(1)

    print(f"OK Loaded forecast: {forecast.get('timestamp', 'unknown')}")
    print(f"  Module version: {forecast.get('version', 'unknown')}\n")

    # Экспорт
    exporter = Neo4jExporter(args.uri, args.user, args.password)
    try:
        # Проверка подключения
        with exporter.driver.session() as session:
            session.run("RETURN 1")
        print(f"OK Connected to Neo4j at {args.uri}\n")

        if args.clear:
            exporter.clear_database()

        exporter.create_constraints()
        exporter.export_layers()
        exporter.export_nodes(forecast)
        exporter.export_edges(forecast)
        exporter.export_narratives(forecast)
        exporter.export_scenarios(forecast)
        exporter.create_summary_view()

        print("\n=======================================")
        print("  IMPORT SUMMARY")
        print("=======================================")
        print(f"  Nodes:       {exporter.stats['nodes']}")
        print(f"  Edges:       {exporter.stats['edges']}")
        print(f"  Layers:      {exporter.stats['layers']}")
        print()

        if args.analyze:
            run_analysis_queries(exporter.driver)

        print("=======================================")
        print("  NEXT STEPS")
        print("=======================================")
        print("  1. Open Neo4j Browser: http://localhost:7474")
        print("  2. Run query:")
        print("     MATCH (n:CrucixNode) RETURN n LIMIT 100")
        print("  3. Visualize cross-layer edges:")
        print("     MATCH (a)-[r:CAUSES]->(b) WHERE r.crossLayer = true")
        print("     RETURN a, r, b")
        print("  4. Find propagation paths:")
        print("     MATCH path = (a:CrucixNode {id:'cyberAttack'})-[:CAUSES*1..3]->(end)")
        print("     RETURN path")
        print()

    finally:
        exporter.close()


if __name__ == "__main__":
    main()
