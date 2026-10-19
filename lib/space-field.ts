export type SpaceSample = {
  bearing: number;
  pitch: number;
  zoom: number;
  globeX: number;
  globeY: number;
  globeR: number;
};

const VERT = `attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uBearing;
uniform float uPitch;
uniform float uZoom;
uniform vec3 uGlobe;
uniform float uMotion;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 rot(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 starLayer(vec2 uv, float scale, float threshold, float gain, float speed) {
  vec2 grid = uv * scale;
  vec2 id = floor(grid);
  vec2 gv = fract(grid) - 0.5;
  float h = hash21(id);
  float present = step(threshold, h);
  float d = length(gv - (vec2(hash21(id + 1.7), h) - 0.5) * 0.7);
  float size = (0.045 + 0.12 * h) * gain;
  float core = 1.0 - smoothstep(size * 0.2, size, d);
  float glow = exp(-d * d / (size * size * 3.5)) * 0.35 * smoothstep(0.96, 1.0, h);
  float h2 = hash21(id + 4.3);
  float tw = 0.62 + 0.38 * uMotion * sin(uTime * speed * (0.6 + 1.8 * h2) + h2 * 40.0);
  tw = mix(1.0, tw, step(0.35, h2));
  vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.78), h2);
  return tint * (core + glow) * tw * present;
}

float shooting(vec2 p, float t, float seed) {
  float period = 7.5 + seed * 5.0;
  float cycle = floor(t / period);
  float local = mod(t, period);
  float r = hash21(vec2(cycle, seed * 13.0));
  if (r < 0.35) return 0.0;
  float life = 0.9;
  float k = local / life;
  if (k > 1.0) return 0.0;
  vec2 start = vec2(hash21(vec2(cycle, 3.1 + seed)) * 1.6 - 0.8, 0.15 + hash21(vec2(cycle, 7.7 + seed)) * 0.35);
  float ang = -0.45 - hash21(vec2(cycle, 1.9 + seed)) * 0.6;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 head = start + dir * k * 0.85;
  vec2 rel = p - head;
  float along = dot(rel, -dir);
  float across = abs(dot(rel, vec2(-dir.y, dir.x)));
  float tail = 0.22;
  float line = smoothstep(0.0025, 0.0, across) * step(0.0, along) * (1.0 - smoothstep(0.0, tail, along));
  float spark = exp(-dot(rel, rel) * 9000.0);
  float fade = sin(k * 3.14159);
  return (line + spark) * fade;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  float bear = uBearing;
  float t = uTime * uMotion;
  vec2 drift = vec2(sin(bear) * 0.22, cos(bear) * 0.08) + vec2(0.0, uPitch * 0.18);
  drift += vec2(t * 0.006, t * 0.002);

  vec3 col = vec3(0.006, 0.008, 0.02);

  // Slow drifting nebula, layered fbm with domain warp.
  vec2 q = p * 1.25 + drift * 0.3;
  vec2 warp = vec2(fbm(q + t * 0.012), fbm(q + 5.2 - t * 0.009));
  float neb = fbm(q * 1.4 + warp * 1.6 + 2.0);
  float neb2 = fbm(q * 2.3 - warp * 1.1 + 11.0);
  col += vec3(0.05, 0.075, 0.17) * smoothstep(0.38, 0.85, neb);
  col += vec3(0.12, 0.04, 0.13) * smoothstep(0.5, 0.92, neb2) * 0.7;
  col += vec3(0.02, 0.09, 0.11) * smoothstep(0.62, 0.95, neb * neb2 * 1.6) * 0.6;

  // Milky Way band.
  vec2 mw = rot(p - drift * 0.12, -0.58 + bear * 0.35);
  float band = exp(-mw.y * mw.y * 7.5);
  float dust = fbm(vec2(mw.x * 1.8 + 3.0 + t * 0.004, mw.y * 4.0));
  float lanes = smoothstep(0.45, 0.7, fbm(vec2(mw.x * 3.5, mw.y * 9.0) + 4.0));
  col += vec3(0.42, 0.48, 0.78) * band * (0.08 + 0.18 * dust) * (1.0 - 0.55 * lanes);
  col += vec3(0.22, 0.08, 0.24) * band * smoothstep(0.5, 0.85, dust) * 0.35;

  // Three parallax layers: far ones move least, near ones twinkle most.
  col += starLayer(rot(p, bear * 0.12) + drift * 0.25, 160.0, 0.9, 0.8, 0.8) * 0.75;
  col += starLayer(rot(p, bear * 0.3) + drift * 0.6, 90.0, 0.86, 1.0, 1.4) * 0.8;
  col += starLayer(rot(p, bear * 0.55) + drift * 1.1, 52.0, 0.93, 1.0, 2.2) * 0.95;
  col += starLayer(rot(p, bear * 0.85) + drift * 1.8, 26.0, 0.97, 1.05, 1.0) * 0.85;

  // Occasional shooting stars.
  if (uMotion > 0.5) {
    col += vec3(0.85, 0.9, 1.0) * (shooting(p, uTime, 0.0) + shooting(p, uTime + 3.7, 1.0) * 0.8);
  }

  // Atmosphere: soft outer glow plus a thin bright limb, sunlit on one side.
  vec2 g = vec2(frag.x - uGlobe.x, (uRes.y - frag.y) - uGlobe.y);
  float dist = length(g);
  float edge = (dist - uGlobe.z * 0.94) / max(22.0, uGlobe.z * 0.14);
  float inner = exp(-edge * edge * 1.4);
  float outer = exp(-max(edge, 0.0) * 0.9) * step(0.0, edge);
  float rimFade = 1.0 - smoothstep(1.1, 5.2, uZoom);
  vec2 sun = vec2(cos(-bear + 0.7), sin(-bear + 0.7));
  float facing = dot(normalize(g + vec2(0.001)), sun) * 0.5 + 0.5;
  float breathe = 0.92 + 0.08 * sin(t * 0.35);
  vec3 limb = vec3(0.26, 0.45, 0.85) * (0.35 + 0.65 * facing);
  limb += vec3(0.95, 0.8, 0.6) * smoothstep(0.72, 1.0, facing) * 0.4;
  col += limb * (inner * 0.55 + outer * 0.22) * rimFade * breathe;

  float vignette = 1.0 - smoothstep(0.4, 1.1, length(p));
  col *= mix(0.68, 1.0, vignette);

  float fade = 1.0 - smoothstep(1.15, 7.0, uZoom);
  col *= fade;
  col = col / (1.0 + col * 0.35);
  gl_FragColor = vec4(col, 1.0);
}`;

