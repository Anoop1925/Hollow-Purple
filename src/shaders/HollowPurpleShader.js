// ================================================================
// HOLLOW PURPLE SHADER v4 — Galactic Void · Iridescent Nebula
//   6-arm galaxy spiral · strong gravitational lensing
//   Voronoi nebula convection · violet→magenta→white iridescence
//   Ring debris fragments · cursed snap arcs · deep singularity
// ================================================================

export const HollowPurpleVertex = /* glsl */`
  varying vec2  vUv;
  varying vec3  vWorldPos;
  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vFresnel;
  uniform float uTime;
  uniform float uScale;

  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n21(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

  void main() {
    vUv = uv;
    vec3 pos = position;
    float t = uTime;

    // Nebula convection surface
    float conv = n21(vec2(pos.x*4.0+t*0.9, pos.y*4.0+t*0.7)) * 0.070
               + n21(vec2(pos.z*6.0-t*0.5, pos.x*5.0+t*0.6)) * 0.048;
    pos += normal * conv * uScale;

    // Asymmetric drift
    float driftX = (n21(vec2(t*0.28+1.1, 0.77))-0.5)*0.045;
    float driftY = (n21(vec2(0.33, t*0.21+2.3))-0.5)*0.045;
    pos.x += driftX * uScale;
    pos.y += driftY * uScale;

    // Slow wobble
    float wobble = sin(t*1.1)*0.032 + cos(t*0.7)*0.024;
    pos += normal * wobble * uScale;

    // Violent surges near full charge
    float surge = n21(vec2(pos.y*9.0+t*2.1, pos.z*8.0-t*1.8))*0.038*uScale;
    // High-freq edge fracture
    float frac = n21(vec2(pos.x*14.0+t*5.5, pos.y*12.0-t*3.8))*0.018*uScale;
    pos += normal * (surge + frac);

    vec4 wp       = modelMatrix * vec4(pos,1.0);
    vWorldPos     = wp.xyz;
    vWorldNormal  = normalize(mat3(modelMatrix)*normal);
    vViewDir      = normalize(cameraPosition-wp.xyz);
    vFresnel      = 1.0-max(dot(vWorldNormal,vViewDir),0.0);
    gl_Position   = projectionMatrix*modelViewMatrix*vec4(pos,1.0);
  }
`;

