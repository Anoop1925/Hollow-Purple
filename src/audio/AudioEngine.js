// ================================================================
// AudioEngine.js — Web Audio API synthesized sound design
// Every sound is generated procedurally — no audio files needed.
// ================================================================

export class AudioEngine {
  constructor() {
    this._ctx      = null;
    this._ready    = false;
    this._nodes    = {};   // running persistent nodes
    this._muted    = false;
  }

  // Call once on first user interaction (browser requires gesture)
  init() {
    if (this._ready) return;
    this._ctx   = new (window.AudioContext || window.webkitAudioContext)();
    this._master = this._ctx.createGain();
    this._master.gain.value = 0.7;
    this._master.connect(this._ctx.destination);
    this._ready = true;
  }

  get ctx() { return this._ctx; }

  // ─────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────
  _createGain(val = 1.0) {
    const g = this._ctx.createGain();
    g.gain.value = val;
    g.connect(this._master);
    return g;
  }

  _osc(type, freq, gainVal, dest) {
    const o = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    o.type      = type;
    o.frequency.value = freq;
    g.gain.value      = gainVal;
    o.connect(g);
    g.connect(dest || this._master);
    o.start();
    return { osc: o, gain: g };
  }

  _noise(gainVal, dest) {
    const N       = this._ctx.sampleRate * 2;
    const buffer  = this._ctx.createBuffer(1, N, this._ctx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < N; i++) data[i] = Math.random() * 2 - 1;
    const src     = this._ctx.createBufferSource();
    src.buffer    = buffer;
    src.loop      = true;
    const g       = this._ctx.createGain();
    g.gain.value  = gainVal;
    src.connect(g);
    g.connect(dest || this._master);
    src.start();
    return { src, gain: g };
  }

  // ─────────────────────────────────────────────────────────────
  // BLUE — gravitational hum + high whine
  // ─────────────────────────────────────────────────────────────
  startBlue(charge = 0) {
    if (!this._ready) return;
    this.stopBlue();

    const filter = this._ctx.createBiquadFilter();
    filter.type            = 'bandpass';
    filter.frequency.value = 440 + charge * 800;
    filter.Q.value         = 12;
    filter.connect(this._master);

    const hum   = this._osc('sine', 60 + charge * 30, 0.15, filter);
    const whine = this._osc('triangle', 1200 + charge * 600, 0.04, this._master);
    const { src: noise, gain: noiseGain } = this._noise(0.03, filter);

    this._nodes.blue = { hum, whine, noise: { src: noise, gain: noiseGain }, filter };
  }

  updateBlueCharge(charge) {
    if (!this._nodes.blue || !this._ready) return;
    const { hum, whine, filter } = this._nodes.blue;
    const t = this._ctx.currentTime;
    hum.osc.frequency.setTargetAtTime(60 + charge * 40,   t, 0.1);
    hum.gain.gain.setTargetAtTime(0.1 + charge * 0.25,    t, 0.1);
    whine.osc.frequency.setTargetAtTime(1200 + charge * 800, t, 0.15);
    whine.gain.gain.setTargetAtTime(0.02 + charge * 0.06, t, 0.1);
    filter.frequency.setTargetAtTime(440 + charge * 1200, t, 0.1);
  }

  stopBlue() {
    if (!this._nodes.blue) return;
    const { hum, whine, noise } = this._nodes.blue;
    const t = this._ctx.currentTime;
    hum.gain.gain.setTargetAtTime(0,   t, 0.2);
    whine.gain.gain.setTargetAtTime(0, t, 0.2);
    noise.gain.gain.setTargetAtTime(0, t, 0.2);
    setTimeout(() => {
      try { hum.osc.stop();   } catch(e) {}
      try { whine.osc.stop(); } catch(e) {}
      try { noise.src.stop(); } catch(e) {}
    }, 800);
    delete this._nodes.blue;
  }

  // ─────────────────────────────────────────────────────────────
  // RED — crackling plasma + sub-bass
  // ─────────────────────────────────────────────────────────────
  startRed(charge = 0) {
    if (!this._ready) return;
    this.stopRed();

    const dist = this._ctx.createWaveShaper();
    const k    = 200;
    const n    = 256;
    const c    = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      c[i]    = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }
    dist.curve = c;
    dist.oversample = '4x';
    dist.connect(this._master);

    const bass   = this._osc('sine', 40,  0.3, dist);
    const crackle = this._noise(0.2, dist);

    const filter = this._ctx.createBiquadFilter();
    filter.type            = 'highpass';
    filter.frequency.value = 2000;
    filter.connect(this._master);
    const spark = this._noise(0.1, filter);

