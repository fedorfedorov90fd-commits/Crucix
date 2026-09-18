// apis/predict/gametheory.mjs
// Теоретико-игровое моделирование геополитики.
//
// Теоретическая основа:
//   von Neumann, J., & Morgenstern, O. (1944). "Theory of Games and
//   Economic Behavior". Princeton University Press.
//   Nash, J. F. (1950). "Equilibrium points in n-person games". PNAS.
//   Maynard Smith, J., & Price, G. R. (1973). "The logic of animal conflict".
//   Nature, 246, 15-18. — ESS.
//   Axelrod, R. (1984). "The Evolution of Cooperation". Basic Books.
//   von Stackelberg, H. (1934). "Marktform und Gleichgewicht". Springer.
//   Shapley, L. S. (1953). "Stochastic Games". PNAS, 39(10), 1095-1100.
//
// Применение в Crucix:
//   Моделирование действий противника. Стекльберг — для "лидер-последователь".
//   Nash — для равновесий. Стохастические игры — для многошаговых
//   взаимодействий. Deception modeling — противник может обманывать.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Stackelberg — лидер-последователь
// ============================================================

class StackelbergGame {
  constructor(config = {}) {
    this.leaderActions = config.leaderActions || [
      'forecast_high', 'forecast_medium', 'forecast_low', 'withhold',
    ];
    this.followerActions = config.followerActions || [
      'escalate', 'maintain', 'deescalate', 'deceive',
    ];
    this.payoffMatrix = config.payoffMatrix || this._defaultPayoffs();
    this.followerRationality = config.followerRationality !== undefined
      ? config.followerRationality : 0.7;
  }

  _defaultPayoffs() {
    const P = {};
    for (const la of this.leaderActions) {
      P[la] = {};
      for (const fa of this.followerActions) {
        let leaderPay = 0.5, followerPay = 0.5;

        if (la === 'forecast_high' && fa === 'escalate') leaderPay = 0.9;
        else if (la === 'forecast_high' && fa === 'deescalate') leaderPay = 0.2;
        else if (la === 'forecast_low' && fa === 'deescalate') leaderPay = 0.9;
        else if (la === 'forecast_low' && fa === 'escalate') leaderPay = 0.2;
        else if (la === 'withhold') leaderPay = 0.5;

        if (fa === 'escalate') followerPay = la === 'forecast_high' ? 0.3 : 0.8;
        else if (fa === 'deescalate') followerPay = la === 'forecast_low' ? 0.7 : 0.4;
        else if (fa === 'maintain') followerPay = 0.6;
        else if (fa === 'deceive') followerPay = la === 'forecast_high' ? 0.85 : 0.5;

        P[la][fa] = [leaderPay, followerPay];
      }
    }
    return P;
  }

  solve() {
    const results = [];
    for (const la of this.leaderActions) {
      let bestFollower = this.followerActions[0];
      let bestFollowerPay = -Infinity;
      for (const fa of this.followerActions) {
        const fp = this.payoffMatrix[la][fa][1];
        const adjustedPay =
          fp * this.followerRationality +
          Math.random() * (1 - this.followerRationality);
        if (adjustedPay > bestFollowerPay) {
          bestFollowerPay = adjustedPay;
          bestFollower = fa;
        }
      }
      const leaderPay = this.payoffMatrix[la][bestFollower][0];
      results.push({
        leaderAction: la,
        followerResponse: bestFollower,
        leaderPayoff: leaderPay,
      });
    }

    const best = results.reduce((a, b) =>
      a.leaderPayoff > b.leaderPayoff ? a : b
    );

    return {
      type: 'stackelberg',
      leaderStrategy: best.leaderAction,
      followerResponse: best.followerResponse,
      leaderPayoff: best.leaderPayoff,
      allScenarios: results,
    };
  }
}

// ============================================================
// Nash equilibrium
// ============================================================

function findNashEquilibrium(actions1, actions2, payoffMatrix) {
  const bestResponse1 = {};
  const bestResponse2 = {};

  for (const a2 of actions2) {
    let best = actions1[0], bestPay = -Infinity;
    for (const a1 of actions1) {
      const pay = payoffMatrix[a1][a2][0];
      if (pay > bestPay) { bestPay = pay; best = a1; }
    }
    bestResponse1[a2] = best;
  }

  for (const a1 of actions1) {
    let best = actions2[0], bestPay = -Infinity;
    for (const a2 of actions2) {
      const pay = payoffMatrix[a1][a2][1];
      if (pay > bestPay) { bestPay = pay; best = a2; }
    }
    bestResponse2[a1] = best;
  }

  const equilibria = [];
  for (const a1 of actions1) {
    const a2 = bestResponse2[a1];
    if (bestResponse1[a2] === a1) {
      equilibria.push({ a1, a2, payoffs: payoffMatrix[a1][a2] });
    }
  }

  return { equilibria, bestResponse1, bestResponse2 };
}

// ============================================================
// Stochastic Game — многоагентная марковская игра
// ============================================================

class StochasticGame {
  constructor(config = {}) {
    this.states = config.states || ['peace', 'tension', 'crisis', 'war', 'ceasefire'];
    this.agents = config.agents || ['red', 'blue', 'neutral'];
    this.actions = config.actions || {
      red: ['escalate', 'hold', 'retreat'],
      blue: ['escalate', 'hold', 'retreat'],
      neutral: ['mediate', 'observe'],
    };
    this.discount = config.discount || 0.95;
    this.transitionProbs = config.transitions || this._defaultTransitions();
    this.rewardMatrix = config.rewards || this._defaultRewards();
    this.horizon = config.horizon || 20;
  }

