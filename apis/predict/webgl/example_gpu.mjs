// apis/predict/webgl/example_gpu.mjs
// Пример использования GPU-ускорения

import { initGPU, gpuMatmul, gpuElementwise, gpuBenchmark, gpuStatus } from './gpu.mjs';

async function main() {
  console.log('════════════════════════════════════════════════');
  console.log('  Crucix GPU Acceleration Demo');
  console.log('════════════════════════════════════════════════');

  const contextType = await initGPU();
  console.log(`Context: ${contextType}`);
  console.log('Status:', JSON.stringify(gpuStatus(), null, 2));

  if (contextType === 'cpu-fallback') {
    console.log('\n⚠ GPU недоступен. Установить headless-gl:');
    console.log('  npm install gl');
    console.log('\nДемонстрация CPU-операций:');
  }

  console.log('\n[1] Матричное умножение 64×64...');
  const A = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => Math.random()));
  const B = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => Math.random()));

  const t0 = performance.now();
  const C = gpuMatmul(A, B);
  const t1 = performance.now();

  console.log(`  Результат: ${C.length}×${C[0].length}`);
  console.log(`  Время: ${(t1 - t0).toFixed(2)}ms`);
  console.log(`  C[0][0] = ${C[0][0].toFixed(6)}`);

  console.log('\n[2] Elementwise add...');
  const x = Array.from({ length: 1000 }, () => Math.random());
  const y = Array.from({ length: 1000 }, () => Math.random());
  const z = gpuElementwise(x, y, 'add');
  console.log(`  z[0] = ${z[0].toFixed(6)} (ожидается ${(x[0] + y[0]).toFixed(6)})`);

  console.log('\n[3] Бенчмарк 128×128...');
  const bench = gpuBenchmark(128);
  console.log(JSON.stringify(bench, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith('example_gpu.mjs')) {
  main().catch(e => {
    console.error('Ошибка:', e);
    process.exit(1);
  });
}

export { main };
