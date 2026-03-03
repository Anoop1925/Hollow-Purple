// ================================================================
// HollowPurple.js — The Divine Singularity
// ================================================================
import * as THREE from 'three';
import { HollowPurpleVertex, HollowPurpleFragment } from '../shaders/HollowPurpleShader.js';

export class HollowPurple {
  constructor(scene) {
    this.scene        = scene;
    this.visible      = false;
    this._built       = false;
    this.birthProgress = 0.0;
    this.scale        = 0.0;
  }

  build() {
    if (this._built) return;
    this._built = true;

    // Main nebula sphere
    const geo = new THREE.SphereGeometry(0.9, 64, 64);
    this.mat  = new THREE.ShaderMaterial({
      uniforms: {
        uTime:          { value: 0.0 },
        uScale:         { value: 1.0 },
        uIntensity:     { value: 0.0 },
        uBirthProgress: { value: 0.0 },
      },
      vertexShader:   HollowPurpleVertex,
      fragmentShader: HollowPurpleFragment,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    // ── Gyroscope ring 1 ─────────────────────────────────────
    this._rings = [];
    this._addGyroRing(1.05, 0.012, 0xcc66ff, 0.0,  0.0 );
    this._addGyroRing(1.12, 0.008, 0xff44cc, 0.6,  1.05);
    this._addGyroRing(1.19, 0.006, 0x9900ff, 1.15, 0.78);

    // ── Point light cluster ───────────────────────────────────
    this.light1 = new THREE.PointLight(0x9900ff, 0.0, 15.0);
    this.light2 = new THREE.PointLight(0xff00cc, 0.0, 8.0);
    this.light2.position.set(0.4, 0.4, 0.0);
    this.scene.add(this.light1, this.light2);

    // ── Outer haze ────────────────────────────────────────────
    const hazeGeo = new THREE.SphereGeometry(1.55, 32, 32);
    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0x6600cc,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    this.haze = new THREE.Mesh(hazeGeo, hazeMat);
    this.mesh.add(this.haze);
  }

  _addGyroRing(radius, tubeRadius, color, rotX, rotZ) {
    const geo = new THREE.TorusGeometry(radius, tubeRadius, 8, 160);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = rotX;
    ring.rotation.z = rotZ;
    ring._baseRotX  = rotX;
    ring._baseRotZ  = rotZ;
    this.scene.add(ring);
    this._rings.push(ring);
    return ring;
  }

  show() {
    this.visible = true;
    if (this._built) {
      this.mesh.visible = true;
      this._rings.forEach(r => { r.visible = true; });
    }
  }

  hide() {
    this.visible   = false;
    this.scale     = 0.0;
    this.birthProgress = 0.0;
    if (this._built) {
      this.mesh.visible = false;
      this.mesh.scale.setScalar(0.001);
      this._rings.forEach(r => { r.visible = false; });
      this.light1.intensity = 0.0;
      this.light2.intensity = 0.0;
      if (this.haze) this.haze.material.opacity = 0.0;
    }
  }

  setPosition(x, y, z) {
    if (!this._built) return;
    this.mesh.position.set(x, y, z);
    this.light1.position.set(x, y, z);
    this.light2.position.set(x + 0.4, y + 0.4, z);
    this._rings.forEach(r => r.position.set(x, y, z));
  }

  setBirthProgress(v) {
    this.birthProgress = v;
    if (!this._built) return;
    this.mat.uniforms.uBirthProgress.value = v;

    const s = Math.pow(v, 0.6) * 1.1;
    this.mesh.scale.setScalar(s);
    this._rings.forEach(r => r.scale.setScalar(s));

    const li = Math.pow(v, 0.5);
    this.mat.uniforms.uIntensity.value = li;
    this.light1.intensity = li * 3.5;
    this.light2.intensity = li * 1.8;
    if (this.haze) this.haze.material.opacity = li * 0.10;
    this._rings.forEach(r => { r.material.opacity = li * 0.30; });
  }

  update(dt, elapsed) {
    if (!this._built || !this.visible) return;
    this.mat.uniforms.uTime.value = elapsed;

    // Gyroscope ring rotation
    const speeds = [0.8, -0.55, 1.1];
    this._rings.forEach((ring, i) => {
      ring.rotation.y += dt * speeds[i];
      ring.rotation.x  = ring._baseRotX + Math.sin(elapsed * 0.4 + i) * 0.15;
    });

    // Slow majestic rotation
    this.mesh.rotation.y += dt * 0.22;
    this.mesh.rotation.x  = Math.sin(elapsed * 0.31) * 0.08;
  }

  /** Explosive launch — expansion burst → shockwave rings → rapid Z fly-out */
  launchAndReturn(onDone) {
    if (!this._built) return () => false;
    const startPos   = this.mesh.position.clone();
    const startScale = this.mesh.scale.x;
    let   t          = 0;
    const BURST_DUR  = 0.14;  // expansion burst phase
    const FLY_DUR    = 1.35;  // total fly duration after burst
    const TOTAL      = BURST_DUR + FLY_DUR;

    // Capture initial ring scales so we can expand them outward
    const ringStartScales = this._rings.map(r => r.scale.x);

    const fly = (dt) => {
      t += dt;
      const p = Math.min(t / TOTAL, 1.0);

      if (t < BURST_DUR) {
        // ── Phase 1: Explosion burst (scale up violently) ───────
        const bp = t / BURST_DUR;
        const s  = startScale + bp * 0.90;      // rapidly expand to +90%
        this.mesh.scale.setScalar(s);
        // Rings blast outward
        this._rings.forEach((r, i) => {
          r.scale.setScalar(ringStartScales[i] * (1.0 + bp * 2.5));
          r.material.opacity = (1.0 - bp * 0.8) * 0.65;
        });
        // Intense light spike
        this.light1.intensity = 4.0 + bp * 8.0;
        this.light2.intensity = 2.0 + bp * 5.0;
        // Haze flares
        if (this.haze) this.haze.material.opacity = 0.05 + bp * 0.25;

      } else {
        // ── Phase 2: Fly forward and shrink to nothing ──────────
        const fp = (t - BURST_DUR) / FLY_DUR;         // 0→1 over fly duration
        const ease = Math.pow(fp, 0.5);                // ease out (fast start)

        // Z fly-in: starts from startZ, drives far into negative Z
        const zOffset = -22.0 * ease;
        this.mesh.position.z  = startPos.z + zOffset;
        this._rings.forEach(r  => { r.position.z = this.mesh.position.z; });
        this.light1.position.z = this.mesh.position.z;

        // Scale shrinks as it recedes
        const shrink = Math.max(0.0, (startScale + 0.90) * (1.0 - Math.pow(fp, 0.7)));
        this.mesh.scale.setScalar(shrink);
        this._rings.forEach((r, i) => {
          r.scale.setScalar(ringStartScales[i] * (3.5 - fp * 3.0));
          r.material.opacity = (1.0 - fp) * 0.40;
        });

        // Light fades as orb recedes
        this.light1.intensity = 12.0 * (1.0 - fp);
        this.light2.intensity = 6.0 * (1.0 - fp);
        if (this.haze) this.haze.material.opacity = 0.30 * (1.0 - fp);

        // Shader intensity fade
        this.mat.uniforms.uIntensity.value = Math.max(0.0, 1.0 - fp * 1.2);
      }

      if (p >= 1.0) {
        this.hide();
        if (onDone) onDone();
      }
      return p < 1.0;
    };
    return fly;
  }

  dispose() {
    if (!this._built) return;
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this._rings.forEach(r => { r.geometry.dispose(); r.material.dispose(); this.scene.remove(r); });
    this.scene.remove(this.mesh, this.light1, this.light2);
  }
}
