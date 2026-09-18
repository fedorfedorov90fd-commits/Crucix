// plugins/examples/custom-signal/index.mjs
// Пример плагина, добавляющего кастомный сигнал

let config = null;

export async function init(userConfig) {
  config = userConfig;
  console.log(`[custom-signal] Initialized: weight=${config.weight}, threshold=${config.threshold}`);
}

export function computeSignal(result, latest) {
  if (!latest) return 0;

  const vix = latest.fred?.vix || 20;
  const conflicts = latest.gdelt?.conflictEvents?.length || 0;
  const hySpread = latest.fred?.hySpread || 3;

  const vixFactor = Math.max(0, Math.min(1, (vix - 15) / 30));
  const conflictFactor = Math.max(0, Math.min(1, conflicts / 20));
  const spreadFactor = Math.max(0, Math.min(1, (hySpread - 2) / 6));

  const stress = (vixFactor * 0.4 + conflictFactor * 0.35 + spreadFactor * 0.25);

  return stress;
}

export async function afterPrediction(result) {
  const latest = result.extended?._latest || {};
  const signal = computeSignal(result, latest);

  return {
    signal: {
      key: 'customStress',
      name: 'Custom Stress Indicator',
      value: signal,
      weight: config.weight,
      rationale: `stress=${signal.toFixed(3)}, threshold=${config.threshold}`,
    },
  };
}

export function getStatus() {
  return { name: 'custom-signal', config };
}
