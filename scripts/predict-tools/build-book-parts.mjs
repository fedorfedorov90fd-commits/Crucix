#!/usr/bin/env node
// scripts/build-book-parts.mjs
// Собирает все файлы проекта в 6 текстовых томов для чтения AI.
// Каждый файл оборачивается в маркер ==== FILE: path ====.
// Запуск: node scripts/build-book-parts.mjs
// Результат: docs/book-parts/part-1..6.txt

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'docs', 'book-parts');
const MAX_FILE_BYTES = 200 * 1024; // >200 KB — обрезаем с указанием

function sha1(str) {
  return createHash('sha1').update(str).digest('hex').slice(0, 16);
}

function readSafe(relPath) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) return { content: null, error: 'NOT_FOUND', size: 0 };
  try {
    const buf = readFileSync(full);
    const size = buf.length;
    if (size > MAX_FILE_BYTES) {
      const head = buf.slice(0, MAX_FILE_BYTES).toString('utf8');
      return { content: head + `\n\n<<<ОБРЕЗАНО: файл ${size} байт, показаны первые ${MAX_FILE_BYTES}>>>`, error: 'TRUNCATED', size };
    }
    return { content: buf.toString('utf8'), error: null, size };
  } catch (e) {
    return { content: null, error: e.message, size: 0 };
  }
}

function walkDir(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, out);
    else out.push(relative(ROOT, full));
  }
  return out.sort();
}

// ─── МАНИФЕСТ: 6 ТОМОВ ────────────────────────────────────────
// Каждый том = массив путей ИЛИ функция-сборщик (для автосбора папок).

