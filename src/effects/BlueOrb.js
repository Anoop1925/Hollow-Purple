// ================================================================
// BlueOrb.js — Compressed Negative Space Singularity
// ================================================================
import * as THREE from 'three';
import { BlueOrbVertex, BlueOrbFragment } from '../shaders/BlueOrbShader.js';

export class BlueOrb {
  constructor(scene) {
    this.scene     = scene;
    this.intensity = 0.0;
    this.visible   = false;
    this._built    = false;
  }

  build() {
    if (this._built) return;
    this._built = true;

    this._charge = 0.0;
    this._baseY  = null;

    // ── Geometry: high-res sphere ─────────────────────────────
    const geo = new THREE.SphereGeometry(0.55, 64, 64);

    // ── Shader material ───────────────────────────────────────
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0.0 },
        uIntensity: { value: 0.0 },
        uCharge:    { value: 0.0 },
      },
      vertexShader:   BlueOrbVertex,
      fragmentShader: BlueOrbFragment,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    // ── Inner glow sprite ─────────────────────────────────────
    this._addGlowHalo(0x00aaff, 1.4);

    // ── Point light ───────────────────────────────────────────
    this.light = new THREE.PointLight(0x00a8ff, 0.0, 8.0);
    this.scene.add(this.light);
  }

  _addGlowHalo(color, scale) {
    // Simple back-facing additive sphere for glow bloom base
    const geo = new THREE.SphereGeometry(0.75, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    this.halo = new THREE.Mesh(geo, mat);
    this.mesh.add(this.halo);
  }

  show() { this.visible = true; if (this._built) this.mesh.visible = true; }
  hide() {
    this.visible   = false;
    this.intensity = 0.0;
    if (this._built) {
      this.mesh.visible = false;
      this.light.intensity = 0.0;
    }
  }

  setPosition(x, y, z) {
    if (!this._built) return;
    this.mesh.position.set(x, y, z);
    this.light.position.set(x, y, z);
  }

  setIntensity(v) {
    this.intensity = v;
    if (!this._built) return;
    this.mat.uniforms.uIntensity.value = v;
    this.light.intensity = v * 2.5;
    if (this.halo) this.halo.material.opacity = v * 0.10;
  }

  setCharge(v) {
    this._charge = Math.max(0, Math.min(1, v));
    if (!this._built) return;
    this.mat.uniforms.uCharge.value = this._charge;
    // Orb grows from 0.15 → 1.0 as charge fills
    const s = 0.15 + this._charge * 0.85;
    this.mesh.scale.setScalar(s);
    this.light.intensity = this._charge * 3.0;
  }

  update(dt, elapsed) {
    if (!this._built || !this.visible) return;
    this.mat.uniforms.uTime.value = elapsed;

    // Slow orbit bob (store base Y on first frame)
    const t = elapsed;
    if (this._baseY === null) this._baseY = this.mesh.position.y;
    this.mesh.position.y = this._baseY + Math.sin(t * 1.3) * 0.04;
    this.mesh.rotation.y += dt * 0.7;
    this.light.position.copy(this.mesh.position);
  }

  dispose() {
    if (!this._built) return;
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.scene.remove(this.mesh);
    this.scene.remove(this.light);
  }
}
