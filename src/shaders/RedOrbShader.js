// ================================================================
// RED ORB SHADER v4 — Solar Plasma Inferno · Coronal Loops
//   Blackbody temperature gradient · magnetic field lines
//   Voronoi plasma convection · erratic eruption spikes
//   16 coronal arcs · 6 prominence plumes · 24 micro-sparks
// ================================================================

export const RedOrbVertex = /* glsl */`
  varying vec2  vUv;
  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vFresnel;
  varying vec3  vWorldPos;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uCharge;

  float h21v(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.23);return fract(p.x*p.y);}
  float n21v(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(h21v(i),h21v(i+vec2(1,0)),f.x),mix(h21v(i+vec2(0,1)),h21v(i+vec2(1,1)),f.x),f.y);}

  void main() {
    vUv = uv;
    vec3 pos = position;
    float t  = uTime;

    float b1 = sin(pos.x*5.0+t*2.40)*sin(pos.z*6.0+t*1.80)*0.044;
    float b2 = cos(pos.y*7.0+t*1.95)*cos(pos.x*8.0+t*2.60)*0.036;
    float b3 = sin(pos.z*9.5+t*3.50)*cos(pos.y*7.5+t*1.55)*0.028;
    float breathe = (b1+b2+b3) * (0.40 + uCharge*0.60);

    float raw    = sin(pos.x*22.0+t*8.5)*sin(pos.y*17.0+t*6.8)*sin(pos.z*19.0+t*7.4);
    float raw2   = sin(pos.x*14.0-t*5.2)*cos(pos.y*13.0+t*4.1)*sin(pos.z*16.0-t*6.0);
    float erupt  = max(0.0, raw*raw*raw)   * 0.18 * uCharge;
    float erupt2 = max(0.0, raw2*raw2*raw2) * 0.12 * uCharge;

    float repulse = max(0.0, sin(t*6.2 + h21v(pos.xy)*6.28)) * 0.032 * uCharge;
    float jitter1 = n21v(vec2(pos.y*12.0+t*7.5, pos.x*10.0+t*5.5)) * 0.016 * uCharge;
    float jitter2 = n21v(vec2(pos.z*15.0-t*6.0, pos.y*11.0+t*4.8)) * 0.012 * uCharge;
    float macro   = sin(pos.x*3.5+t*1.8+pos.y*2.2)*0.024*(0.4+uCharge*0.6);

    pos += normal * (breathe + erupt + erupt2 + repulse + jitter1 + jitter2 + macro);

    vec4 wp      = modelMatrix * vec4(pos, 1.0);
    vWorldPos    = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir     = normalize(cameraPosition - wp.xyz);
    vFresnel     = 1.0 - max(dot(vWorldNormal, vViewDir), 0.0);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const RedOrbFragment = /* glsl */`
  precision highp float;

  varying vec2  vUv;
  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vFresnel;
  varying vec3  vWorldPos;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uCharge;

  float h21(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.23);return fract(p.x*p.y);}
  float n21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p,int o){float v=0.,a=.5;
    for(int i=0;i<4;i++){if(i>=o)break;v+=a*n21(p);p*=2.07;a*=.5;}return v;}

  vec2 voronoi(vec2 uv, float t) {
    vec2 n = floor(uv * 5.0);
    vec2 f = fract(uv * 5.0);
    float minD1 = 9.9, minD2 = 9.9, cellId = 0.0;
    for (int j=-1; j<=1; j++) for (int i=-1; i<=1; i++) {
      vec2 cell = vec2(float(i),float(j));
      vec2 seed2 = n + cell;
      vec2 pt    = vec2(h21(seed2), h21(seed2+vec2(57.3,13.7)));
      pt += 0.40*sin(t*0.65 + pt*6.28);
      float d = length(cell + pt - f);
      if (d < minD1) { minD2=minD1; minD1=d; cellId=h21(seed2+vec2(23.1,87.4)); }
      else if (d < minD2) { minD2=d; }
    }
    return vec2(minD2 - minD1, cellId);
  }

  vec3 blackbodyRed(float temp) {
    vec3 white   = vec3(1.00, 0.98, 0.90);
    vec3 yellow  = vec3(1.00, 0.82, 0.22);
    vec3 orange  = vec3(1.00, 0.42, 0.08);
    vec3 red     = vec3(0.90, 0.10, 0.04);
    vec3 crimson = vec3(0.55, 0.02, 0.02);
    if (temp > 0.75) return mix(yellow, white,  (temp-0.75)*4.0);
    if (temp > 0.50) return mix(orange, yellow, (temp-0.50)*4.0);
    if (temp > 0.25) return mix(red,    orange, (temp-0.25)*4.0);
    return mix(crimson, red, temp*4.0);
  }

  float coronalLoop(vec2 uv, float seed, float t) {
    float ang  = seed * 6.28318 + t * 0.18;
    vec2  dir  = vec2(cos(ang), sin(ang));
    vec2  perp = vec2(-dir.y, dir.x);
    vec2  cv   = uv - 0.5;
    float proj = dot(cv, dir);
    float side = dot(cv, perp);
    if (proj < 0.0 || proj > 0.52) return 0.0;
    float archH = sin(proj / 0.52 * 3.14159) * 0.12;
    float magJ  = n21(vec2(proj*32.0+seed*17.0, t*5.5)) * 0.018
                + n21(vec2(proj*64.0+seed* 9.0,-t*3.2)) * 0.008;
    float thick  = 0.007 + (1.0-proj/0.52)*0.004;
    float line   = 1.0-smoothstep(0.0, thick,     abs(side-archH-magJ));
    float glow   = (1.0-smoothstep(0.0, thick*4.0, abs(side-archH-magJ)))*0.30;
    float flicker= 0.25 + 0.75*n21(vec2(seed*11.3, t*12.0+seed*5.7));
    float fade   = smoothstep(0.0,0.04,proj)*(1.0-smoothstep(0.45,0.52,proj));
    return (line+glow)*flicker*fade;
  }

  float prominence(vec2 uv, float seed, float t) {
    float ang  = seed * 6.28318;
    vec2  dir  = vec2(cos(ang), sin(ang));
    vec2  perp = vec2(-dir.y, dir.x);
    vec2  cv   = uv - 0.5;
    float proj = dot(cv, dir);
    float side = dot(cv, perp);
    if (proj < 0.05 || proj > 0.48) return 0.0;
    float j1  = n21(vec2(proj*20.0+seed*13.0,  t*8.0+seed*7.0));
    float j2  = n21(vec2(proj*45.0+seed* 7.0, -t*5.0+seed*3.0)) * 0.35;
    float jag = (j1+j2)*0.045 - 0.022;
    float width = 0.020*(1.0-proj/0.48);
    float beam  = 1.0-smoothstep(0.0, width,     abs(side-jag));
    float halo  = (1.0-smoothstep(0.0, width*5.0, abs(side-jag)))*0.18;
    float flick = 0.30+0.70*n21(vec2(seed*8.8, t*18.0+seed*6.2));
    float fade  = smoothstep(0.04,0.14,proj)*(1.0-smoothstep(0.32,0.48,proj));
    return (beam+halo)*flick*fade;
  }

  float spark(vec2 uv, float seed, float t) {
    float ang  = seed*6.28318 + n21(vec2(seed*5.1, floor(t*4.0+seed)*0.25))*0.8;
    vec2  dir  = vec2(cos(ang), sin(ang));
    vec2  perp = vec2(-dir.y, dir.x);
    vec2  cv   = uv - 0.5;
    float proj = dot(cv, dir);
    float side = dot(cv, perp);
    if (proj < 0.0) return 0.0;
    float len  = 0.04+n21(vec2(seed*7.3, floor(t*3.0+seed)*0.33))*0.12;
    float fade = smoothstep(0.01,0.03,proj)*(1.0-smoothstep(len*0.6,len,proj));
    float line = 1.0-smoothstep(0.0,0.004,abs(side));
    float blink= step(0.42, n21(vec2(seed*9.5, t*22.0+seed*4.1)));
    return line*fade*blink;
  }

  void main() {
    float t  = uTime;
    vec2  uv = vUv;
    vec2  c  = uv - 0.5;
    float r  = length(c);
    float a  = atan(c.y, c.x);

    float pushStr = 0.10*smoothstep(0.18, 0.50, r);
    vec2  warped  = uv + normalize(c+1e-5)*pushStr*fbm(uv*5.5+t*0.15,4);

    float turb1 = fbm(warped*3.5+vec2( t*0.28, t*0.20),7);
    float turb2 = fbm(warped*8.0-vec2( t*0.35, t*0.27),5)*0.45;
    float turb3 = fbm(warped*16.0+vec2(t*0.22,-t*0.18),4)*0.20;
    float en    = turb1+turb2+turb3;

    float rNoise = fbm(vec2(a*0.9, t*0.45),5)*0.10
                 + fbm(vec2(a*2.3+t*0.22, r*3.5),3)*0.04
                 + fbm(vec2(a*4.7-t*0.18, r*6.0),2)*0.016;
    float rEdge  = r - rNoise;

    vec2  vor      = voronoi(warped, t);
    float cellEdge = smoothstep(0.0, 0.20, vor.x);
    float cellId   = vor.y;
    float cellTemp = 0.40+0.60*sin(cellId*31.7+t*0.65);
    float cellGlow = cellTemp*(1.0-smoothstep(0.28,0.50,rEdge));

    float tempT    = clamp(1.0-rEdge/0.48+en*0.12, 0.0,1.0);
    float tempCell = clamp(tempT*(0.75+cellTemp*0.25), 0.0,1.0);
    vec3  plasma   = blackbodyRed(tempCell);

    float rPhase = rEdge+fbm(vec2(a*1.1,t*0.18),3)*0.03;
    float rings  = sin(rPhase*38.0-t*0.6)*0.50
                 + sin(rPhase*23.0+t*0.8)*0.35
                 + sin(rPhase*61.0-t*1.3)*0.22
                 + sin(rPhase*14.0+t*0.4)*0.16;
    rings = clamp(rings*0.5+0.5,0.0,1.0);
    float ringMask = smoothstep(0.05,0.18,rEdge)*(1.0-smoothstep(0.38,0.52,rEdge));
    float ringVal  = rings*ringMask*0.55;

    float loops = 0.0;
    for (int i=0;i<4;i++) loops += coronalLoop(uv, float(i)/4.0, t*(1.0+float(i)*0.16));
    loops = clamp(loops*uCharge, 0.0, 1.0);

    float plumes = 0.0;
    for (int i=0;i<3;i++) plumes += prominence(uv, float(i)/3.0+0.08333, t);
    plumes = clamp(plumes*uCharge*1.2, 0.0, 1.0);

    float sparks = 0.0;
    for (int i=0;i<10;i++) sparks += spark(uv, float(i)/10.0, t);
    sparks = clamp(sparks*uCharge, 0.0, 1.0);

    float streaks = 0.0;
    for (int i=0;i<5;i++) {
      float fi = float(i);
      float xpos = uv.x+(fi/5.0-0.5)*0.72;
      float py   = fract(uv.y+t*(0.55+fi*0.18)+fi*0.38);
      float beam = (1.0-smoothstep(0.0,0.022,abs(xpos-0.5)))
                 * (1.0-smoothstep(0.0,0.08,py))
                 * (1.0-smoothstep(0.18,0.48,rEdge));
      streaks += beam*0.60;
    }
    streaks *= uCharge;

    float shockA = sin(rEdge*36.0-t*11.5)*(1.0-smoothstep(0.26,0.52,rEdge));
    float shockB = sin(rEdge*22.0-t* 7.0)*(1.0-smoothstep(0.14,0.44,rEdge));
    float shock  = clamp(max(shockA,shockB)*uCharge*0.50, 0.0,1.0);

    float voidCore = 1.0-smoothstep(0.0, 0.04, rEdge);
    float innerAtm = 1.0-smoothstep(0.0, 0.20, rEdge);
    float outerAtm = 1.0-smoothstep(0.0, 0.48, rEdge);
    float haze     = smoothstep(0.30,0.52,rEdge)*(1.0-smoothstep(0.52,0.62,rEdge));
    float rimFr    = pow(vFresnel, 1.05);

    vec3 cVoid  = vec3(0.05, 0.00, 0.00);
    vec3 cCrack = vec3(0.92, 0.72, 0.35);
    vec3 cLoop  = vec3(0.95, 0.52, 0.14);
    vec3 cSpark = vec3(1.00, 0.88, 0.55);
    vec3 cRim   = vec3(0.95, 0.22, 0.05);
    vec3 cHaze  = vec3(0.58, 0.06, 0.02);
    vec3 cDiffr = vec3(0.90, 0.45, 0.12);
    vec3 cPlume = vec3(0.92, 0.38, 0.10);

    vec3 col = cVoid;
    col = mix(col, plasma*0.22, outerAtm*(0.22+en*0.40));
    col = mix(col, plasma*0.35, innerAtm*(0.38+en*0.30));
    float coreG = pow(clamp(1.0-rEdge/0.20,0.0,1.0), 2.4);
    col = mix(col, vec3(1.00,0.88,0.55), innerAtm*coreG*0.20);
    col = mix(col, cVoid, voidCore*0.80);
    col += cCrack * cellEdge*cellGlow*0.10*(1.0-smoothstep(0.10,0.48,rEdge));
    col += cDiffr * ringVal *0.16;
    col += cLoop  * loops   *0.26;
    col += cPlume * plumes  *0.22;
    col += cSpark * sparks  *0.30;
    col += cCrack * streaks *0.20;
    col += cHaze  * haze    *0.15*(0.30+en*0.70);
    col += mix(cRim, vec3(0.92,0.62,0.28), rimFr*0.5) * rimFr * 0.22;
    col += cCrack * shock   *0.12;
    col += vec3(0.92,0.55,0.15)*(sin(t*14.0+r*28.0)*0.5+0.5)*uCharge*0.03;
    // Edge micro-eruptions (volatile discharge)
    float edgeBand  = smoothstep(0.32,0.44,rEdge)*(1.0-smoothstep(0.44,0.52,rEdge));
    float burstSeed = n21(vec2(a*4.0+t*16.0, r*10.0+t*7.0));
    col += cSpark * step(0.78, burstSeed) * edgeBand * 0.6;
    // Dynamic flicker (aggressive instability)
    float flicker = 0.92 + 0.08*sin(t*9.5 + n21(vUv*20.0)*6.28);
    col *= flicker;
    col *= uIntensity;

    float alpha = innerAtm*(0.52+en*0.12)
                + outerAtm*0.22 + haze*0.15
                + cellEdge*cellGlow*0.10*(1.0-smoothstep(0.10,0.48,rEdge))
                + ringVal*0.26 + loops*0.42 + plumes*0.38
                + sparks*0.45  + streaks*0.38
                + rimFr*0.30   + shock*0.20;
    alpha -= voidCore*0.55;
    alpha  = clamp(alpha*uIntensity, 0.0,1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;
