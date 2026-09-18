// apis/predict/wasm/simd_loader.mjs
// Загрузчик SIMD-WASM с многоуровневым fallback:
//   1. SIMD WASM (быстрее всего, 3-4x над скалярным)
//   2. Скалярный WASM (5-10x над JS)
//   3. Чистый JS (всегда работает)

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let simdModule = null;
let scalarModule = null;
let memory = null;
let mode = 'js';
let exports = {};

let _nextPtr = 65536;
let _maxPtr = 0;

export async function initSIMD() {
  if (mode !== 'js') return mode;

  const simdSupported = checkSIMDSupport();

  if (simdSupported) {
    const simdPath = join(__dirname, 'linear_algebra_simd.wasm');
    if (existsSync(simdPath)) {
      try {
        const bytes = readFileSync(simdPath);
        const { instance } = await WebAssembly.instantiate(bytes);
        simdModule = instance.exports;
        exports = simdModule;
        memory = instance.exports.memory;
        mode = 'simd';
        console.log('[wasm] SIMD module loaded (3-4x faster)');
        return mode;
      } catch (e) {
        console.warn(`[wasm] SIMD загрузка не удалась: ${e.message}`);
      }
    } else {
      console.warn('[wasm] linear_algebra_simd.wasm не найден');
      console.warn('[wasm] Компилируйте: wat2wasm --enable-simd linear_algebra_simd.wat -o linear_algebra_simd.wasm');
    }
  } else {
    console.warn('[wasm] SIMD не поддерживается этим окружением');
  }

  const scalarPath = join(__dirname, 'linear_algebra.wasm');
  if (existsSync(scalarPath)) {
    try {
      const bytes = readFileSync(scalarPath);
      const { instance } = await WebAssembly.instantiate(bytes);
      scalarModule = instance.exports;
      exports = scalarModule;
      memory = instance.exports.memory;
      mode = 'wasm';
      console.log('[wasm] Scalar module loaded (5-10x over JS)');
      return mode;
    } catch (e) {
      console.warn(`[wasm] Scalar загрузка не удалась: ${e.message}`);
    }
  }

  mode = 'js';
  console.log('[wasm] Используем JS-fallback');
  return mode;
}

function checkSIMDSupport() {
  try {
    if (typeof WebAssembly.validate === 'function') {
      return process.versions.node && parseInt(process.versions.node) >= 16;
    }
    return false;
  } catch {
    return false;
  }
}

function ensureMemory(bytesNeeded) {
  if (!memory) return;
  const pagesNeeded = Math.ceil((bytesNeeded + _nextPtr) / 65536);
  const currentPages = memory.buffer.byteLength / 65536;
  if (pagesNeeded > currentPages) {
    memory.grow(pagesNeeded - currentPages + 1);
  }
}

function alloc(bytes) {
  ensureMemory(bytes + 65536);
  const ptr = _nextPtr;
  _nextPtr += bytes;
  if (_nextPtr > _maxPtr) _maxPtr = _nextPtr;
  return ptr;
}

function resetAllocator() { _nextPtr = 65536; }

function writeVector(vec, ptr) {
  const f64 = new Float64Array(memory.buffer, ptr, vec.length);
  for (let i = 0; i < vec.length; i++) f64[i] = vec[i];
}

function readVector(ptr, n) {
  return Array.from(new Float64Array(memory.buffer, ptr, n));
}

export function dotProduct(a, b) {
  if (mode === 'js') return jsDotProduct(a, b);
  resetAllocator();
  const n = Math.min(a.length, b.length);
  const aPtr = alloc(n * 8);
  const bPtr = alloc(n * 8);
  writeVector(a.slice(0, n), aPtr);
  writeVector(b.slice(0, n), bPtr);
  const fn = mode === 'simd' ? exports.dot_product_simd : exports.dot_product;
  return fn(aPtr, bPtr, n);
}

