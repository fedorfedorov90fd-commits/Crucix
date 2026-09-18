// apis/predict/opponent_ppo.mjs
//
// Opponent Modeling with Deep Reinforcement Learning (PPO)
// Обучение модели противника через Proximal Policy Optimization.
//
// Теоретическая основа:
//   - Schulman et al. (2017). "Proximal Policy Optimization Algorithms"
//     arXiv:1707.06347. -- PPO-clip objective.
//   - Foerster et al. (2018). "Counterfactual Multi-Agent Policy Gradients"
//     AAAI. -- MARL для моделирования противника.
//   - Lowe et al. (2017). "Multi-Agent Actor-Critic for Mixed
//     Cooperative-Competitive Environments" NeurIPS.
//
// Ключевая идея:
//   Классические Opponent Models (байесовские) предполагают дискретные
//   стратегии. PPO-агент моделирует противника как непрерывную политику
//   pi(a|s) с обучением на траекториях.
//
// Архитектура:
//   Actor: MLP [state_dim] -> [hidden] -> [action_dim] -> softmax
//   Critic: MLP [state_dim] -> [hidden] -> [1] -> V(s)
//
// PPO-clip objective:
//   L^CLIP(theta) = E[ min( r_t(theta) * A_t, clip(r_t(theta), 1-eps, 1+eps) * A_t ) ]
//   где r_t(theta) = pi_theta(a_t|s_t) / pi_theta_old(a_t|s_t)
//
// State: [observation of our strategy, environment tension, our prediction]
// Action: [escalate, hold, deescalate, deceive]

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === MLP CORE ===

class MLP {
  constructor(inputDim, hiddenDim, outputDim, seed = 42) {
    this.inputDim = inputDim;
    this.hiddenDim = hiddenDim;
    this.outputDim = outputDim;

    // Xavier init
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const initMatrix = (rows, cols) => {
      const scale = Math.sqrt(2 / rows);
      const M = [];
      for (let i = 0; i < rows; i++) {
        const row = new Float64Array(cols);
        for (let j = 0; j < cols; j++) {
          const u1 = rand(), u2 = rand();
          const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
          row[j] = z * scale;
        }
        M.push(row);
      }
      return M;
    };

    this.W1 = initMatrix(hiddenDim, inputDim);
    this.b1 = new Float64Array(hiddenDim);
    this.W2 = initMatrix(outputDim, hiddenDim);
    this.b2 = new Float64Array(outputDim);
  }

  forward(x) {
    const h = new Float64Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      let sum = this.b1[i];
      for (let j = 0; j < this.inputDim; j++) sum += this.W1[i][j] * x[j];
      h[i] = Math.max(0, sum); // ReLU
    }
    const out = new Float64Array(this.outputDim);
    for (let i = 0; i < this.outputDim; i++) {
      let sum = this.b2[i];
      for (let j = 0; j < this.hiddenDim; j++) sum += this.W2[i][j] * h[j];
      out[i] = sum;
    }
    return { output: out, hidden: h };
  }

  /**
   * Backprop through MLP с заданным dOutput.
   * @returns {dW1, db1, dW2, db2} -- gradients
   */
  backward(x, hidden, dOutput) {
    const dW2 = this.W2.map(row => new Float64Array(row.length));
    const db2 = new Float64Array(this.b2.length);
    const dHidden = new Float64Array(this.hiddenDim);

    // dW2, db2
    for (let i = 0; i < this.outputDim; i++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        dW2[i][j] = dOutput[i] * hidden[j];
      }
      db2[i] = dOutput[i];
    }

    // dHidden
    for (let j = 0; j < this.hiddenDim; j++) {
      let sum = 0;
      for (let i = 0; i < this.outputDim; i++) {
        sum += dOutput[i] * this.W2[i][j];
      }
      dHidden[j] = hidden[j] > 0 ? sum : 0; // ReLU derivative
    }

    // dW1, db1
    const dW1 = this.W1.map(row => new Float64Array(row.length));
    const db1 = new Float64Array(this.b1.length);
    for (let i = 0; i < this.hiddenDim; i++) {
      for (let j = 0; j < this.inputDim; j++) {
        dW1[i][j] = dHidden[i] * x[j];
      }
      db1[i] = dHidden[i];
    }

    return { dW1, db1, dW2, db2 };
  }
}

// === PPO AGENT ===

