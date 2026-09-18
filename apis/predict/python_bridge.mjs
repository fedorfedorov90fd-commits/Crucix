// apis/predict/python_bridge.mjs
// Мост к Python ML-сервису (sklearn, TensorFlow, PyTorch).
//
// Принцип:
//   Crucix работает на чистом JS и не требует Python.
//   Но если внешний Python-микросервис доступен — используем его
//   модели (XGBoost, LSTM, Transformer). Если сервис недоступен —
//   автоматически падаем на JS-fallback.

const PYTHON_URL = process.env.CRUCIX_PYTHON_URL || 'http://localhost:8090';
const HEALTH_TIMEOUT_MS = 2000;
const PREDICT_TIMEOUT_MS = 30000;
const TRAIN_TIMEOUT_MS = 120000;

let _serviceAvailable = null;
let _lastCheck = 0;
const _checkTtlMs = 30000;
let _availableModels = null;

async function checkPythonService(force = false) {
  const now = Date.now();
  if (!force && _lastCheck > 0 && (now - _lastCheck) < _checkTtlMs) {
    return _serviceAvailable;
  }

  _lastCheck = now;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${PYTHON_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      _serviceAvailable = true;
      _availableModels = data.models_available || data.models || [];
      return true;
    }
  } catch {}

  _serviceAvailable = false;
  return false;
}

async function listModels() {
  if (!await checkPythonService()) return [];
  try {
    const res = await fetch(`${PYTHON_URL}/models`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || data || [];
  } catch {
    return [];
  }
}

async function pythonPredict(modelName, X) {
  if (!await checkPythonService()) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PREDICT_TIMEOUT_MS);

    const res = await fetch(`${PYTHON_URL}/predict/${modelName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ X }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    return data.predictions || data.y || data.prediction || null;
  } catch {
    return null;
  }
}

async function pythonTrain(modelName, X, y) {
  if (!await checkPythonService()) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRAIN_TIMEOUT_MS);

    const res = await fetch(`${PYTHON_URL}/train/${modelName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ X, y }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function hybridForecast(modelName, X, jsFallback) {
  const pythonAvailable = await checkPythonService();

  if (pythonAvailable) {
    const result = await pythonPredict(modelName, X);
    if (result && Array.isArray(result) && result.length > 0) {
      return { source: 'python', predictions: result };
    }
  }

  if (typeof jsFallback === 'function') {
    try {
      const fallbackResult = jsFallback(X);
      return {
        source: 'js',
        predictions: Array.isArray(fallbackResult) ? fallbackResult : [fallbackResult],
      };
    } catch (e) {
      return { source: 'failed', predictions: [], error: e.message };
    }
  }

  return { source: 'failed', predictions: [], error: 'no_python_and_no_fallback' };
}

async function bridgeStatus() {
  const available = await checkPythonService(true);
  return {
    url: PYTHON_URL,
    available,
    models: available ? _availableModels : [],
    lastCheck: _lastCheck ? new Date(_lastCheck).toISOString() : null,
  };
}

async function crucixVixForecast(history, horizon = 3) {
  if (!Array.isArray(history) || history.length < 5) {
    return { source: 'failed', predictions: [], error: 'insufficient_history' };
  }

  const vixSeries = history
    .map((s) => (s && s.fred ? s.fred.vix : null))
    .filter((v) => typeof v === 'number' && !isNaN(v));

  if (vixSeries.length < 5) {
    return { source: 'failed', predictions: [], error: 'insufficient_vix' };
  }

  const X = vixSeries.map((v) => [v]);

  const jsFallback = (Xjs) => {
    const series = Xjs.map((row) => row[0]);
    const n = series.length;
    if (n < 2) return [series[n - 1] || 0];

    let level = series[0];
    let trend = series[1] - series[0];
    const alpha = 0.3, beta = 0.1;

    for (let i = 2; i < n; i++) {
      const newLevel = alpha * series[i] + (1 - alpha) * (level + trend);
      trend = beta * (newLevel - level) + (1 - beta) * trend;
      level = newLevel;
    }

    const out = [];
    for (let h = 1; h <= horizon; h++) out.push(level + h * trend);
    return out;
  };

  return await hybridForecast('keras_lstm', X, jsFallback);
}

export {
  PYTHON_URL,
  checkPythonService,
  listModels,
  pythonPredict,
  pythonTrain,
  hybridForecast,
  bridgeStatus,
  crucixVixForecast,
};
