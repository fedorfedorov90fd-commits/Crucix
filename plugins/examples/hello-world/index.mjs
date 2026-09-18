// plugins/examples/hello-world/index.mjs
// Минимальный пример плагина Crucix

let config = null;

export async function init(userConfig) {
  config = userConfig;
  console.log(`[hello-world] Initialized with config:`, config);
}

export async function onShutdown() {
  console.log(`[hello-world] Shutting down`);
}

export async function afterPrediction(result) {
  if (!config.verbose) return;

  const cr = result.compositeRisk;
  if (!cr) return;

  console.log(`[hello-world] Prediction: composite=${cr.composite.toFixed(3)}, ` +
    `level=${cr.level}, signals=${cr.signals?.length || 0}`);

  return { logged: true, composite: cr.composite };
}

export async function onSignalHigh(signal) {
  console.log(`[hello-world] HIGH SIGNAL: ${signal.name} = ${(signal.value * 100).toFixed(1)}%`);
  return { alert: true };
}

export function getStatus() {
  return {
    name: 'hello-world',
    config,
    status: 'running',
  };
}
