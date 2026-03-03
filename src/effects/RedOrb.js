// ================================================================
// RedOrb.js — Volatile Crimson Plasma Reactor
// ================================================================
import * as THREE from 'three';
import { RedOrbVertex, RedOrbFragment } from '../shaders/RedOrbShader.js';

export class RedOrb {
  constructor(scene) {
    this.scene     = scene;
    this.intensity = 0.0;
    this.visible   = false;
    this._built    = false;
  }

  build() {
    if (this._built) return;
    this._built = true;

    const geo = new THREE.SphereGeometry(0.55, 64, 64);

    this._charge = 0.0;

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0.0 },
        uIntensity: { value: 0.0 },
        uCharge:    { value: 0.0 },
      },
      vertexShader:   RedOrbVertex,
      fragmentShader: RedOrbFragment,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    // Inner corona — jagged outer glow to simulate shock boundary
    const coronaGeo = new THREE.SphereGeometry(0.72, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      wireframe: true,
    });
    this.corona = new THREE.Mesh(coronaGeo, coronaMat);
    this.mesh.add(this.corona);

    this.light = new THREE.PointLight(0xff2233, 0.0, 8.0);
    this.scene.add(this.light);
  }

  show() { this.visible = true; if (this._built) this.mesh.visible = true; }
  hide() {
    this.visible   = false;
    this.intensity = 0.0;
    if (this._built) {
      this.mesh.visible    = false;
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
    this.light.intensity = v * 3.0;
    if (this.corona) this.corona.material.opacity = v * 0.08;
  }

  setCharge(v) {
    this._charge = Math.max(0, Math.min(1, v));
    if (!this._built) return;
    this.mat.uniforms.uCharge.value = this._charge;
    // Orb grows from 0.15 → 1.0 as charge fills
    const s = 0.15 + this._charge * 0.85;
    this.mesh.scale.setScalar(s);
    this.light.intensity = this._charge * 3.5;
  }

  update(dt, elapsed) {
    if (!this._built || !this.visible) return;
    this.mat.uniforms.uTime.value = elapsed;

    // Jittery unstable movement
    const jitter = 0.015;
    this.mesh.position.x += (Math.random() - 0.5) * jitter * this.intensity;
    this.mesh.position.y += (Math.random() - 0.5) * jitter * this.intensity;

    this.mesh.rotation.y -= dt * 0.8;
    this.mesh.rotation.z += dt * 0.5;
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
