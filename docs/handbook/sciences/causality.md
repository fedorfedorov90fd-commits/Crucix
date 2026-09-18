# Глава 15. Причинность

Корреляция не подразумевает причинность.

Это утверждение верно. Но как доказать причинность? Pearl (2000) дал строгий формализм: do-calculus.

Crucix использует:

1. Structural Causal Models — SCM
2. Do-calculus — интервенции
3. Counterfactual reasoning — что было бы, если...

## 15.1 Structural Causal Models

### Теория

SCM = набор структурных уравнений:

X_i = f_i(parents(X_i), U_i)

где:
- X_i — переменная
- parents(X_i) — прямые причины
- U_i — экзогенный шум

Граф причинности — DAG, где рёбра = прямые причинные связи.

### Применение в Crucix

SCM для геополитики:

ConflictLevel -> VIX -> CreditStress -> Crisis
ConflictLevel -> SanctionsPressure -> SupplyChainStress -> Crisis

### Что это даёт

Позволяет моделировать систему как набор причинных связей и отвечать на вопросы интервенций.

## 15.2 Do-Calculus

### Теория

Pearl (1995). Разница между:

- P(Y | X = x) — наблюдательная условная вероятность
- P(Y | do(X = x)) — интервенционная

Ключевое: P(Y | X) не равно P(Y | do(X)) при наличии confounders.

Counterfactual — 3 шага Pearl:

1. Abduction: infer exogenous noise from observed
2. Action: change X
3. Prediction: recompute Y with noise

### Применение в Crucix

Ответ на вопрос: Что было бы, если бы конфликт был другим?

### Что это даёт

Counterfactual анализ:

Observed: crisis = 1 (уже случился)

Counterfactuals:
  If no conflict: crisis = 0 (не было бы)
  If VIX = 20: crisis = 0 (не было бы)

Probabilities:
  P(crisis | conflict = 1) = 0.68
  P(crisis | conflict = 0) = 0.12

Attribution: conflict contribution = 82%

Интерпретация: 82% кризиса объясняется конфликтом. Устранение конфликта устранило бы кризис.

Правило: attribution > 0.6 — конфликт главный драйвер.

## 15.3 Итог

| Метод | Что показывает | Когда критично |
|-------|----------------|----------------|
| SCM | Граф причинности | Структура |
| Do-Calculus | Эффект интервенции | P(Y do) не равно P(Y X) |
| Counterfactual | Что было бы, если | Attribution > 0.6 |

Композитная логика: причинный анализ отвечает на вопрос почему, в отличие от корреляционного что.

Практическая польза: если attribution = 82% для конфликта — фокус на деэскалацию, а не на финансовые меры.

## 15.4 Литература

- Pearl, J. (2000). Causality: Models, Reasoning, and Inference. Cambridge University Press.
- Pearl, J. (1995). Causal diagrams for empirical research. Biometrika.
- Peters, J., Janzing, D., & Scholkopf, B. (2017). Elements of Causal Inference. MIT Press.