class PPOAgent {
  constructor(config) {
    this.stateDim = config.stateDim || 6;
    this.actionDim = config.actionDim || 4;
    this.hiddenDim = config.hiddenDim || 32;
    this.learningRate = config.learningRate || 0.001;
    this.clipEpsilon = config.clipEpsilon || 0.2;
    this.entropyCoef = config.entropyCoef || 0.01;
    this.valueCoef = config.valueCoef || 0.5;
    this.gamma = config.gamma || 0.99;
    this.lambda = config.lambda || 0.95;
    this.epochs = config.epochs || 10;
    this.batchSize = config.batchSize || 32;

    // Actor (policy)
    this.actor = new MLP(this.stateDim, this.hiddenDim, this.actionDim, 42);
    // Critic (value)
    this.critic = new MLP(this.stateDim, this.hiddenDim, 1, 43);

    // Adam state для actor
    this.actorM = {
      W1: this.actor.W1.map(row => new Float64Array(row.length)),
      b1: new Float64Array(this.actor.b1.length),
      W2: this.actor.W2.map(row => new Float64Array(row.length)),
      b2: new Float64Array(this.actor.b2.length),
    };
    this.actorV = {
      W1: this.actor.W1.map(row => new Float64Array(row.length)),
      b1: new Float64Array(this.actor.b1.length),
      W2: this.actor.W2.map(row => new Float64Array(row.length)),
      b2: new Float64Array(this.actor.b2.length),
    };

    // Adam state для critic
    this.criticM = {
      W1: this.critic.W1.map(row => new Float64Array(row.length)),
      b1: new Float64Array(this.critic.b1.length),
      W2: this.critic.W2.map(row => new Float64Array(row.length)),
      b2: new Float64Array(this.critic.b2.length),
    };
    this.criticV = {
      W1: this.critic.W1.map(row => new Float64Array(row.length)),
      b1: new Float64Array(this.critic.b1.length),
      W2: this.critic.W2.map(row => new Float64Array(row.length)),
      b2: new Float64Array(this.critic.b2.length),
    };

    this.actorT = 0;
    this.criticT = 0;
  }

  /**
   * Softmax policy pi(a|s).
   */
  policy(state) {
    const { output } = this.actor.forward(state);
    const maxOut = Math.max(...output);
    const exps = Array.from(output).map(v => Math.exp(v - maxOut));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }

  /**
   * Value V(s).
   */
  value(state) {
    return this.critic.forward(state).output[0];
  }