export function spaceFade(zoom: number) {
  const t = Math.min(1, Math.max(0, (zoom - 1.15) / 5.85));
  const eased = t * t * (3 - 2 * t);
  return 1 - eased;
}

export function mountSpaceField(canvas: HTMLCanvasElement, sample: () => SpaceSample | null) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) return { sync() {}, resize() {}, destroy() {} };

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return { sync() {}, resize() {}, destroy() {} };
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return { sync() {}, resize() {}, destroy() {} };
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.useProgram(program);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uBearing = gl.getUniformLocation(program, "uBearing");
  const uPitch = gl.getUniformLocation(program, "uPitch");
  const uZoom = gl.getUniformLocation(program, "uZoom");
  const uGlobe = gl.getUniformLocation(program, "uGlobe");
  const uMotion = gl.getUniformLocation(program, "uMotion");

  let frame = 0;
  let running = false;
  let destroyed = false;
  let samples = 0;
  let quality = Math.min(window.devicePixelRatio || 1, 1.25);
  const started = performance.now();

  const draw = (now: number) => {
    if (destroyed) return false;
    const view = sample();
    const parent = canvas.parentElement;
    if (!view || !parent) return false;
    const fade = spaceFade(view.zoom);
    canvas.style.opacity = fade.toFixed(3);
    if (fade < 0.01) return false;
    const scale = Math.min(Math.min(window.devicePixelRatio || 1, 2), quality);
    const width = Math.max(2, Math.floor(parent.clientWidth * scale));
    const height = Math.max(2, Math.floor(parent.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduced ? 0 : (now - started) / 1000);
    gl.uniform1f(uBearing, view.bearing);
    gl.uniform1f(uPitch, view.pitch);
    gl.uniform1f(uZoom, view.zoom);
    gl.uniform3f(uGlobe, view.globeX * scale, view.globeY * scale, view.globeR * scale);
    gl.uniform1f(uMotion, reduced ? 0 : 1);
    const drawStart = performance.now();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    samples += 1;
    if (samples > 8) {
      const cost = performance.now() - drawStart;
      if (cost > 8 && quality > 0.5) quality = Math.max(0.5, quality * 0.75);
    }
    return !reduced;
  };

  const loop = (now: number) => {
    if (!running || destroyed) return;
    if (document.hidden) {
      running = false;
      return;
    }
    let keep = false;
    try {
      keep = draw(now);
    } catch {
      running = false;
      return;
    }
    if (!keep) {
      running = false;
      return;
    }
    frame = requestAnimationFrame(loop);
  };

  const wake = () => {
    if (destroyed) return;
    let keep = false;
    try {
      keep = draw(performance.now());
    } catch {
      running = false;
      return;
    }
    if (document.hidden || !keep) {
      running = false;
      cancelAnimationFrame(frame);
      return;
    }
    if (!running) {
      running = true;
      frame = requestAnimationFrame(loop);
    }
  };

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(frame);
      return;
    }
    wake();
  };

  document.addEventListener("visibilitychange", onVisibility);
  wake();

  return {
    sync: wake,
    resize: wake,
    destroy() {
      destroyed = true;
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