const MANIFEST = {
  'part-1-foundation': {
    title: 'Том 1. Фундамент: package.json, README, математическое ядро, научные модели',
    files: [
      'package.json',
      'README_CRUCIX_v4.md',
      'apis/predict/core/linear_algebra.mjs',
      'apis/predict/core/optim.mjs',
      'apis/predict/core/stats.mjs',
      'apis/predict/models/hawkes.mjs',
      'apis/predict/models/hmm.mjs',
      'apis/predict/models/kalman.mjs',
      'apis/predict/models/ising.mjs',
      'apis/predict/models/transferentropy.mjs',
      'apis/predict/models/contagion.mjs',
      'apis/predict/models/evt.mjs',
      'apis/predict/models/ornstein.mjs',
      'apis/predict/models/copula.mjs',
      'apis/predict/models/bocpd.mjs',
      'apis/predict/models/particle.mjs',
    ],
  },

  'part-2-models': {
    title: 'Том 2. Продвинутые модели: NN, RL, MCMC, физика, аномалии, exotic, federated, wasm, webgl, workers',
    files: [
      'apis/predict/models/neural.mjs',
      'apis/predict/models/graph_neural.mjs',
      'apis/predict/models/graph_sage.mjs',
      'apis/predict/models/reinforcement.mjs',
      'apis/predict/models/actor_critic.mjs',
      'apis/predict/models/transformer.mjs',
      'apis/predict/models/vae.mjs',
      'apis/predict/models/diffusion.mjs',
      'apis/predict/models/mcmc.mjs',
      'apis/predict/models/physics_inspired.mjs',
      'apis/predict/models/bayesnet.mjs',
      'apis/predict/models/anomaly_detection.mjs',
      'models/hawkes.mjs',
      'apis/predict/exotic/chaos.mjs',
      'apis/predict/exotic/game_theory.mjs',
      'apis/predict/exotic/infogeo.mjs',
      'apis/predict/exotic/networks.mjs',
      'apis/predict/exotic/quantum_sa.mjs',
      'apis/predict/exotic/signal_advanced.mjs',
      'apis/predict/exotic/wasserstein.mjs',
      'apis/predict/federated/fl_node.mjs',
      'apis/predict/federated/fl_protocol.mjs',
      'apis/predict/wasm/simd_loader.mjs',
      'apis/predict/wasm/linear_algebra_simd.wat',
      'apis/predict/webgl/gpu.mjs',
      'apis/predict/webgl/shaders.mjs',
      'apis/predict/webgl/example_gpu.mjs',
      'apis/predict/workers/pool.mjs',
      'apis/predict/workers/montecarlo_worker.mjs',
      'apis/predict/workers/crucix_worker.mjs',
      'apis/predict/workers/example_parallel.mjs',
    ],
  },

  'part-3-engines': {
    title: 'Том 3. Движки и оркестрация: 6 кандидатов, патчи v6/v7, плагины, регистрация',
    files: [
      'apis/predict/engine.mjs',
      'apis/predict/engine_coordinat.mjs',
      'apis/predict/engine_integration_patch.mjs',
      'apis/predict/engine_v6_patch.mjs',
      'apis/predict/engine_v7_patch.mjs',
      'apis/predict/crucix_engine_v4.mjs',
      'apis/predict/register_coordinat_all.mjs',
      'apis/predict/plugins_api.mjs',
      'apis/predict/ws_v4_patch.mjs',
    ],
  },

  'part-4-modules': {
    title: 'Том 4. Модули ядра apis/predict/*.mjs + v6 + v7 + agent',
    files: [
      'apis/predict/bayesian.mjs',
      'apis/predict/naivebayes.mjs',
      'apis/predict/markov.mjs',
      'apis/predict/montecarlo.mjs',
      'apis/predict/timeseries.mjs',
      'apis/predict/calibration.mjs',
      'apis/predict/cascade.mjs',
      'apis/predict/ensemble.mjs',
      'apis/predict/bayesian_causal.mjs',
      'apis/predict/causal.mjs',
      'apis/predict/multilayer_causal.mjs',
      'apis/predict/temporal_causal.mjs',
      'apis/predict/gametheory.mjs',
      'apis/predict/narrative.mjs',
      'apis/predict/narrative_unified.mjs',
      'apis/predict/narrative_warfare.mjs',
      'apis/predict/swarm.mjs',
      'apis/predict/reflexive.mjs',
      'apis/predict/regime_shift.mjs',
      'apis/predict/explainability.mjs',
      'apis/predict/meta_ensemble.mjs',
      'apis/predict/multiscale_attention.mjs',
      'apis/predict/attention_dynamics.mjs',
      'apis/predict/hypergraph_contagion.mjs',
      'apis/predict/hypergraph_discovery.mjs',
      'apis/predict/adversarial_coevolution.mjs',
      'apis/predict/opponent_ppo.mjs',
      'apis/predict/resource_exhaustion.mjs',
      'apis/predict/federated_hypergraph.mjs',
      'apis/predict/llm_agents.mjs',
      'apis/predict/scenario_generator.mjs',
      'apis/predict/anomaly_detection.mjs',
      'apis/predict/automl.mjs',
      'apis/predict/active_learning.mjs',
      'apis/predict/notifier.mjs',
      'apis/predict/ws.mjs',
      'apis/predict/python_bridge.mjs',
      'apis/predict/v6/neural_causal_discovery.mjs',
      'apis/predict/v6/continual_learning.mjs',
      'apis/predict/v6/causal_rl.mjs',
      'apis/predict/v6/quantum_hypergraph.mjs',
      'apis/predict/v6/zk_federated.mjs',
      'apis/predict/v7/world_model.mjs',
      'apis/predict/v7/neural_ode.mjs',
      'apis/predict/v7/dreamer.mjs',
      'apis/predict/v7/continuous_causal.mjs',
      'apis/predict/v7/simulation_engine.mjs',
      'apis/predict/agent/agent_core.mjs',
      'apis/predict/agent/executor.mjs',
      'apis/predict/agent/narrator.mjs',
      'apis/predict/agent/planner.mjs',
      'apis/predict/agent/server.mjs',
      'apis/predict/agent/tool_registry.mjs',
    ],
  },

  'part-5-sources-and-ui': {
    title: 'Том 5. Источники, знания, графы, дашборды, интеграции, плагины, наблюдаемость, human-feedback',
    files: [
      'apis/sources/multilang.mjs',
      'apis/sources/prediction_markets.mjs',
      'apis/sources/satellite.mjs',
      'apis/knowledge/graph.mjs',
      'apis/entity_model/graph.mjs',
      'dashboard/cockpit.html',
      'dashboard/crucix.html',
      'dashboard/agent.html',
      'dashboard/advanced.html',
      'dashboard/attention.html',
      'dashboard/coevolution.html',
      'dashboard/hypergraph.html',
      'dashboard/plugins.html',
      'dashboard/predictions_composite.html',
      'dashboard/realtime.html',
      'dashboard/pwa/install.js',
      'dashboard/pwa/push.js',
      'dashboard/pwa/service-worker.js',
      'dashboard/pwa/manifest.json',
      'dashboard/pwa/offline.html',
      'dashboard/pwa/README.md',
      'features/human-feedback/human_feedback.mjs',
      'features/human-feedback/human_feedback.dashboard.html',
      'features/human-feedback/engine_integration.md',
      'features/human-feedback/README.md',
      'integrations/slack.mjs',
      'integrations/notion.mjs',
      'integrations/obsidian.mjs',
      'integrations/rss.mjs',
      'integrations/email.mjs',
      'integrations/webhook_manager.mjs',
      'integrations/README.md',
      'plugins/loader.mjs',
      'plugins/sandbox.mjs',
      'plugins/sandbox_worker.mjs',
      'plugins/hooks.mjs',
      'plugins/registry.mjs',
      'plugins/manifest_schema.mjs',
      'plugins/README.md',
      'plugins/examples/hello-world/index.mjs',
      'plugins/examples/hello-world/manifest.json',
      'plugins/examples/data-fetcher/index.mjs',
      'plugins/examples/data-fetcher/manifest.json',
      'plugins/examples/custom-signal/index.mjs',
      'plugins/examples/custom-signal/manifest.json',
      'observability/otel.mjs',
      'observability/instrumentation.mjs',
      'observability/alerts/prometheus.yml',
      'observability/dashboards/grafana/crucix-overview.json',
      'observability/README.md',
    ],
  },

  'part-6-infra-and-tests': {
    title: 'Том 6. Инфраструктура: docker, k8s, CI, тесты, benchmarks, scripts, книга, runs (образцы)',
    files: [
      'docker/Dockerfile.crucix-final',
      'docker/docker-compose.final.yml',
      'docker/entrypoint.sh',
      'docker/healthcheck.sh',
      'k8s/namespace.yaml',
      'k8s/configmap.yaml',
      'k8s/secrets.yaml',
      'k8s/deployment-crucix.yaml',
      'k8s/service.yaml',
      'k8s/ingress.yaml',
      'k8s/hpa.yaml',
      'k8s/cronjob.yaml',
      'k8s/statefulset-python.yaml',
      'k8s/servicemonitor.yaml',
      'k8s/kustomization.yaml',
      '.github/CODEOWNERS',
      '.github/dependabot.yml',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/workflows/ci.yml',
      '.github/workflows/docker.yml',
      '.github/workflows/release.yml',
      '.github/workflows/security.yml',
      '.github/workflows/nightly-property.yml',
      '.github/workflows/nightly-neo4j.yml',
      '.github/workflows/neo4j-export.yml',
      '.github/workflows/weekly-chaos.yml',
      'tests/predict/adversarial_coevolution.test.mjs',
      'tests/predict/attention_dynamics.test.mjs',
      'tests/predict/hypergraph_contagion.test.mjs',
      'tests/predict/meta_ensemble.test.mjs',
      'tests/predict/multilayer_causal.test.mjs',
      'tests/predict/narrative_warfare.test.mjs',
      'tests/predict/resource_exhaustion.test.mjs',
      'tests/predict/scenario_generator.test.mjs',
      'tests/predict/temporal_causal.test.mjs',
      'tests/property/adversarial_coevolution.property.mjs',
      'tests/property/attention_dynamics.property.mjs',
      'tests/property/hypergraph_contagion.property.mjs',
      'tests/property/meta_ensemble.property.mjs',
      'tests/property/reflexive.property.mjs',
      'tests/property/regime_signature.property.mjs',
      'tests/fuzz/adversarial_coevolution.fuzz.mjs',
      'tests/fuzz/attention_dynamics.fuzz.mjs',
      'tests/fuzz/hypergraph_contagion.fuzz.mjs',
      'tests/fuzz/scenario_generator.fuzz.mjs',
      'tests/fuzz/temporal_causal.fuzz.mjs',
      'tests/integration/full_pipeline.test.mjs',
      'tests/integration/full_pipeline_v6_v7.test.mjs',
      'tests/chaos/chaos_runner.mjs',
      'tests/chaos/fault_injection.mjs',
      'tests/mutation/run_all.mjs',
      'tests/mutation/attention.mutate.mjs',
      'tests/mutation/coevolution.mutate.mjs',
      'tests/mutation/hypergraph.mutate.mjs',
      'tests/mutation/meta_learner.mutate.mjs',
      'tests/catalog/catalog_pack_a.test.mjs',
      'tests/catalog/catalog_pack_b.test.mjs',
      'tests/v6/neural_causal_discovery.test.mjs',
      'tests/v6/v6_pack.test.mjs',
      'tests/v7/v7_pack.test.mjs',
      'benchmark/suite.mjs',
      'benchmark/report.html',
      'scripts/apply_v6_patch.mjs',
      'scripts/apply_v7_patch.mjs',
      'scripts/fix-duplicates.mjs',
      'scripts/fix-role-duplication.mjs',
      'scripts/rename-crucix.mjs',
      'scripts/neo4j_export.py',
      'scripts/neo4j_requirements.txt',
      'scripts/README_neo4j.md',
      'scripts/compile-wasm-simd.sh',
      'docs/handbook/00-intro.md',
      'docs/handbook/01-architecture.md',
      'docs/handbook/02-sciences.md',
      'docs/handbook/03-models.md',
      'docs/handbook/08-testing.md',
      'docs/handbook/16-advanced-contagion.md',
      'docs/handbook/architecture-overview.md',
      'docs/handbook/catalog.md',
      'docs/handbook/pipeline-S-T-U.md',
      'docs/handbook/v6.0.md',
      'docs/handbook/v7.0.md',
      'docs/handbook/v8.0-agent.md',
      'docs/handbook/build.sh',
      'docs/handbook/sciences/advanced_layers.md',
      'docs/handbook/sciences/bayesian.md',
      'docs/handbook/sciences/causality.md',
      'docs/handbook/sciences/epidemiology.md',
      'docs/handbook/sciences/finance.md',
      'docs/handbook/sciences/gametheory.md',
      'docs/handbook/sciences/_index_complete.md',
      'docs/handbook/sciences/infotheory.md',
      'docs/handbook/sciences/navigation.md',
      'docs/handbook/sciences/networks.md',
      'docs/handbook/sciences/physics.md',
      'docs/handbook/sciences/README.md',
      'docs/handbook/sciences/reliability.md',
      'docs/handbook/sciences/seismology.md',
      'docs/handbook/sciences/sociophysics.md',
      'docs/handbook/sciences/speech.md',
      'docs/handbook/sciences/topology.md',
      'runs/latest.json',
      'runs/history.json',
      'runs/knowledge_graph.json',
      'runs/predictions/latest_forecast.json',
      'runs/predictions/simulation_engine.json',
      'runs/predictions/test_results.json',
      'runs/mutation/report.md',
    ],
  },
};