  /**
   * Sample action согласно policy.
   */
  sampleAction(state) {
    const probs = this.policy(state);
    let r = Math.random();
    let cum = 0;
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (r < cum) return { action: i, probability: probs[i], probs };
    }
    return { action: probs.length - 1, probability: probs[probs.length - 1], probs };
  }

  /**
   * PPO update на батче траекторий.
   */
  update(trajectories) {
    if (trajectories.length < 4) return { updated: false, reason: 'insufficient_trajectories' };

    // Вычисляем advantages через GAE (Generalized Advantage Estimation)
    const { advantages, returns } = this._computeGAE(trajectories);

    // Нормализация advantages
    const meanAdv = advantages.reduce((a, b) => a + b, 0) / advantages.length;
    const stdAdv = Math.sqrt(
      advantages.reduce((s, a) => s + (a - meanAdv) ** 2, 0) / advantages.length
    ) || 1;
    const normalizedAdv = advantages.map(a => (a - meanAdv) / stdAdv);

    // Сохраняем old probs для ratio
    const oldProbs = trajectories.map(t => t.probability);

    let totalPolicyLoss = 0;
    let totalValueLoss = 0;
    let totalEntropy = 0;
    let updates = 0;

    // PPO epochs
    for (let epoch = 0; epoch < this.epochs; epoch++) {
      // Перемешиваем
      const indices = Array.from({ length: trajectories.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let start = 0; start < trajectories.length; start += this.batchSize) {
        const batchIdx = indices.slice(start, start + this.batchSize);

        for (const idx of batchIdx) {
          const traj = trajectories[idx];
          const state = traj.state;
          const action = traj.action;
          const adv = normalizedAdv[idx];
          const ret = returns[idx];
          const oldProb = oldProbs[idx];

          // New policy
          const { output: actorOut, hidden: actorHidden } = this.actor.forward(state);
          const maxOut = Math.max(...actorOut);
          const exps = Array.from(actorOut).map(v => Math.exp(v - maxOut));
          const sumExp = exps.reduce((a, b) => a + b, 0);
          const newProbs = exps.map(e => e / sumExp);
          const newProb = newProbs[action];

          // Ratio r_t(theta)
          const ratio = newProb / (oldProb + 1e-10);

          // PPO-clip objective
          const surr1 = ratio * adv;
          const surr2 = Math.max(Math.min(ratio, 1 + this.clipEpsilon), 1 - this.clipEpsilon) * adv;
          const policyLoss = -Math.min(surr1, surr2);

          // Entropy (encourages exploration)
          const entropy = -newProbs.reduce((s, p) => s + (p > 0 ? p * Math.log(p + 1e-10) : 0), 0);

          // Value loss
          const { output: criticOut, hidden: criticHidden } = this.critic.forward(state);
          const valuePred = criticOut[0];
          const valueLoss = (valuePred - ret) ** 2;

          totalPolicyLoss += policyLoss;
          totalValueLoss += valueLoss;
          totalEntropy += entropy;

          // === Backprop Actor ===
          // dL/dActorOut: производная policy loss по логитам
          // Упрощённо: градиент через softmax
          const dActorOut = new Float64Array(this.actionDim);
          for (let i = 0; i < this.actionDim; i++) {
            // Для clipped objective используем простой gradient
            const gradLogPi = (i === action ? 1 : 0) - newProbs[i];
            const dLoss_dRatio = ratio < 1 - this.clipEpsilon || ratio > 1 + this.clipEpsilon
              ? 0  // clipped -- no gradient
              : adv;
            dActorOut[i] = dLoss_dRatio * gradLogPi * newProbs[action] / (oldProb + 1e-10);
          }

          // Entropy gradient
          for (let i = 0; i < this.actionDim; i++) {
            const entGrad = -newProbs[i] * (Math.log(newProbs[i] + 1e-10) + entropy);
            dActorOut[i] += this.entropyCoef * entGrad;
          }

          const actorGrads = this.actor.backward(state, actorHidden, dActorOut);
          this._adamUpdateActor(actorGrads);

          // === Backprop Critic ===
          const dCriticOut = new Float64Array(1);
          dCriticOut[0] = 2 * (valuePred - ret) * this.valueCoef;
          const criticGrads = this.critic.backward(state, criticHidden, dCriticOut);
          this._adamUpdateCritic(criticGrads);

          updates++;
        }
      }
    }

    return {
      updated: true,
      updates,
      avgPolicyLoss: totalPolicyLoss / Math.max(updates, 1),
      avgValueLoss: totalValueLoss / Math.max(updates, 1),
      avgEntropy: totalEntropy / Math.max(updates, 1),
    };
  }

  _computeGAE(trajectories) {
    const advantages = [];
    const returns = [];

    // Сортировка по времени
    const sorted = [...trajectories].sort((a, b) => a.timestamp - b.timestamp);

    let gae = 0;
    for (let t = sorted.length - 1; t >= 0; t--) {
      const traj = sorted[t];
      const nextValue = t < sorted.length - 1
        ? this.value(sorted[t + 1].state)
        : 0;
      const delta = traj.reward + this.gamma * nextValue - this.value(traj.state);
      gae = delta + this.gamma * this.lambda * gae;
      advantages.unshift(gae);
      returns.unshift(gae + this.value(traj.state));
    }

    return { advantages, returns };
  }

  _adamUpdateActor(grads, beta1 = 0.9, beta2 = 0.999, eps = 1e-8) {
    this.actorT++;
    const bc1 = 1 - Math.pow(beta1, this.actorT);
    const bc2 = 1 - Math.pow(beta2, this.actorT);

    const update = (param, m, v, grad) => {
      for (let i = 0; i < param.length; i++) {
        m[i] = beta1 * m[i] + (1 - beta1) * grad[i];
        v[i] = beta2 * v[i] + (1 - beta2) * grad[i] * grad[i];
        const mHat = m[i] / bc1;
        const vHat = v[i] / bc2;
        param[i] -= this.learningRate * mHat / (Math.sqrt(vHat) + eps);
      }
    };

    // W1
    for (let i = 0; i < this.actor.W1.length; i++) {
      update(this.actor.W1[i], this.actorM.W1[i], this.actorV.W1[i], grads.dW1[i]);
    }
    update(this.actor.b1, this.actorM.b1, this.actorV.b1, grads.db1);
    for (let i = 0; i < this.actor.W2.length; i++) {
      update(this.actor.W2[i], this.actorM.W2[i], this.actorV.W2[i], grads.dW2[i]);
    }
    update(this.actor.b2, this.actorM.b2, this.actorV.b2, grads.db2);
  }

  _adamUpdateCritic(grads, beta1 = 0.9, beta2 = 0.999, eps = 1e-8) {
    this.criticT++;
    const bc1 = 1 - Math.pow(beta1, this.criticT);
    const bc2 = 1 - Math.pow(beta2, this.criticT);

    const update = (param, m, v, grad) => {
      for (let i = 0; i < param.length; i++) {
        m[i] = beta1 * m[i] + (1 - beta1) * grad[i];
        v[i] = beta2 * v[i] + (1 - beta2) * grad[i] * grad[i];
        const mHat = m[i] / bc1;
        const vHat = v[i] / bc2;
        param[i] -= this.learningRate * mHat / (Math.sqrt(vHat) + eps);
      }
    };

    for (let i = 0; i < this.critic.W1.length; i++) {
      update(this.critic.W1[i], this.criticM.W1[i], this.criticV.W1[i], grads.dW1[i]);
    }
    update(this.critic.b1, this.criticM.b1, this.criticV.b1, grads.db1);
    for (let i = 0; i < this.critic.W2.length; i++) {
      update(this.critic.W2[i], this.criticM.W2[i], this.criticV.W2[i], grads.dW2[i]);
    }
    update(this.critic.b2, this.criticM.b2, this.criticV.b2, grads.db2);
  }

  /**
   * Сериализация.
   */
  toJSON() {
    return {
      config: {
        stateDim: this.stateDim,
        actionDim: this.actionDim,
        hiddenDim: this.hiddenDim,
      },
      actor: {
        W1: this.actor.W1.map(r => Array.from(r)),
        b1: Array.from(this.actor.b1),
        W2: this.actor.W2.map(r => Array.from(r)),
        b2: Array.from(this.actor.b2),
      },
      critic: {
        W1: this.critic.W1.map(r => Array.from(r)),
        b1: Array.from(this.critic.b1),
        W2: this.critic.W2.map(r => Array.from(r)),
        b2: Array.from(this.critic.b2),
      },
      actorT: this.actorT,
      criticT: this.criticT,
    };
  }

  static fromJSON(data) {
    const agent = new PPOAgent(data.config);
    agent.actor.W1 = data.actor.W1.map(r => new Float64Array(r));
    agent.actor.b1 = new Float64Array(data.actor.b1);
    agent.actor.W2 = data.actor.W2.map(r => new Float64Array(r));
    agent.actor.b2 = new Float64Array(data.actor.b2);
    agent.critic.W1 = data.critic.W1.map(r => new Float64Array(r));
    agent.critic.b1 = new Float64Array(data.critic.b1);
    agent.critic.W2 = data.critic.W2.map(r => new Float64Array(r));
    agent.critic.b2 = new Float64Array(data.critic.b2);
    agent.actorT = data.actorT || data.t || 0;
    agent.criticT = data.criticT || data.t || 0;
    return agent;
  }
}

