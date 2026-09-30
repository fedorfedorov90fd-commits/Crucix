// apis/predict/webgl/shaders.mjs
// GLSL шейдеры для GPU-вычислений
// Работают в браузере (WebGL) и в Node.js (headless-gl)

export const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_texCoord;

void main() {
    v_texCoord = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const MATMUL_FRAGMENT = `
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_A;
uniform sampler2D u_B;
uniform int u_n;
uniform int u_m;
uniform int u_p;
uniform int u_aWidth;
uniform int u_bWidth;

void main() {
    int i = int(v_texCoord.y * float(u_n));
    int j = int(v_texCoord.x * float(u_p));

    if (i >= u_n || j >= u_p) {
        gl_FragColor = vec4(0.0);
        return;
    }

    float sum = 0.0;

    for (int k = 0; k < 1024; k++) {
        if (k >= u_m) break;

        vec2 aUV = vec2((float(k) + 0.5) / float(u_aWidth), (float(i) + 0.5) / float(u_n));
        float aVal = texture2D(u_A, aUV).r;

        vec2 bUV = vec2((float(j) + 0.5) / float(u_bWidth), (float(k) + 0.5) / float(u_m));
        float bVal = texture2D(u_B, bUV).r;

        sum += aVal * bVal;
    }

    gl_FragColor = vec4(sum, 0.0, 0.0, 1.0);
}
`;

export const ELEMENTWISE_FRAGMENT = `
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_A;
uniform sampler2D u_B;
uniform int u_op;
uniform int u_n;
uniform int u_width;

void main() {
    int idx = int(v_texCoord.y * float(u_n));
    if (idx >= u_n) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 uv = vec2((float(idx) + 0.5) / float(u_width), 0.5);
    float a = texture2D(u_A, uv).r;
    float b = texture2D(u_B, uv).r;

    float result;
    if (u_op == 0) result = a + b;
    else if (u_op == 1) result = a - b;
    else if (u_op == 2) result = a * b;
    else if (u_op == 3) result = a / (b + 1e-10);
    else result = 0.0;

    gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
}
`;

export const ACTIVATION_FRAGMENT = `
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_X;
uniform int u_n;
uniform int u_width;
uniform int u_act;

void main() {
    int idx = int(v_texCoord.y * float(u_n));
    if (idx >= u_n) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 uv = vec2((float(idx) + 0.5) / float(u_width), 0.5);
    float x = texture2D(u_X, uv).r;

    float result;
    if (u_act == 0) result = max(0.0, x);
    else if (u_act == 1) result = 1.0 / (1.0 + exp(-x));
    else if (u_act == 2) result = tanh(x);
    else result = x;

    gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
}
`;

export const SOFTMAX_FRAGMENT = `
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_X;
uniform int u_n;
uniform int u_width;
uniform float u_max;
uniform float u_sum;

void main() {
    int idx = int(v_texCoord.y * float(u_n));
    if (idx >= u_n) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 uv = vec2((float(idx) + 0.5) / float(u_width), 0.5);
    float x = texture2D(u_X, uv).r;

    float result = exp(x - u_max) / u_sum;

    gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
}
`;

export const AXPY_FRAGMENT = `
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_X;
uniform int u_n;
uniform int u_width;
uniform float u_a;
uniform float u_b;

void main() {
    int idx = int(v_texCoord.y * float(u_n));
    if (idx >= u_n) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 uv = vec2((float(idx) + 0.5) / float(u_width), 0.5);
    float x = texture2D(u_X, uv).r;

    gl_FragColor = vec4(u_a * x + u_b, 0.0, 0.0, 1.0);
}
`;

export const ADAM_FRAGMENT = `
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_theta;
uniform sampler2D u_m;
uniform sampler2D u_v;
uniform sampler2D u_g;
uniform int u_n;
uniform int u_width;
uniform float u_lr;
uniform float u_beta1;
uniform float u_beta2;
uniform float u_eps;
uniform float u_bc1;
uniform float u_bc2;

void main() {
    int idx = int(v_texCoord.y * float(u_n));
    if (idx >= u_n) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 uv = vec2((float(idx) + 0.5) / float(u_width), 0.5);

    float theta = texture2D(u_theta, uv).r;
    float m = texture2D(u_m, uv).r;
    float v = texture2D(u_v, uv).r;
    float g = texture2D(u_g, uv).r;

    float mNew = u_beta1 * m + (1.0 - u_beta1) * g;
    float vNew = u_beta2 * v + (1.0 - u_beta2) * g * g;

    float mHat = mNew / u_bc1;
    float vHat = vNew / u_bc2;

    float thetaNew = theta - u_lr * mHat / (sqrt(vHat) + u_eps);

    gl_FragColor = vec4(thetaNew, mNew, vNew, 0.0);
}
`;

export const SHADER_SOURCES = {
  vertex: VERTEX_SHADER,
  matmul: MATMUL_FRAGMENT,
  elementwise: ELEMENTWISE_FRAGMENT,
  activation: ACTIVATION_FRAGMENT,
  softmax: SOFTMAX_FRAGMENT,
  axpy: AXPY_FRAGMENT,
  adam: ADAM_FRAGMENT,
};
