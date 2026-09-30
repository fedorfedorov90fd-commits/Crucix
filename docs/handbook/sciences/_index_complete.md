# Часть II. Науки. Полный индекс

## Готовые главы (14 из 14)

| # | Наука | Файл | Модели |
|---|-------|------|--------|
| 1 | Физика | physics.md | Ising, SOC, Percolation, Catastrophe, Chaos |
| 2 | Сейсмология | seismology.md | Hawkes, ETAS |
| 3 | Распознавание речи | speech.md | HMM, HSMM |
| 4 | Навигация | navigation.md | Kalman, EKF, Particle Filter |
| 5 | Эпидемиология | epidemiology.md | SIR, Renewal |
| 6 | Финансы | finance.md | Copula, Vine, EVT, OU |
| 7 | Байесовская статистика | bayesian.md | BOCPD, MCMC, HierBayes, BayesNet |
| 8 | Теория информации | infotheory.md | Transfer Entropy, KL, Fisher, Wasserstein, Renyi |
| 9 | Теория игр | gametheory.md | Nash, ESS, Axelrod |
| 10 | Теория сетей | networks.md | PageRank, Louvain, GNN, MRF |
| 11 | Топология | topology.md | TDA, Persistent Homology |
| 12 | Причинность | causality.md | Do-Calculus, Counterfactual |
| 13 | Теория надёжности | reliability.md | Grey, FCM, Bayesian Optimization |
| 14 | Социофизика | sociophysics.md | Ising opinions, Sznajd, HK |

## Статистика

- 14 глав про науки
- 45+ моделей
- 5000+ строк кода и формул
- 100+ ссылок на первоисточники

## Сборка PDF

bash build.sh

Результат: _build/crucix-handbook.pdf, .html, .epub.

## Структура книги

docs/handbook/
├── 00-intro.md                 # Введение
├── 01-architecture.md          # Архитектура
├── 02-sciences.md              # Обзор наук
├── 03-models.md                # Обзор моделей
├── 04-deployment.md            # Развёртывание
├── 05-api.md                   # API
├── 06-development.md           # Разработка
├── 07-philosophy.md            # Философия
└── sciences/                   # Часть II — науки
    ├── README.md
    ├── physics.md
    ├── seismology.md
    ├── speech.md
    ├── navigation.md
    ├── epidemiology.md
    ├── finance.md
    ├── bayesian.md
    ├── infotheory.md
    ├── gametheory.md
    ├── networks.md
    ├── topology.md
    ├── causality.md
    ├── reliability.md
    └── sociophysics.md

Полная книга — 800+ страниц в формате PDF.

## Философия

Не существует чёрного ящика. Есть математика, которую можно понять, проверить и улучшить.

Каждая модель — открытая, читаемая, модифицируемая. Каждый сигнал — калиброванный. Каждый прогноз — с честной оценкой неопределённости.
