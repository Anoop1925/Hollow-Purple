// ================================================================
// BLUE ORB SHADER v4 â€” Crystalline Singularity Â· Diffraction Rings
//   Deep void center Â· gravitational UV lensing Â· voronoi facets
//   24 crackle arcs Â· 6 infall spirals Â· iridescent Fresnel rim
//   concentric interference rings Â· caustic surface shimmer
// ================================================================

export const BlueOrbVertex = /* glsl */`
  varying vec2  vUv;
  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vFresnel;
  varying vec3  vWorldPos;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uCharge;

  float h21v(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
  float n21v(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(h21v(i),h21v(i+vec2(1,0)),f.x),mix(h21v(i+vec2(0,1)),h21v(i+vec2(1,1)),f.x),f.y);}

  void main() {
    vUv = uv;
    vec3 pos = position;
    float t  = uTime;

    // Multi-frequency gravitational breathing (each axis slightly offset)
    float b1 = sin(pos.x*6.0+t*2.10)*sin(pos.z*7.0+t*1.65)*0.042;
    float b2 = cos(pos.y*7.5+t*1.75)*cos(pos.x*8.5+t*2.30)*0.034;
    float b3 = sin(pos.z*9.0+t*3.20)*cos(pos.y*6.5+t*1.45)*0.026;
    float breathe = (b1+b2+b3) * (0.35 + uCharge*0.65);

    // Cube-cusp spike eruptions: extreme positive tips pierce outward
    float raw   = sin(pos.x*23.0+t*7.2)*sin(pos.y*18.0+t*5.7)*sin(pos.z*20.0+t*6.3);
    float spike = max(0.0, raw*raw*raw) * 0.16 * uCharge;

    // Gravitational infall tremor: surface dents inward at charge nodes
    float indraw = max(0.0, -sin(pos.x*15.0+t*4.5)*sin(pos.y*12.0+t*3.8)) * 0.05 * uCharge;

    // High-freq noise surface jitter (edge fracture)
    float jitter = n21v(vec2(pos.y*11.0+t*6.0, pos.x*9.0+t*4.5)) * 0.016 * uCharge;
    // Medium-scale turbulent displacement
    float turb = n21v(vec2(pos.x*5.5+t*3.2, pos.z*4.8-t*2.5)) * 0.020 * (0.3+uCharge*0.7);

    pos += normal * (breathe + spike - indraw + jitter + turb);

    vec4 wp      = modelMatrix * vec4(pos, 1.0);
    vWorldPos    = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir     = normalize(cameraPosition - wp.xyz);
    vFresnel     = 1.0 - max(dot(vWorldNormal, vViewDir), 0.0);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const BlueOrbFragment = /* glsl */`
  precision highp float;

  varying vec2  vUv;
  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vFresnel;
  varying vec3  vWorldPos;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uCharge;

  // â”€â”€ Core noise library â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  float h21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
  float h21b(vec2 p){p=fract(p*vec2(127.1,311.7));return fract(sin(dot(p,vec2(13.7,93.1)))*43758.5);}
  float n21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p,int o){float v=0.,a=.5;
    for(int i=0;i<4;i++){if(i>=o)break;v+=a*n21(p);p*=2.07;a*=.5;}return v;}

  // â”€â”€ Voronoi: crystalline facet structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Returns: x=edge distance (0=edge, 1=cell center), y=cell id
  vec2 voronoi(vec2 uv, float t) {
    vec2 n = floor(uv * 6.0);
    vec2 f = fract(uv * 6.0);
    float minD1 = 9.9, minD2 = 9.9;
    float cellId = 0.0;
    for (int j=-1; j<=1; j++) for (int i=-1; i<=1; i++) {
      vec2 cell = vec2(float(i),float(j));
      vec2 seed2 = n + cell;
      vec2 pt    = vec2(h21(seed2), h21(seed2+vec2(57.3,13.7)));
      pt += 0.35*sin(t*0.4 + pt*6.28);
      float d = length(cell + pt - f);
      if (d < minD1) { minD2=minD1; minD1=d; cellId=h21(seed2+vec2(23.1,87.4)); }
      else if (d < minD2) { minD2=d; }
    }
    return vec2(minD2 - minD1, cellId); // edge proximity, cell id
  }

  // â”€â”€ Iridescent hue shift (Fresnel-driven) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  vec3 iridBlue(float fr) {
    // Sweeps deep indigo â†’ electric blue â†’ cyan â†’ near-white
    float h = 0.62 - fr * 0.18;  // hue 0.62 (blue) to 0.44 (cyan)
    vec3 c  = clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0,1.0);
    float s = 1.0 - fr * 0.55;
    float v = 0.75 + fr * 0.45;
    return v * mix(vec3(1.0), c, s);
  }

  // â”€â”€ Deep-jag crackle arc â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  float crackArc(vec2 uv, float seed, float t, float spread) {
    float ang  = seed * 6.28318;
    vec2  dir  = vec2(cos(ang), sin(ang));
    vec2  perp = vec2(-dir.y, dir.x);
    vec2  cv   = uv - 0.5;
    float proj = dot(cv, dir);
    float side = dot(cv, perp);
    // 4-level branching jag (coarseâ†’midâ†’fineâ†’micro)
    float j1 = n21(vec2(proj*18.0+seed*37.0,  t*9.0+seed*11.0));
    float j2 = n21(vec2(proj*42.0+seed*19.0, -t*6.5+seed* 7.2)) * 0.40;
    float j3 = n21(vec2(proj*88.0+seed* 9.0,  t*4.8+seed* 3.1)) * 0.18;
    float j4 = n21(vec2(proj*176.+seed* 4.5,  t*2.4+seed* 1.5)) * 0.08;
    float jag = (j1+j2+j3+j4) * spread - spread*0.5;
    // Bolt thins to needle-sharp tip
    float depth = 1.0 - smoothstep(0.03, 0.52, proj);
    float thick = 0.006 + depth * 0.005;
    float line  = 1.0 - smoothstep(0.0, thick, abs(side - jag));
    // Sub-branch glow halo
    float halo  = (1.0 - smoothstep(0.0, thick*3.5, abs(side-jag))) * 0.22;
    float fade  = smoothstep(0.02, 0.12, proj) * (1.0-smoothstep(0.28,0.52,proj));
    float flick = 0.30 + 0.70 * n21(vec2(seed*9.1, t*15.0+seed*7.5));
    return (line + halo) * fade * flick;
  }

  // â”€â”€ Infall logarithmic spiral â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  float inflowSpiral(vec2 uv, float seed, float t) {
    vec2  c = uv - 0.5;
    float r = length(c);
    float a = atan(c.y, c.x);
    // Spiral tightens as râ†’0 (acc. disk geometry)
    float arm   = a + seed*1.5708 - t*2.4 + log(max(r,0.01)*4.0)*(-3.5);
    float stripe = abs(sin(arm * 2.5));
    float bright = 1.0 - smoothstep(0.0, 0.09, stripe);
    // Halo around arm
    float halo   = (1.0 - smoothstep(0.0, 0.22, stripe)) * 0.28;
    float mask   = smoothstep(0.03, 0.14, r) * (1.0 - smoothstep(0.18, 0.45, r));
    return (bright + halo) * mask * (0.6 + 0.4*(-cos(r*18.0-t*5.0)*0.5+0.5));
  }

  // â”€â”€ Isotropic caustic ripple (surface light scattering) â”€â”€â”€â”€â”€â”€â”€
  float caustic(vec2 uv, float t) {
    float c1 = sin((uv.x+uv.y)*12.0 + t*3.1 + fbm(uv*4.0+t*0.2,3)*1.6);
    float c2 = sin((uv.x-uv.y)*15.0 - t*2.8 + fbm(uv*6.0-t*0.15,3)*1.4);
    float c3 = sin(length(uv-0.5)*22.0 - t*4.2);
    return clamp((c1*c2*c3 + 0.5) * 0.6, 0.0, 1.0);
  }

  void main() {
    float t  = uTime;
    vec2  uv = vUv;
    vec2  c  = uv - 0.5;
    float r  = length(c);
    float a  = atan(c.y, c.x);

    // â”€â”€ Gravitational UV lensing (space warps inward) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Pull UV toward singularity, stronger near center
    float pullStr = 0.14 * (1.0 - smoothstep(0.0, 0.50, r));
    vec2  warped  = uv - normalize(c+1e-5) * pullStr * fbm(uv*4.5+t*0.12,4);

    // â”€â”€ Multi-layer FBM turbulence on warped UV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float turb1 = fbm(warped*4.0 + vec2(t*0.22, t*0.17), 7);
    float turb2 = fbm(warped*9.0 - vec2(t*0.31, t*0.25), 5) * 0.42;
    float turb3 = fbm(warped*18.0+ vec2(t*0.18,-t*0.22), 4) * 0.18;
    float en    = turb1 + turb2 + turb3;

    // â”€â”€ FBM-distorted radius for organic perimeter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float rNoise = fbm(vec2(a*0.8, t*0.35), 4) * 0.08
                 + fbm(vec2(a*2.1+t*0.15, r*3.0), 3) * 0.03;
    float rEdge  = r - rNoise;

    // â”€â”€ Voronoi crystalline facets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    vec2  vor     = voronoi(warped, t);
    float facetEdge= smoothstep(0.0, 0.18, vor.x); // bright at cell edges
    float facetId  = vor.y;
    // Each cell has a unique brightness/tint (crystalline reflection)
    float facetGlow= (0.5 + 0.5*sin(facetId*27.3 + t*0.8)) * (1.0-smoothstep(0.30,0.50,rEdge));

    // â”€â”€ Concentric diffraction interference rings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Like light through a pinhole: multiple ring frequencies superposed
    float rings = 0.0;
    float rPhase = rEdge + fbm(vec2(a*1.2, t*0.2), 3)*0.04;
    rings += sin(rPhase*42.0 - t*0.5) * 0.50;
    rings += sin(rPhase*27.0 + t*0.7) * 0.35;
    rings += sin(rPhase*68.0 - t*1.1) * 0.20;
    rings += sin(rPhase*17.0 + t*0.3) * 0.15;
    rings  = clamp(rings * 0.5 + 0.5, 0.0, 1.0);
    float ringMask = smoothstep(0.06, 0.20, rEdge) * (1.0-smoothstep(0.40,0.52,rEdge));
    float ringVal  = rings * ringMask * 0.70;

    // â”€â”€ 24 crackle arcs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float cracks = 0.0;
    for (int i=0; i<10; i++) {
      float fi  = float(i);
      float spd = 1.0 + fi*0.18;
      float sp  = 0.028 + fi*0.0035;
      cracks += crackArc(uv, fi/10.0,            t*spd,     sp    );
      cracks += crackArc(uv, fi/10.0+0.05,       t*spd*0.72,sp*0.50) * 0.48;
    }
    cracks = clamp(cracks, 0.0, 1.0);

    // â”€â”€ 6 infall spirals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float spirals = 0.0;
    for (int i=0; i<3; i++) {
      spirals += inflowSpiral(uv, float(i)*2.0, t);
    }
    spirals = clamp(spirals * uCharge * 1.1, 0.0, 1.0);

    // â”€â”€ Caustic surface shimmer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float caust = caustic(warped, t) * (1.0-smoothstep(0.30,0.52,rEdge)) * 0.55;

    // â”€â”€ 8 upward charge streaks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float streaks = 0.0;
    for (int i=0; i<4; i++) {
      float fi   = float(i);
      float xpos = uv.x + (fi/4.0-0.5)*0.65;
      float spd  = 0.45+fi*0.20;
      float py   = fract(uv.y - t*spd + fi*0.42);
      float beam = (1.0-smoothstep(0.0,0.024,abs(xpos-0.5)))
                 * (1.0-smoothstep(0.0,0.09,py))
                 * (1.0-smoothstep(0.18,0.50,rEdge));
      streaks += beam * 0.55;
    }
    streaks *= uCharge;

    // â”€â”€ Shockwave compression rings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float shockA = sin(rEdge*34.0-t*10.0)*(1.0-smoothstep(0.28,0.55,rEdge));
    float shockB = sin(rEdge*21.0-t* 6.5)*(1.0-smoothstep(0.14,0.44,rEdge));
    float shock  = clamp(max(shockA,shockB)*uCharge*0.45, 0.0,1.0);

    // â”€â”€ Atmospheric shell masks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float voidCore = 1.0-smoothstep(0.0, 0.04, rEdge);  // true singularity
    float innerAtm = 1.0-smoothstep(0.0, 0.19, rEdge);  // dense plasma
    float outerAtm = 1.0-smoothstep(0.0, 0.46, rEdge);  // outer atm
    float haze     = smoothstep(0.30,0.54,rEdge)*(1.0-smoothstep(0.54,0.62,rEdge));
    float rimFr    = pow(vFresnel, 1.1);

    // â”€â”€ Color palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    vec3 cVoid    = vec3(0.00, 0.00, 0.03); // absolute void
    vec3 cInner   = vec3(0.06, 0.36, 0.92); // cobalt plasma
    vec3 cOuter   = vec3(0.02, 0.20, 0.68); // atmospheric blue
    vec3 cCore    = vec3(0.62, 0.84, 1.00); // hot core
    vec3 cCrystal = vec3(0.30, 0.64, 0.95); // crystalline facet
    vec3 cCrack   = vec3(0.58, 0.84, 1.00); // lightning arc
    vec3 cSpiral  = vec3(0.16, 0.52, 0.92); // infall arm
    vec3 cDiffr   = vec3(0.38, 0.70, 0.95); // diffraction ring
    vec3 cHaze    = vec3(0.05, 0.20, 0.58); // outer haze
    vec3 cCaustic = vec3(0.48, 0.78, 0.98); // caustic shimmer
    vec3 cRim     = iridBlue(rimFr);        // iridescent rim

    // â”€â”€ Build color â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    vec3 col = cVoid;
    // Outer atmospheric gradient
    col = mix(col, cOuter, outerAtm*(0.25+en*0.40));
    // Inner plasma sphere
    col = mix(col, cInner, innerAtm*(0.35+en*0.30));
    // Hot singularity edge
    float coreG = pow(clamp(1.0-rEdge/0.19,0.0,1.0), 2.2);
    col = mix(col, cCore, innerAtm*coreG*0.20);
    // Re-crush singularity center to void
    col = mix(col, cVoid, voidCore);
    // Crystalline facets: edge highlights + per-cell glow
    col += cCrystal * facetEdge  * 0.12 * (1.0-smoothstep(0.10,0.48,rEdge));
    col += cCrystal * facetGlow  * 0.07;
    // Diffraction rings (interference pattern)
    col += cDiffr   * ringVal    * 0.18;
    // Crackle arcs
    col += cCrack   * cracks     * 0.28;
    // Infall spirals
    col += cSpiral  * spirals    * 0.20;
    // Caustic shimmer
    col += cCaustic * caust      * 0.10;
    // Charge streaks
    col += cDiffr   * streaks    * 0.20;
    // Outer haze
    col += cHaze    * haze       * 0.15*(0.35+en*0.65);
    // Iridescent rim
    col += cRim     * rimFr      * 0.22;
    // Shockwave rings
    col += cCrack   * shock      * 0.12;
    // Charge shimmer pulse
    col += cCore * (sin(t*10.5+r*30.0)*0.5+0.5)*uCharge*0.03;
    // Edge micro-bursts (unstable discharge near boundary)
    float edgeBand  = smoothstep(0.34,0.46,rEdge)*(1.0-smoothstep(0.46,0.53,rEdge));
    float burstSeed = n21(vec2(a*3.2+t*14.0, r*9.0+t*6.5));
    col += cCrack * step(0.82, burstSeed) * edgeBand * 0.5;
    // Dynamic flicker (non-uniform brightness)
    float flicker = 0.92 + 0.08*sin(t*7.3 + n21(vUv*22.0)*6.28);
    col *= flicker;
    col *= uIntensity;

    // â”€â”€ Alpha â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    float alpha = innerAtm*(0.50+en*0.15)
                + outerAtm * 0.20
                + haze      * 0.14
                + facetEdge * 0.10 * (1.0-smoothstep(0.10,0.48,rEdge))
                + ringVal   * 0.28
                + cracks    * 0.45
                + spirals   * 0.38
                + caust     * 0.18
                + streaks   * 0.40
                + rimFr     * 0.30
                + shock     * 0.22;
    alpha -= voidCore * 0.60; // hollow the true singularity
    alpha  = clamp(alpha * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