// === ENVIRONMENT ===

/**
 * Adversarial Environment для симуляции.
 *
 * Противник (PPO-агент) наблюдает:
 *   state[0]: наша стратегия (encoded)
 *   state[1]: tension (0..1)
 *   state[2]: наша уверенность (0..1)
 *   state[3]: время с последнего действия (нормализовано)
 *   state[4]: наша история агрессии (EMA)
 *   state[5]: bias (bias = -1 всегда escalate, bias = +1 всегда deescalate)
 *
 * Действия:
 *   0: escalate
 *   1: hold
 *   2: deescalate
 *   3: deceive
 *
 * Награда:
 *   - Если противник использовал deception и мы не заметили: +1
 *   - Если противник escalate и мы не ответили: +0.5
 *   - Если противник deescalate и мы ответили агрессивно: -1
 *   - Противник maximize (его payoff)
 */
class AdversarialEnv {
  constructor(config = {}) {
    this.tension = config.initialTension || 0.5;
    this.steps = 0;
    this.maxSteps = config.maxSteps || 50;
    this.ourHistoryAggression = 0.5;
  }

  reset() {
    this.tension = 0.5;
    this.steps = 0;
    this.ourHistoryAggression = 0.5;
  }

  /**
   * Один шаг: противник выбирает действие, среда возвращает reward и nextState.
   */
  step(action, ourStrategy) {
    this.steps++;

    // Encode our strategy
    const ourStratEnc = {
      forecast_high: -1,
      forecast_low: 1,
      withhold: 0,
      deceive: -0.5,
    }[ourStrategy] || 0;

    // Reward calculation (adversarial)
    let reward = 0;
    if (action === 0) {  // escalate
      // Если мы "forecast_low" -- противник выиграл
      reward += ourStratEnc > 0 ? 1.0 : 0.5;
      this.tension = Math.min(1, this.tension + 0.1);
    } else if (action === 1) {  // hold
      reward += 0.2;
    } else if (action === 2) {  // deescalate
      reward += ourStratEnc > 0 ? 0.8 : -0.3;
      this.tension = Math.max(0, this.tension - 0.05);
    } else if (action === 3) {  // deceive
      // Deception успешно, если мы не ожидаем
      reward += ourStratEnc < 0 ? 1.2 : 0.3;
    }

    // Reward за удержание тензии в зоне противника
    if (this.tension > 0.6 && this.tension < 0.9) reward += 0.2;

    // Обновляем нашу историю агрессии
    this.ourHistoryAggression = 0.9 * this.ourHistoryAggression +
      0.1 * (ourStratEnc < 0 ? 1 : 0);

    const nextState = this._getState(ourStrategy);
    const done = this.steps >= this.maxSteps;

    return { nextState, reward, done };
  }