    this._nodes.red = { bass, crackle, spark, dist, filter };
  }

  updateRedCharge(charge) {
    if (!this._nodes.red || !this._ready) return;
    const { bass, crackle, spark } = this._nodes.red;
    const t = this._ctx.currentTime;
    bass.gain.gain.setTargetAtTime(0.2 + charge * 0.4, t, 0.1);
    crackle.gain.gain.setTargetAtTime(0.1 + charge * 0.3, t, 0.1);
    spark.gain.gain.setTargetAtTime(0.05 + charge * 0.15, t, 0.1);
  }

  stopRed() {
    if (!this._nodes.red) return;
    const { bass, crackle, spark } = this._nodes.red;
    const t = this._ctx.currentTime;
    bass.gain.gain.setTargetAtTime(0, t, 0.2);
    crackle.gain.gain.setTargetAtTime(0, t, 0.2);
    spark.gain.gain.setTargetAtTime(0, t, 0.2);
    setTimeout(() => {
      try { bass.osc.stop();    } catch(e) {}
      try { crackle.src.stop(); } catch(e) {}
      try { spark.src.stop();   } catch(e) {}
    }, 800);
    delete this._nodes.red;
  }

  // ─────────────────────────────────────────────────────────────
  // FUSION — metallic tearing chaos
  // ─────────────────────────────────────────────────────────────
  playFusion() {
    if (!this._ready) return;
    this.stopBlue(); this.stopRed();

    const t    = this._ctx.currentTime;
    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.linearRampToValueAtTime(1.2, t + 0.3);
    gain.gain.linearRampToValueAtTime(0.0, t + 1.5);
    gain.connect(this._master);

    const chaos = this._ctx.createOscillator();
    chaos.type = 'sawtooth';
    chaos.frequency.setValueAtTime(200, t);
    chaos.frequency.linearRampToValueAtTime(1800, t + 0.6);
    chaos.frequency.exponentialRampToValueAtTime(60, t + 1.4);
    chaos.connect(gain);
    chaos.start(t);
    chaos.stop(t + 1.5);

    // Noise burst
    const { src: nSrc, gain: nGain } = this._noise(0.5, gain);
    nGain.gain.setValueAtTime(0.5, t);
    nGain.gain.linearRampToValueAtTime(0, t + 1.2);
    setTimeout(() => { try { nSrc.stop(); } catch(e) {} }, 1600);
  }

  // ─────────────────────────────────────────────────────────────
  // IMPLOSION — silent mute then sub-bass slam
  // ─────────────────────────────────────────────────────────────
  playImplosion() {
    if (!this._ready) return;
    const t = this._ctx.currentTime;

    // Muffled silence
    this._master.gain.setValueAtTime(0.7, t);
    this._master.gain.linearRampToValueAtTime(0.0, t + 0.25);

    // Sub-bass slam after silence
    setTimeout(() => {
      if (!this._ready) return;
      const t2    = this._ctx.currentTime;
      const slam  = this._ctx.createOscillator();
      const sGain = this._ctx.createGain();
      slam.type = 'sine';
      slam.frequency.setValueAtTime(35, t2);
      slam.frequency.exponentialRampToValueAtTime(20, t2 + 0.8);
      sGain.gain.setValueAtTime(1.5, t2);
      sGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.9);
      slam.connect(sGain);
      sGain.connect(this._master);
      slam.start(t2);
      slam.stop(t2 + 0.9);

      this._master.gain.setValueAtTime(0.0, t2);
      this._master.gain.linearRampToValueAtTime(0.7, t2 + 0.4);
    }, 280);
  }

  // ─────────────────────────────────────────────────────────────
  // HOLLOW PURPLE — deep resonant cosmic hum
  // ─────────────────────────────────────────────────────────────
  startPurple() {
    if (!this._ready) return;
    this.stopPurple();

    const t = this._ctx.currentTime;

    const filter = this._ctx.createBiquadFilter();
    filter.type            = 'peaking';
    filter.frequency.value = 300;
    filter.gain.value      = 15;
    filter.Q.value         = 2;
    filter.connect(this._master);

    const low  = this._osc('sine', 55, 0.4, filter);
    const mid  = this._osc('sine', 110, 0.15, this._master);
    const high = this._osc('triangle', 440, 0.05, this._master);

    low.gain.gain.setValueAtTime(0, t);
    low.gain.gain.linearRampToValueAtTime(0.4, t + 0.5);

    this._nodes.purple = { low, mid, high, filter };
  }

  stopPurple() {
    if (!this._nodes.purple) return;
    const { low, mid, high } = this._nodes.purple;
    const t = this._ctx.currentTime;
    low.gain.gain.setTargetAtTime(0, t, 0.3);
    mid.gain.gain.setTargetAtTime(0, t, 0.3);
    high.gain.gain.setTargetAtTime(0, t, 0.3);
    setTimeout(() => {
      try { low.osc.stop();  } catch(e) {}
      try { mid.osc.stop();  } catch(e) {}
      try { high.osc.stop(); } catch(e) {}
    }, 1200);
    delete this._nodes.purple;
  }

  // ─────────────────────────────────────────────────────────────
  // RELEASE — violent explosive burst, silence, roar
  // ─────────────────────────────────────────────────────────────
  playRelease() {
    if (!this._ready) return;
    this.stopPurple();

    const t = this._ctx.currentTime;

    // Deep explosive burst
    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(2.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    gain.connect(this._master);

    const boom = this._ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, t);
    boom.frequency.exponentialRampToValueAtTime(20, t + 0.2);
    boom.connect(gain);
    boom.start(t); boom.stop(t + 0.2);

    // Brief silence
    this._master.gain.setValueAtTime(0.7, t + 0.15);
    this._master.gain.linearRampToValueAtTime(0.0, t + 0.20);
    this._master.gain.setValueAtTime(0.0, t + 0.45);
    this._master.gain.linearRampToValueAtTime(0.7, t + 0.6);

    // Roaring energy stream after
    setTimeout(() => {
      if (!this._ready) return;
      const t2 = this._ctx.currentTime;
      const { src, gain: ng } = this._noise(0.3, null);
      const roarGain = this._ctx.createGain();
      roarGain.gain.setValueAtTime(0.5, t2);
      roarGain.gain.linearRampToValueAtTime(0, t2 + 2.0);
      roarGain.connect(this._master);
      ng.disconnect(); src.disconnect();
      src.connect(roarGain);
      setTimeout(() => { try { src.stop(); } catch(e) {} }, 2200);
    }, 600);
  }

  dispose() {
    Object.keys(this._nodes).forEach(k => {
      try { this[`stop${k.charAt(0).toUpperCase()+k.slice(1)}`](); } catch(e) {}
    });
    if (this._ctx) this._ctx.close();
    this._ready = false;
  }
}
