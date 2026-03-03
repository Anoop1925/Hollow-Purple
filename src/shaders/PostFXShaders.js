// ================================================================
// GLITCH SHADER — Screen Chromatic Aberration + Scan Lines + RGB Split
// Also: Gravitational lens distortion pass
// ================================================================

export const GlitchShader = {
  uniforms: {
    tDiffuse:    { value: null },
    uTime:       { value: 0.0 },
    uAmount:     { value: 0.0 },  // 0 = off, 1 = full glitch
    uRGBSplit:   { value: 0.0 },  // chromatic aberration spread
    uScanlines:  { value: 0.0 },
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uRGBSplit;
    uniform float uScanlines;
    varying vec2 vUv;

    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;

      // ── Horizontal glitch bands ──────────────────────────
      float band = floor(uv.y * 60.0);
      float rnd  = rand(vec2(band, floor(uTime * 15.0)));
      float shift = (rnd - 0.5) * 0.04 * uAmount * step(0.85, rnd);
      uv.x += shift;

      // ── Block displacement ───────────────────────────────
      float blockY    = floor(uv.y * 12.0) / 12.0;
      float blockRand = rand(vec2(blockY, floor(uTime * 8.0)));
      if (blockRand > 0.92 && uAmount > 0.3) {
        uv.x += (blockRand - 0.92) * 0.3 * uAmount;
      }

      // ── Chromatic aberration (RGB split) ─────────────────
      float splitAmt = uRGBSplit * (0.004 + uAmount * 0.006);
      vec2  uvR   = vec2(uv.x + splitAmt, uv.y);
      vec2  uvG   = uv;
      vec2  uvB   = vec2(uv.x - splitAmt, uv.y);

      // Edge-aware split: stronger at corners
      float edgeFactor = length(uv - 0.5) * 2.0;
      uvR = mix(uv, uvR, edgeFactor);
      uvB = mix(uv, uvB, edgeFactor);

      float r = texture2D(tDiffuse, uvR).r;
      float g = texture2D(tDiffuse, uvG).g;
      float b = texture2D(tDiffuse, uvB).b;
      float a = texture2D(tDiffuse, uv ).a;

      vec4 col = vec4(r, g, b, a);

      // ── Scan lines ───────────────────────────────────────
      if (uScanlines > 0.01) {
        float scan = sin(uv.y * 400.0) * 0.5 + 0.5;
        col.rgb   -= scan * 0.08 * uScanlines;
      }

      // ── Occasional bright flash row ───────────────────────
      float flashRand = rand(vec2(0.0, floor(uTime * 20.0)));
      if (flashRand > 0.95 && uAmount > 0.5) {
        float flashY = rand(vec2(flashRand, 1.0));
        float flashD = abs(uv.y - flashY);
        col.rgb += vec3(1.0, 0.8, 1.0) * (1.0 - smoothstep(0.0, 0.005, flashD)) * uAmount;
      }

      // ── Vignette overlay just within glitch ──────────────
      float vig = 1.0 - uAmount * 0.12 * (1.0 - length(uv - 0.5));
      col.rgb *= clamp(vig, 0.0, 1.2);

      gl_FragColor = col;
    }
  `
};

// ================================================================
// GRAVITATIONAL LENS SHADER — used as a distortion mask around
// the Hollow Purple orb (applied via a EffectComposer pass)
// ================================================================
export const GravLensShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uOrbPos:    { value: [0.5, 0.5] }, // vec2 screen-space [0,1]
    uRadius:    { value: 0.12 },
    uStrength:  { value: 0.0 },
    uTime:      { value: 0.0 },
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2  uOrbPos;
    uniform float uRadius;
    uniform float uStrength;
    uniform float uTime;
    varying vec2  vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p+34.23); return fract(p.x*p.y);
    }
    float n21(vec2 p) {
      vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),
                 mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
    }

    void main() {
      vec2 uv   = vUv;
      vec2 diff = uv - uOrbPos;
      float d   = length(diff);

      // Lens-like radial distortion — photons bent around the singularity
      float falloff = 1.0 - smoothstep(0.0, uRadius, d);
      float lensD   = falloff * falloff * uStrength;

      // Add subtle time-based shimmer to the distortion
      float shimmer = n21(diff * 30.0 + uTime * 0.5) * 0.1 - 0.05;
      lensD *= (1.0 + shimmer);

      // Bend UV toward the orb center
      vec2 bentUv = uv - normalize(diff + 1e-6) * lensD;

      // Dark ring just outside the singularity boundary (event-like)
      float ringD = abs(d - uRadius * 0.88);
      float ring  = (1.0 - smoothstep(0.0, uRadius * 0.06, ringD)) * uStrength * 0.5;

      vec4  sceneCol  = texture2D(tDiffuse, bentUv);
      sceneCol.rgb   *= 1.0 - ring * 0.7;

      gl_FragColor = sceneCol;
    }
  `
};

// ================================================================
// PARTICLE VERT/FRAG — for the debris particle system
// ================================================================
export const ParticleVertex = /* glsl */`
  attribute float aAge;
  attribute float aSize;
  attribute vec3  aColor;

  uniform float uTime;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = 1.0 - aAge;

    vec4 mvPos  = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (200.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

export const ParticleFragment = /* glsl */`
  precision mediump float;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // Soft circular particle
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = 1.0 - smoothstep(0.35, 0.5, d);
    if (a < 0.01) discard;

    // Bright hot center
    float core = 1.0 - smoothstep(0.0, 0.2, d);
    vec3 col   = vColor + core * 0.6;

    gl_FragColor = vec4(col, a * vAlpha);
  }
`;