  _defaultTransitions() {
    const T = {};
    for (const s of this.states) {
      T[s] = {};
      for (const a of this.states) {
        T[s][a] = {};
        for (const target of this.states) {
          T[s][a][target] = 1 / this.states.length;
        }
        T[s][a][s] = 0.4;
      }
    }
    if (T['tension']) {
      T['tension']['tension'] = {
        peace: 0.15, tension: 0.4, crisis: 0.3, war: 0.1, ceasefire: 0.05,
      };
      T['tension']['crisis'] = {
        peace: 0.05, tension: 0.15, crisis: 0.5, war: 0.25, ceasefire: 0.05,
      };
    }
    return T;
  }

  _defaultRewards() {
    const R = {};
    for (const s of this.states) {
      R[s] = {};
      for (const a of this.agents) {
        R[s][a] = {};
        for (const act of this.actions[a]) {
          if (s === 'war') R[s][a][act] = act === 'retreat' ? 0.3 : -0.5;
          else if (s === 'crisis') R[s][a][act] = act === 'retreat' ? 0.4 : act === 'hold' ? 0.0 : -0.3;
          else if (s === 'tension') R[s][a][act] = act === 'hold' ? 0.2 : act === 'escalate' ? -0.2 : 0.1;
          else R[s][a][act] = act === 'hold' ? 0.3 : 0.1;
        }
      }
    }
    return R;
  }

  solve(maxIter = 100, tolerance = 1e-6) {
    let V = {};
    for (const s of this.states) {
      V[s] = {};
      for (const a of this.agents) V[s][a] = 0;
    }

    let policy = {};
    for (const s of this.states) {
      policy[s] = {};
      for (const a of this.agents) policy[s][a] = this.actions[a][0];
    }

    for (let iter = 0; iter < maxIter; iter++) {
      const newV = {};
      let maxDiff = 0;

      for (const s of this.states) {
        newV[s] = {};
        for (const agent of this.agents) {
          let bestVal = -Infinity;
          let bestAct = this.actions[agent][0];

          for (const act of this.actions[agent]) {
            let val = (this.rewardMatrix[s] &&
                       this.rewardMatrix[s][agent] &&
                       this.rewardMatrix[s][agent][act]) || 0;
            const transitions = (this.transitionProbs[s] &&
                                this.transitionProbs[s][s]) || {};
            for (const [sNext, prob] of Object.entries(transitions)) {
              val += this.discount * prob * ((V[sNext] && V[sNext][agent]) || 0);
            }
            if (val > bestVal) { bestVal = val; bestAct = act; }
          }
          newV[s][agent] = bestVal;
          policy[s][agent] = bestAct;
          maxDiff = Math.max(maxDiff, Math.abs(bestVal - ((V[s] && V[s][agent]) || 0)));
        }
      }

      V = newV;
      if (maxDiff < tolerance) break;
    }

    return { values: V, policy, discount: this.discount };
  }

  modelDeception(trueIntent, observedAction, deceptionProb) {
    const confidenceInObserved = 1 - deceptionProb;
    return {
      trueIntent,
      observedAction,
      deceptionProb,
      inferenceConfidence: confidenceInObserved,
      adjustedBelief:
        deceptionProb * 0.5 +
        confidenceInObserved * (observedAction === trueIntent ? 0.9 : 0.1),
    };
  }
}

// ============================================================
// Готовый цикл для Crucix
// ============================================================

function crucixGameTheoryAnalysis(latest, options = {}) {
  const vix = (latest && latest.fred && latest.fred.vix) || 20;
  const conflicts =
    latest && latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)
      ? latest.gdelt.conflictEvents.length
      : 0;
  const sanctions = (latest && latest.sanctions && latest.sanctions.count) || 0;

  let currentState = 'peace';
  if (vix > 35 || conflicts > 15) currentState = 'war';
  else if (vix > 30 || conflicts > 10) currentState = 'crisis';
  else if (vix > 22 || conflicts > 5 || sanctions > 3) currentState = 'tension';
  else if (vix < 18 && conflicts < 2) currentState = 'peace';

  const stackelberg = new StackelbergGame({
    leaderActions: ['forecast_high', 'forecast_medium', 'forecast_low', 'withhold'],
    followerActions: ['escalate', 'maintain', 'deescalate', 'deceive'],
    followerRationality: options.followerRationality || 0.7,
  });
  const stackelbergSol = stackelberg.solve();

  const stochGame = new StochasticGame({
    states: ['peace', 'tension', 'crisis', 'war', 'ceasefire'],
    agents: ['red', 'blue', 'neutral'],
    horizon: 20,
    discount: 0.95,
  });
  const stochSol = stochGame.solve();

  const deception = stochGame.modelDeception(
    (stochSol.policy[currentState] && stochSol.policy[currentState].red) || 'hold',
    options.observedAction || 'hold',
    options.deceptionProb || 0.3
  );

  const result = {
    module: 'gametheory',
    currentState,
    stackelberg: stackelbergSol,
    stochasticGame: {
      values: stochSol.values,
      policy: stochSol.policy,
      recommendedAction: stochSol.policy[currentState],
    },
    deception,
    timestamp: new Date().toISOString(),
  };

  try {
    const dir = join(__dirname, '..', '..', 'runs', 'predictions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `gametheory_${Date.now()}.json`), JSON.stringify(result, null, 2));
  } catch (e) {
    // Работает даже без диска
  }

  return result;
}

export {
  StackelbergGame,
  StochasticGame,
  findNashEquilibrium,
  crucixGameTheoryAnalysis,
};
