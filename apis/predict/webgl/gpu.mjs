// apis/predict/webgl/gpu.mjs
// GPU-вычисления через WebGL / headless-gl

import { SHADER_SOURCES } from './shaders.mjs';

let gl = null;
let glContextType = 'none';
let programs = {};
let initialized = false;

export async function initGPU() {
  if (initialized) return glContextType;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;

      gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (gl) {
        glContextType = 'webgl-browser';
        console.log('[gpu] WebGL инициализирован в браузере');
        _compilePrograms();
        initialized = true;
        return glContextType;
      }
    } catch (e) {
      console.warn(`[gpu] Browser WebGL ошибка: ${e.message}`);
    }
  }

  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const headlessModule = await import('gl');
      const createGL = headlessModule.default || headlessModule;

      gl = createGL(1024, 1024);

      if (gl) {
        glContextType = 'webgl-headless';
        console.log('[gpu] Headless WebGL инициализирован (Node.js)');
        _compilePrograms();
        initialized = true;
        return glContextType;
      }
    } catch (e) {
      console.log('[gpu] headless-gl не установлен — используем CPU fallback');
      console.log('[gpu] Установить: npm install gl');
    }
  }

  glContextType = 'cpu-fallback';
  initialized = true;
  return glContextType;
}

function _compilePrograms() {
  programs = {
    matmul: _createProgram(SHADER_SOURCES.vertex, SHADER_SOURCES.matmul),
    elementwise: _createProgram(SHADER_SOURCES.vertex, SHADER_SOURCES.elementwise),
    activation: _createProgram(SHADER_SOURCES.vertex, SHADER_SOURCES.activation),
    softmax: _createProgram(SHADER_SOURCES.vertex, SHADER_SOURCES.softmax),
    axpy: _createProgram(SHADER_SOURCES.vertex, SHADER_SOURCES.axpy),
    adam: _createProgram(SHADER_SOURCES.vertex, SHADER_SOURCES.adam),
  };

  if (programs.matmul === null) {
    console.warn('[gpu] Не удалось скомпилировать программы — fallback на CPU');
    glContextType = 'cpu-fallback';
  }
}