  _getState(ourStrategy) {
    const ourStratEnc = {
      forecast_high: -1,
      forecast_low: 1,
      withhold: 0,
      deceive: -0.5,
    }[ourStrategy] || 0;

    return new Float64Array([
      ourStratEnc,
      this.tension,
      0.7,  // наша уверенность (упрощённо)
      Math.min(1, this.steps / 50),
      this.ourHistoryAggression,
      0.5,  // bias
    ]);
  }
}

// === TRAINING LOOP ===

/**
 * Обучение PPO-агента для моделирования противника.
 *
 * @param {object} opts
 * @param {number} opts.episodes -- количество эпизодов
 * @param {number} opts.updateEvery -- обновлять каждые N эпизодов
 * @returns {PPOAgent}
 */
export function trainOpponentPPO(opts = {}) {
  const {
    episodes = 50,
    updateEvery = 5,
    maxStepsPerEpisode = 30,
    ourStrategies = ['forecast_high', 'forecast_low', 'withhold', 'deceive'],
    verbose = false,
  } = opts;

  const agent = new PPOAgent({
    stateDim: 6,
    actionDim: 4,
    hiddenDim: 32,
    learningRate: 0.001,
    clipEpsilon: 0.2,
  });

  const env = new AdversarialEnv({ maxSteps: maxStepsPerEpisode });
  const trajectories = [];
  const history = [];

  for (let episode = 0; episode < episodes; episode++) {
    env.reset();
    let ourStrategy = ourStrategies[Math.floor(Math.random() * ourStrategies.length)];
    let episodeReward = 0;
    let steps = 0;

    while (steps < maxStepsPerEpisode) {
      const state = env._getState(ourStrategy);
      const { action, probability } = agent.sampleAction(state);
      const { nextState, reward, done } = env.step(action, ourStrategy);

      trajectories.push({
        state,
        action,
        probability,
        reward,
        timestamp: Date.now() + steps,
      });

      // Меняем нашу стратегию случайно каждые 5 шагов
      if (steps % 5 === 0) {
        ourStrategy = ourStrategies[Math.floor(Math.random() * ourStrategies.length)];
      }

      episodeReward += reward;
      steps++;
      if (done) break;
    }

    history.push({ episode, episodeReward, steps });

    // PPO update
    if ((episode + 1) % updateEvery === 0 && trajectories.length > 0) {
      const updateResult = agent.update(trajectories);
      trajectories.length = 0;

      if (verbose) {
        console.log(`[opponent-PPO] Episode ${episode + 1}, reward: ${episodeReward.toFixed(2)}, policyLoss: ${updateResult.avgPolicyLoss?.toFixed(4)}, entropy: ${updateResult.avgEntropy?.toFixed(4)}`);
      }
    }
  }

  return {
    agent,
    history,
    finalReward: history[history.length - 1]?.episodeReward || 0,
    avgReward: history.reduce((s, h) => s + h.episodeReward, 0) / history.length,
  };
}