export const HollowPurpleFragment = /* glsl */`
  precision highp float;

  varying vec2  vUv;
  varying vec3  vWorldPos;
  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vFresnel;

  uniform float uTime;
  uniform float uScale;
  uniform float uIntensity;
  uniform float uBirthProgress;

  // ── Noise library ────────────────────────────────────────────────
  float h21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
  float h21b(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
  float n21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p,int o){float v=0.,a=.5;
    for(int i=0;i<4;i++){if(i>=o)break;v+=a*n21(p);p*=2.07;a*=.5;}return v;}

  // ── Voronoi: nebula cloud cells ───────────────────────────────────
  vec2 voronoi(vec2 uv, float t) {
    vec2 n2 = floor(uv*5.0), f = fract(uv*5.0);
    float minD1=9.9, minD2=9.9, cellId=0.0;
    for(int j=-1;j<=1;j++) for(int i2=-1;i2<=1;i2++){
      vec2 cell=vec2(float(i2),float(j));
      vec2 seed2=n2+cell;
      vec2 pt=vec2(h21(seed2),h21(seed2+vec2(57.3,13.7)));
      pt+=0.38*sin(t*0.35+pt*6.28);
      float d=length(cell+pt-f);
      if(d<minD1){minD2=minD1;minD1=d;cellId=h21(seed2+vec2(23.1,87.4));}
      else if(d<minD2){minD2=d;}
    }
    return vec2(minD2-minD1,cellId);
  }

  // ── Iridescent purple hue (Fresnel-driven) ────────────────────────
  // 0=deep violet → 0.5=magenta/pink → 1=electric white-violet
  vec3 iridPurple(float fr) {
    vec3 deepViolet = vec3(0.42, 0.00, 0.92);
    vec3 violet     = vec3(0.62, 0.10, 1.00);
    vec3 magenta    = vec3(1.00, 0.20, 0.90);
    vec3 pinkWhite  = vec3(1.00, 0.78, 1.00);
    if (fr > 0.75) return mix(magenta, pinkWhite, (fr-0.75)*4.0);
    if (fr > 0.50) return mix(violet,  magenta,   (fr-0.50)*4.0);
    if (fr > 0.25) return mix(deepViolet, violet, (fr-0.25)*4.0);
    return deepViolet;
  }

  // ── Galaxy arm spiral ─────────────────────────────────────────────
  float galaxyArm(vec2 c, float armSeed, float t) {
    float r = length(c);
    float angle = atan(c.y, c.x);
    // Logarithmic spiral: angle offset = log(r)*k
    float logR = log(max(r,0.008)*5.0);
    float armAngle = angle + armSeed*1.0472 + logR*(-2.8) - t*0.55;
    // How close to the arm center line
    float stripe = abs(sin(armAngle*1.0));
    float bulk   = 1.0 - smoothstep(0.0, 0.32, stripe);
    // Arm only exists in a radial band
    float radMask= smoothstep(0.04,0.15,r)*(1.0-smoothstep(0.22,0.46,r));
    // FBM turbulence along the arm
    float turb   = fbm(vec2(logR*4.0+armSeed*7.3, t*0.3+armSeed),3)*0.30;
    return (bulk+turb*0.5)*radMask;
  }

  // ── Violent snap arc ──────────────────────────────────────────────
  float snapArc(vec2 uv, float seed, float t) {
    float cycleSpeed = 3.0+seed*2.2;
    float phase  = fract(t*cycleSpeed+seed*7.3);
    float alive  = step(phase, 0.20);
    float burst  = alive*(1.0-smoothstep(0.0,0.20,phase));
    float baseAng= seed*6.28318+t*0.5;
    // Angular drift: arc rotates slowly
    float ang = baseAng + fbm(vec2(seed*3.1,t*0.18),2)*0.8;
    vec2  dir = vec2(cos(ang),sin(ang));
    vec2  perp= vec2(-dir.y,dir.x);
    vec2  cv  = uv-0.5;
    float proj= dot(cv,dir);
    float side= dot(cv,perp);
    if(proj <0.0||proj>0.50) return 0.0;
    float j1  = n21(vec2(proj*35.0+seed*41.0, t*13.0+seed*13.0))*2.0-1.0;
    float j2  = n21(vec2(proj*78.0+seed*17.0,-t* 9.0+seed* 5.0))*2.0-1.0;
    float j3  = n21(vec2(proj*160.+seed* 8.0, t* 6.0+seed* 2.5))*2.0-1.0;
    float jag = j1*0.026+j2*0.011+j3*0.005;
    float glow= 1.0-smoothstep(0.0,0.007,abs(side-jag));
    float halo= (1.0-smoothstep(0.0,0.028,abs(side-jag)))*0.30;
    float fade= smoothstep(0.04,0.12,proj)*(1.0-smoothstep(0.22,0.42,proj));
    return (glow+halo)*fade*burst*2.5;
  }

  // ── Ring debris fragment (non-uniform arc) ────────────────────────
  float ringDebris(vec2 c, float radius, float angStart, float angEnd,
                   float width, float t, float seed) {
    float r = length(c);
    float a = atan(c.y, c.x);
    // Wobble the ring radius
    float rMod = radius + n21(vec2(a*1.3+seed,t*0.8+seed))*0.018 - 0.009;
    float pulse= 1.0+0.22*sin(t*2.5+seed*6.28);
    // Angular fragment window
    float normA= mod(a-angStart+6.28318, 6.28318);
    float span = mod(angEnd-angStart+6.28318, 6.28318);
    float inArc= step(normA, span);
    // Brightness modulates around the arc
    float nodes= 0.5+0.5*sin(a*9.0+seed*3.14+t*2.8);
    float d    = abs(r-rMod);
    return (1.0-smoothstep(0.0,width*pulse,d))*nodes*inArc;
  }

  // ── Nebula cloud ──────────────────────────────────────────────────
  float nebula(vec2 uv, float t) {
    float v = fbm(uv*3.0+t*0.13, 6);
    v      += fbm(uv*6.5-t*0.09, 5)*0.50;
    v      += fbm(uv*13.0+t*0.21,4)*0.25;
    return clamp(v/1.75, 0.0,1.0);
  }

  // ── Magenta lightning vein ────────────────────────────────────────
  float vein(vec2 uv, float seed, float t) {
    float ang  = seed*6.28318;
    vec2  dir  = vec2(cos(ang),sin(ang));
    vec2  perp = vec2(-dir.y,dir.x);
    vec2  cv   = uv-0.5;
    float proj = dot(cv,dir);
    float side = dot(cv,perp);
    float j1   = n21(vec2(proj*20.0+seed*37.0, t*5.0+seed*11.0));
    float j2   = n21(vec2(proj*45.0+seed*19.0,-t* 4.0+seed* 6.0))*0.45;
    float j3   = n21(vec2(proj*90.0+seed* 9.0, t*3.0+seed* 2.5))*0.20;
    float jag  = (j1+j2+j3)*0.06-0.038;
    float thick= 0.009;
    float line = 1.0-smoothstep(0.0,thick,      abs(side-jag));
    float glow = (1.0-smoothstep(0.0,thick*4.5, abs(side-jag)))*0.25;
    float fade = smoothstep(0.05,0.14,proj)*(1.0-smoothstep(0.32,0.52,proj));
    float flick= 0.25+0.75*n21(vec2(seed*9.2,t*14.0+seed*6.8));
    return (line+glow)*fade*flick;
  }

  void main() {
    float t  = uTime;
    float bp = uBirthProgress;

    // ── Asymmetric center drift ────────────────────────────────────
    vec2 drift = vec2(fbm(vec2(t*0.31,1.30),2)-0.5,
                      fbm(vec2(2.70,t*0.24),2)-0.5)*0.07;
    vec2 uv2= vUv;
    vec2 c  = uv2-0.5+drift;
    float r = length(c);
    float a = atan(c.y,c.x);

    // ── Strong gravitational lensing (stronger than blue: 0.22) ───
    float lensStr = 0.22*(1.0-smoothstep(0.0,0.54,r));
    vec2  warped  = uv2 - normalize(c+1e-5)*lensStr*fbm(uv2*3.5+t*0.12,5);

    // ── FBM turbulence on warped UV ────────────────────────────────
    float turb1 = fbm(warped*3.0+vec2(t*0.16, t*0.12),7);
    float turb2 = fbm(warped*7.0-vec2(t*0.22, t*0.18),5)*0.42;
    float turb3 = fbm(warped*14.0+vec2(t*0.12,-t*0.14),4)*0.18;
    float en    = turb1+turb2+turb3;

    // ── FBM-distorted radius ───────────────────────────────────────
    float rNoise = fbm(vec2(a*0.7,t*0.30),4)*0.07
                 + fbm(vec2(a*1.9+t*0.14,r*2.8),3)*0.03;
    float rEdge  = r-rNoise;

    // ── Voronoi nebula facets ──────────────────────────────────────
    vec2  vor       = voronoi(warped,t);
    float facetEdge = smoothstep(0.0,0.22,vor.x);
    float facetId   = vor.y;
    float facetGlow = (0.40+0.60*sin(facetId*29.1+t*0.55))
                    * (1.0-smoothstep(0.28,0.52,rEdge));

    // ── 6-arm galaxy spiral ────────────────────────────────────────
    float arms = 0.0;
    for (int i=0;i<6;i++) {
      arms += galaxyArm(c, float(i), t);
    }
    arms = clamp(arms*0.70, 0.0,1.0);

    // ── Nebula clouds ──────────────────────────────────────────────
    float neb1 = nebula(warped,t);
    float neb2 = nebula(warped*1.8+vec2(t*0.05,-t*0.04),t*0.7);

    // ── 6 magenta veins ────────────────────────────────────────────
    float veins = 0.0;
    for(int i=0;i<3;i++) veins += vein(uv2-drift, float(i)/3.0, t);
    veins = clamp(veins,0.0,0.85)*(1.0-smoothstep(0.35,0.52,rEdge));

    // ── 8 violent snap arcs ────────────────────────────────────────
    float snaps = 0.0;
    for(int i=0;i<4;i++) snaps += snapArc(uv2-drift, float(i)/4.0, t);
    snaps = clamp(snaps,0.0,1.0)*(1.0-smoothstep(0.28,0.50,rEdge));

    // ── Ring debris (non-uniform arc segments) ─────────────────────
    float rings = 0.0;
    // Inner ring: nearly complete (310° arc)
    rings += ringDebris(c, 0.360, 0.00, 5.41, 0.013, t,     0.0)*0.90;
    // Mid ring A: 200° fragment
    rings += ringDebris(c, 0.420, 0.80, 4.29, 0.010, t*1.2, 1.0)*0.75;
    // Mid ring B: 140° fragment, offset
    rings += ringDebris(c, 0.420, 4.50, 7.00, 0.008, t*0.8, 1.8)*0.60;
    // Outer ring: sparse 170° arc
    rings += ringDebris(c, 0.470, 1.20, 4.17, 0.007, t*1.6, 2.5)*0.45;
    // Dusty micro-ring
    rings += ringDebris(c, 0.312, 0.40, 5.90, 0.005, t*2.0, 3.7)*0.32;
    rings  = clamp(rings, 0.0, 1.0);

    // ── Cursed spiral energy threads ──────────────────────────────
    float threads = 0.0;
    for(int i=0;i<3;i++){
      float ph = float(i)*2.0944;
      float s  = sin(a*5.0+ph+t*2.0-r*14.0);
      threads += smoothstep(0.65,1.0,s)
               * smoothstep(0.05,0.44,r)
               * (1.0-smoothstep(0.44,0.52,r));
    }
    threads = clamp(threads*0.30,0.0,1.0);

    // ── Iridescent diffraction rings ──────────────────────────────
    float rPhase = rEdge + fbm(vec2(a*1.1,t*0.2),3)*0.04;
    float diffrR = sin(rPhase*45.0-t*0.6)*0.50
                 + sin(rPhase*28.0+t*0.7)*0.35
                 + sin(rPhase*73.0-t*1.2)*0.20;
    diffrR = clamp(diffrR*0.5+0.5,0.0,1.0);
    float diffrMask = smoothstep(0.06,0.20,rEdge)*(1.0-smoothstep(0.42,0.54,rEdge));
    float diffrVal  = diffrR*diffrMask*0.65;

    // ── Shockwave expansion ────────────────────────────────────────
    float shockA = sin(rEdge*40.0-t*8.0)*(1.0-smoothstep(0.28,0.54,rEdge));
    float shockB = sin(rEdge*25.0-t*5.0)*(1.0-smoothstep(0.14,0.44,rEdge));
    float shock  = clamp(max(shockA,shockB)*0.45,0.0,1.0);

    // ── Atmospheric masks ──────────────────────────────────────────
    float voidCore  = 1.0-smoothstep(0.0,0.05,rEdge);  // deep singularity
    float innerCore = 1.0-smoothstep(0.0,0.22,rEdge);
    float nebBand   = smoothstep(0.05,0.48,rEdge)*(1.0-smoothstep(0.48,0.54,rEdge));
    float hazeBand  = smoothstep(0.32,0.54,rEdge)*(1.0-smoothstep(0.54,0.64,rEdge));
    float rimFr     = pow(vFresnel,1.15);

    // ── Color palette ──────────────────────────────────────────────
    vec3 cAbyss   = vec3(0.00,0.00,0.02);   // absolute void
    vec3 cDeep    = vec3(0.20,0.00,0.40);   // dense inner purple
    vec3 cViolet  = vec3(0.42,0.00,0.82);   // mid violet body
    vec3 cElec    = vec3(0.60,0.10,0.95);   // electric violet
    vec3 cMagenta = vec3(0.92,0.06,0.75);   // magenta veins
    vec3 cSnap    = vec3(0.95,0.85,1.00);   // snap arc hot
    vec3 cRing    = vec3(0.78,0.48,0.95);   // ring sparkle
    vec3 cThread  = vec3(0.62,0.14,0.90);   // cursed spiral
    vec3 cArm     = vec3(0.48,0.05,0.85);   // galaxy arm
    vec3 cHaze    = vec3(0.35,0.04,0.62);   // outer haze
    vec3 cDiffr   = vec3(0.68,0.38,0.92);   // diffraction tint
    vec3 cRim     = iridPurple(rimFr);      // iridescent rim

    // ── Build color ────────────────────────────────────────────────
    vec3 col = cAbyss;
    // Nebula body
    col = mix(col, cDeep,   nebBand  *(0.28+en*0.40));
    col = mix(col, cViolet, nebBand  *(0.20+neb1*0.45));
    col = mix(col, cElec,   innerCore*(0.35+neb2*0.30));
    col = mix(col, cAbyss,  voidCore *1.50);  // crush singularity
    // Galaxy arms illuminate the nebula
    col += cArm    * arms      * 0.18*(1.0-smoothstep(0.10,0.46,rEdge));
    // Voronoi facets
    col += cViolet * facetEdge * 0.09*(1.0-smoothstep(0.10,0.50,rEdge));
    col += cElec   * facetGlow * 0.06;
    // Diffraction rings
    col += cDiffr  * diffrVal  * 0.20;
    // Veins
    col += cMagenta* veins     * 0.25;
    // Cursed threads
    col += cThread * threads   * 0.18;
    // Rings
    col += cRing   * rings     * 0.22;
    // Iridescent rim
    col += cRim    * rimFr     * 0.24;
    // Outer haze
    col += cHaze   * hazeBand  * 0.14*(0.30+en*0.70);
    // Snap arcs
    col += cSnap   * snaps     * 0.38;
    // Shockwave
    col += cDiffr  * shock     * 0.12;
    // Charge shimmer
    col += cElec*(sin(t*8.5+r*22.0)*0.5+0.5)*0.02;
    // Edge glitch flickers (spacetime instability)
    float edgeBand  = smoothstep(0.38,0.50,rEdge)*(1.0-smoothstep(0.50,0.56,rEdge));
    float burstSeed = n21(vec2(a*3.5+t*12.0, r*8.0+t*5.0));
    col += cSnap * step(0.80, burstSeed) * edgeBand * 0.55;
    // Dynamic glitch flicker
    float flicker = 0.93 + 0.07*sin(t*6.8 + n21(vUv*18.0)*6.28);
    col *= flicker;

    // Birth reveal flare
    col *= (0.30+bp*0.70);
    float birthFlare = max(0.0,1.0-bp*2.5)*0.5;
    col  += cElec * birthFlare;

    col *= uIntensity;

    // ── Alpha ──────────────────────────────────────────────────────
    float alpha = innerCore*(0.38+neb1*0.18)
                + nebBand  *(0.28+neb2*0.16)
                + hazeBand * 0.14
                + facetEdge*0.08*(1.0-smoothstep(0.10,0.50,rEdge))
                + diffrVal * 0.26
                + arms     * 0.30
                + veins    * 0.45
                + threads  * 0.35
                + rings    * 0.40
                + rimFr    * 0.28
                + snaps    * 0.50
                + shock    * 0.18;
    alpha -= voidCore*0.90;  // deep hollow at center
    alpha  = clamp(alpha*uIntensity, 0.0,1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;