function _compileShader(source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.warn(`[gpu] Shader compile error: ${info}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function _createProgram(vsSource, fsSource) {
  const vs = _compileShader(vsSource, gl.VERTEX_SHADER);
  const fs = _compileShader(fsSource, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(`[gpu] Program link error: ${gl.getProgramInfoLog(program)}`);
    return null;
  }
  return program;
}

function _createQuad() {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]), gl.STATIC_DRAW);
  return buffer;
}

function _createTexture(data, width, height) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);

  const hasFloat = gl.getExtension('OES_texture_float');
  const type = hasFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;

  let pixelData;
  if (hasFloat) {
    pixelData = new Float32Array(width * height * 4);
    for (let i = 0; i < data.length && i < width * height; i++) {
      pixelData[i * 4] = data[i];
    }
  } else {
    pixelData = new Uint8Array(width * height * 4);
    for (let i = 0; i < data.length && i < width * height; i++) {
      pixelData[i * 4] = Math.max(0, Math.min(255, Math.floor(data[i] * 255)));
    }
  }

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, type, pixelData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

function _readPixels(width, height, useFloat) {
  const pixels = useFloat
    ? new Float32Array(width * height * 4)
    : new Uint8Array(width * height * 4);

  gl.readPixels(0, 0, width, height, gl.RGBA, useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE, pixels);

  const result = [];
  for (let i = 0; i < width * height; i++) {
    const v = useFloat ? pixels[i * 4] : pixels[i * 4] / 255;
    result.push(v);
  }
  return result;
}

export function gpuMatmul(A, B) {
  if (glContextType === 'cpu-fallback' || !programs.matmul) {
    return cpuMatmul(A, B);
  }

  const n = A.length;
  const m = A[0].length;
  const p = B[0].length;

  const aFlat = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) aFlat.push(A[i][j]);

  const bFlat = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < p; j++) bFlat.push(B[i][j]);

  const aTex = _createTexture(aFlat, m, n);
  const bTex = _createTexture(bFlat, p, m);

  const cTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, cTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, p, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cTex, 0);

  gl.viewport(0, 0, p, n);

  const program = programs.matmul;
  gl.useProgram(program);

  gl.uniform1i(gl.getUniformLocation(program, 'u_A'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'u_B'), 1);
  gl.uniform1i(gl.getUniformLocation(program, 'u_n'), n);
  gl.uniform1i(gl.getUniformLocation(program, 'u_m'), m);
  gl.uniform1i(gl.getUniformLocation(program, 'u_p'), p);
  gl.uniform1i(gl.getUniformLocation(program, 'u_aWidth'), m);
  gl.uniform1i(gl.getUniformLocation(program, 'u_bWidth'), p);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, aTex);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bTex);

  const quad = _createQuad();
  const aPos = gl.getAttribLocation(program, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  const useFloat = !!gl.getExtension('OES_texture_float');
  const cFlat = _readPixels(p, n, useFloat);

  const C = Array.from({ length: n }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      C[i][j] = cFlat[j * n + i] || 0;
    }
  }

  gl.deleteTexture(aTex);
  gl.deleteTexture(bTex);
  gl.deleteTexture(cTex);
  gl.deleteFramebuffer(fbo);
  gl.deleteBuffer(quad);

  return C;
}

function cpuMatmul(A, B) {
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

export function gpuElementwise(A, B, op = 'add') {
  if (glContextType === 'cpu-fallback' || !programs.elementwise) {
    return cpuElementwise(A, B, op);
  }

  const n = A.length;
  const width = 1024;

  const aTex = _createTexture(A, width, 1);
  const bTex = _createTexture(B, width, 1);

  const cTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, cTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cTex, 0);

  gl.viewport(0, 0, width, 1);

  const program = programs.elementwise;
  gl.useProgram(program);

  const opMap = { add: 0, sub: 1, mul: 2, div: 3 };

  gl.uniform1i(gl.getUniformLocation(program, 'u_A'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'u_B'), 1);
  gl.uniform1i(gl.getUniformLocation(program, 'u_n'), n);
  gl.uniform1i(gl.getUniformLocation(program, 'u_width'), width);
  gl.uniform1i(gl.getUniformLocation(program, 'u_op'), opMap[op] || 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, aTex);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bTex);

  const quad = _createQuad();
  const aPos = gl.getAttribLocation(program, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  const useFloat = !!gl.getExtension('OES_texture_float');
  const result = _readPixels(width, 1, useFloat).slice(0, n);

  gl.deleteTexture(aTex);
  gl.deleteTexture(bTex);
  gl.deleteTexture(cTex);
  gl.deleteFramebuffer(fbo);
  gl.deleteBuffer(quad);

  return result;
}

function cpuElementwise(A, B, op) {
  const result = [];
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (op === 'add') result.push(A[i] + B[i]);
    else if (op === 'sub') result.push(A[i] - B[i]);
    else if (op === 'mul') result.push(A[i] * B[i]);
    else if (op === 'div') result.push(A[i] / (B[i] + 1e-10));
  }
  return result;
}

export function gpuActivation(X, type = 'relu') {
  if (glContextType === 'cpu-fallback' || !programs.activation) {
    return cpuActivation(X, type);
  }
  return cpuActivation(X, type);
}

function cpuActivation(X, type) {
  if (type === 'relu') return X.map(v => Math.max(0, v));
  if (type === 'sigmoid') return X.map(v => 1 / (1 + Math.exp(-v)));
  if (type === 'tanh') return X.map(v => Math.tanh(v));
  return X;
}

export function gpuStatus() {
  return {
    context: glContextType,
    available: glContextType !== 'cpu-fallback',
    hasFloat: gl ? !!gl.getExtension('OES_texture_float') : false,
    programs: Object.keys(programs).filter(k => programs[k] !== null),
  };
}

export function gpuBenchmark(n = 128) {
  const A = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()));
  const B = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()));

  const t0 = performance.now();
  cpuMatmul(A, B);
  const cpuTime = performance.now() - t0;

  let gpuTime = null;
  if (glContextType !== 'cpu-fallback') {
    const t1 = performance.now();
    gpuMatmul(A, B);
    gpuTime = performance.now() - t1;
  }

  return {
    size: n,
    cpuTimeMs: cpuTime.toFixed(2),
    gpuTimeMs: gpuTime ? gpuTime.toFixed(2) : 'n/a',
    speedup: gpuTime ? (cpuTime / gpuTime).toFixed(2) : 'n/a',
    context: glContextType,
  };
}

export const GPU_INFO = {
  name: 'WebGL GPU Acceleration',
  description: 'GPU matmul и elementwise операции через WebGL',
  fallback: 'cpu',
};