// === ИНТЕГРАЦИЯ С CRUCIX ===

export function crucixOpponentPPO(history, opts = {}) {
  const filepath = join(__dirname, '..', '..', 'runs', 'predictions', 'opponent_ppo.json');

  let agent;
  let trainingHistory = [];

  // Загрузка существующего агента или обучение
  if (existsSync(filepath) && !opts.retrain) {
    try {
      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      agent = PPOAgent.fromJSON(data.agent);
      trainingHistory = data.trainingHistory || [];
    } catch (e) {
      console.warn('[opponent-PPO] Load error:', e.message);
      agent = null;
    }
  }

  if (!agent) {
    const training = trainOpponentPPO({
      episodes: opts.episodes || 30,
      updateEvery: 5,
      maxStepsPerEpisode: 25,
      verbose: false,
    });
    agent = training.agent;
    trainingHistory = training.history;
  }

  // Анализ обученной политики
  const strategies = ['escalate', 'hold', 'deescalate', 'deceive'];
  const strategyProbs = {};

  // Усредняем политику по нескольким состояниям
  const testStates = [
    { our: 'forecast_high', tension: 0.3, bias: 0.5 },
    { our: 'forecast_high', tension: 0.7, bias: 0.5 },
    { our: 'forecast_low', tension: 0.3, bias: 0.5 },
    { our: 'forecast_low', tension: 0.7, bias: 0.5 },
    { our: 'withhold', tension: 0.5, bias: 0.5 },
    { our: 'deceive', tension: 0.5, bias: 0.5 },
  ];

  const ourStratEncMap = {
    forecast_high: -1, forecast_low: 1, withhold: 0, deceive: -0.5,
  };

  const policyBySituation = {};
  for (const s of testStates) {
    const state = new Float64Array([
      ourStratEncMap[s.our], s.tension, 0.7, 0.3, 0.5, s.bias,
    ]);
    const probs = agent.policy(state);
    policyBySituation[s.our + '_t' + s.tension] = {
      our: s.our,
      tension: s.tension,
      distribution: Object.fromEntries(strategies.map((st, i) => [st, probs[i]])),
      predicted: strategies[probs.indexOf(Math.max(...probs))],
    };
  }

  // Aggregated strategy distribution
  for (let i = 0; i < strategies.length; i++) {
    strategyProbs[strategies[i]] = 0;
  }
  for (const pol of Object.values(policyBySituation)) {
    for (const [strat, prob] of Object.entries(pol.distribution)) {
      strategyProbs[strat] += prob;
    }
  }
  const nSituations = Object.keys(policyBySituation).length;
  for (const s of strategies) strategyProbs[s] /= nSituations;

  // Детекция адаптации: сравнить политику при forecast_high vs forecast_low
  const polHigh = policyBySituation['forecast_high_t0.5'];
  const polLow = policyBySituation['forecast_low_t0.5'];
  const klDivergence = polHigh && polLow
    ? strategies.reduce((kl, s) => {
        const p = polHigh.distribution[s];
        const q = polLow.distribution[s];
        return kl + (p > 0 && q > 0 ? p * Math.log(p / q) : 0);
      }, 0)
    : 0;

  const result = {
    module: 'opponent_ppo',
    trained: true,
    episodesCompleted: trainingHistory.length,
    avgEpisodeReward: trainingHistory.reduce((s, h) => s + h.episodeReward, 0) /
      Math.max(trainingHistory.length, 1),
    strategyDistribution: strategyProbs,
    policyBySituation,
    adaptationDetection: {
      klDivergence,
      adapted: klDivergence > 0.3,
      interpretation: klDivergence > 0.3
        ? 'PPO-агент адаптируется к нашей стратегии (KL > 0.3)'
        : 'Политика противника стабильна',
    },
    dominantStrategy: strategies[
      Object.values(strategyProbs).indexOf(Math.max(...Object.values(strategyProbs)))
    ],
    timestamp: new Date().toISOString(),
  };

  // Сохранение
  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filepath, JSON.stringify({
    agent: agent.toJSON(),
    trainingHistory: trainingHistory.slice(-50),
    updatedAt: new Date().toISOString(),
  }, null, 2));

  return result;
}

export { PPOAgent, AdversarialEnv, MLP };