// ─── СБОРКА ТОМОВ ─────────────────────────────────────────────

function buildVolume(name, spec) {
  const lines = [];
  let totalBytes = 0;
  let foundCount = 0;
  let missingCount = 0;
  let truncatedCount = 0;

  const header = [
    '='.repeat(72),
    `CRUCIX · PREDICT-EXTENSIONS · BOOK`,
    `ТОМ: ${name}`,
    `НАЗВАНИЕ: ${spec.title}`,
    `СОЗДАН: ${new Date().toISOString()}`,
    `ВСЕГО ФАЙЛОВ В МАНИФЕСТЕ: ${spec.files.length}`,
    '='.repeat(72),
    '',
  ].join('\n');
  lines.push(header);
  totalBytes += header.length;

  for (const relPath of spec.files) {
    const { content, error, size } = readSafe(relPath);
    const marker = [
      '',
      '='.repeat(72),
      `FILE: ${relPath}`,
      `SIZE: ${size} bytes`,
      error ? `STATUS: ${error}` : `SHA1: ${sha1(content || '')}`,
      '='.repeat(72),
      '',
    ].join('\n');
    lines.push(marker);
    totalBytes += marker.length;

    if (content === null) {
      missingCount++;
      lines.push(`<<<ФАЙЛ НЕ НАЙДЕН ИЛИ НЕ ПРОЧИТАН: ${relPath}>>>`);
      continue;
    }
    if (error === 'TRUNCATED') truncatedCount++;
    else foundCount++;

    lines.push(content);
    lines.push('');
    totalBytes += content.length;
  }

  const footer = [
    '',
    '='.repeat(72),
    `КОНЕЦ ТОМА ${name}`,
    `ФАЙЛОВ НАЙДЕНО: ${foundCount}`,
    `ФАЙЛОВ НЕ НАЙДЕНО: ${missingCount}`,
    `ФАЙЛОВ ОБРЕЗАНО: ${truncatedCount}`,
    `РАЗМЕР ТОМА: ${(totalBytes / 1024).toFixed(1)} KB`,
    '='.repeat(72),
  ].join('\n');
  lines.push(footer);

  return { text: lines.join('\n'), foundCount, missingCount, truncatedCount, totalBytes };
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log('CRUCIX · build-book-parts');
  console.log(`ROOT: ${ROOT}`);
  console.log(`OUT:  ${OUT_DIR}`);
  console.log('');

  const summary = [];
  for (const [name, spec] of Object.entries(MANIFEST)) {
    const { text, foundCount, missingCount, truncatedCount, totalBytes } = buildVolume(name, spec);
    const outPath = join(OUT_DIR, `${name}.txt`);
    writeFileSync(outPath, text, 'utf8');
    summary.push({
      name,
      file: outPath,
      found: foundCount,
      missing: missingCount,
      truncated: truncatedCount,
      sizeKB: (totalBytes / 1024).toFixed(1),
    });
    console.log(`${name}: ${foundCount} найдено, ${missingCount} нет, ${truncatedCount} обрезано, ${(totalBytes / 1024).toFixed(1)} KB`);
  }

  console.log('');
  console.log('ИТОГО:');
  for (const s of summary) {
    console.log(`  ${s.file}  —  ${s.sizeKB} KB`);
  }
  console.log('');
  console.log('ГОТОВО. Пришлите содержимое docs/book-parts/part-1-foundation.txt первым.');
}

main();