export function matrixMultiply(A, B) {
  if (mode === 'js') return jsMatrixMultiply(A, B);
  resetAllocator();
  const n = A.length, m = A[0].length, p = B[0].length;
  const aFlat = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) aFlat.push(A[i][j]);
  const bFlat = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < p; j++) bFlat.push(B[i][j]);
  const aPtr = alloc(n * m * 8);
  const bPtr = alloc(m * p * 8);
  const cPtr = alloc(n * p * 8);
  writeVector(aFlat, aPtr);
  writeVector(bFlat, bPtr);
  const fn = mode === 'simd' ? exports.matrix_multiply_simd : exports.matrix_multiply;
  fn(aPtr, bPtr, cPtr, n, m, p);
  const cFlat = readVector(cPtr, n * p);
  const C = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < p; j++) row.push(cFlat[i * p + j]);
    C.push(row);
  }
  return C;
}

export function l2Norm(x) {
  if (mode === 'js') return Math.sqrt(x.reduce((s, v) => s + v * v, 0));
  resetAllocator();
  const ptr = alloc(x.length * 8);
  writeVector(x, ptr);
  const fn = mode === 'simd' ? exports.l2_norm_simd : exports.l2_norm;
  return fn(ptr, x.length);
}

export function relu(x) {
  if (mode === 'js') return x.map(v => Math.max(0, v));
  resetAllocator();
  const ptr = alloc(x.length * 8);
  writeVector(x, ptr);
  const fn = mode === 'simd' ? exports.relu_simd_inplace : exports.relu_inplace;
  fn(ptr, x.length);
  return readVector(ptr, x.length);
}

export function add(a, b) {
  if (mode === 'js') return a.map((v, i) => v + b[i]);
  resetAllocator();
  const ptr = alloc(a.length * 8);
  writeVector(a, ptr);
  const bPtr = alloc(b.length * 8);
  writeVector(b, bPtr);
  const fn = mode === 'simd' ? exports.add_simd_inplace : exports.add_inplace;
  fn(ptr, bPtr, a.length);
  return readVector(ptr, a.length);
}

export function scalarMultiply(x, scalar) {
  if (mode === 'js') return x.map(v => v * scalar);
  resetAllocator();
  const ptr = alloc(x.length * 8);
  writeVector(x, ptr);
  const fn = mode === 'simd' ? exports.scalar_multiply_simd_inplace : exports.scalar_multiply_inplace;
  fn(ptr, x.length, scalar);
  return readVector(ptr, x.length);
}

export function maxValue(x) {
  if (mode === 'simd') {
    resetAllocator();
    const ptr = alloc(x.length * 8);
    writeVector(x, ptr);
    return exports.max_simd(ptr, x.length);
  }
  return Math.max(...x);
}

function jsDotProduct(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function jsMatrixMultiply(A, B) {
  const n = A.length, m = A[0].length, p = B[0].length;
  const C = Array.from({ length: n }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < m; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < p; j++) C[i][j] += aik * B[k][j];
    }
  }
  return C;
}

export function simdStatus() {
  return {
    mode,
    simdSupported: checkSIMDSupport(),
    memoryBytes: memory ? memory.buffer.byteLength : 0,
    exports: mode !== 'js' ? Object.keys(exports) : [],
    fallbackChain: ['simd', 'wasm', 'js'].slice(['simd', 'wasm', 'js'].indexOf(mode)),
  };
}

export function benchmarkAll(n = 100) {
  const A = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()));
  const B = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()));

  const t0 = performance.now();
  jsMatrixMultiply(A, B);
  const jsTime = performance.now() - t0;

  let wasmTime = null;
  if (mode !== 'js') {
    const t1 = performance.now();
    matrixMultiply(A, B);
    wasmTime = performance.now() - t1;
  }

  return {
    size: n,
    mode,
    jsTimeMs: jsTime.toFixed(2),
    wasmTimeMs: wasmTime ? wasmTime.toFixed(2) : 'n/a',
    speedup: wasmTime ? (jsTime / wasmTime).toFixed(2) : 'n/a',
  };
}

export const SIMD_INFO = {
  name: 'WASM SIMD',
  description: '128-bit vectorized operations для 3-4x ускорения',
  fallbackChain: ['simd', 'wasm', 'js'],
};
