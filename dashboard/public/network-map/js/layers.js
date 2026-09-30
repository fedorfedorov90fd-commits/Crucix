// layers.js — 12 слоёв Network Map (автономно, не 195)
console.log('📚 LAYERS.JS (network-map) загружен — 12 слоёв');

window.allLayers = [
    // === FLOW (7 слоёв) ===
    { id: "cyber-network", name: "🕸️ Кибер-сеть", color: "#f85149", icon: "🕸️", category: "flow", vizType: "graph",
      description: "Граф кибер-узлов: атаки, C2-серверы, ботнеты, инфраструктура" },
    { id: "trade-routes", name: "📦 Торговые пути", color: "#58a6ff", icon: "📦", category: "flow", vizType: "graph",
      description: "Потоки товаров между странами: экспорт, импорт, объёмы" },
    { id: "financial-flows", name: "💰 Финансовые потоки", color: "#3fb950", icon: "💰", category: "flow", vizType: "graph",
      description: "Транзакции, переводы, инвестиционные потоки между юрисдикциями" },
    { id: "crypto-trace", name: "₿ Трассировка крипто", color: "#f0883e", icon: "₿", category: "flow", vizType: "graph",
      description: "Трассировка криптовалютных транзакций, миксеры, обменники" },
    { id: "banking-network", name: "🏦 Банковская сеть", color: "#3fb950", icon: "🏦", category: "flow", vizType: "graph",
      description: "Корреспондентские связи, SWIFT, банковская инфраструктура" },
    { id: "supply-chain", name: "⛓️ Цепочки поставок", color: "#a371f7", icon: "⛓️", category: "flow", vizType: "flow",
      description: "Логистические цепочки, узкие места, зависимости" },
    { id: "shell-companies", name: "🏢 Шелл-компании", color: "#f0883e", icon: "🏢", category: "flow", vizType: "graph",
      description: "Сеть подставных компаний, бенефициары, офшорные связи" },

    // === SOCIAL (5 слоёв) ===
    { id: "refugee-flows", name: "🏃 Потоки беженцев", color: "#f85149", icon: "🏃", category: "social", vizType: "flow",
      description: "Миграционные потоки, направления, объёмы перемещения" },
    { id: "migration-network", name: "🚶 Миграционная сеть", color: "#58a6ff", icon: "🚶", category: "social", vizType: "flow",
      description: "Сеть миграционных коридоров, транзитные страны" },
    { id: "social-unrest", name: "🔥 Очаги напряжённости", color: "#f85149", icon: "🔥", category: "social", vizType: "flow",
      description: "Связи между очагами протестов, распространение" },
    { id: "phone-network", name: "📞 Телефонная сеть", color: "#e3b341", icon: "📞", category: "social", vizType: "flow",
      description: "Анализ телефонных связей, география вызовов" },
    { id: "social-media-network", name: "📱 Соцсети", color: "#58a6ff", icon: "📱", category: "social", vizType: "marker",
      description: "Распространение информации в соцсетях, влияние" }
];

console.log('[layers.js] Загружено слоёв:', window.allLayers.length);
