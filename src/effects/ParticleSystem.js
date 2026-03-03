// ================================================================
// ParticleSystem.js — Debris pulled in / blasted out
// ================================================================
import * as THREE from 'three';
import { ParticleVertex, ParticleFragment } from '../shaders/PostFXShaders.js';

const MAX_PARTICLES = 4000;

export class ParticleSystem {
  constructor(scene) {
    this.scene   = scene;
    this._built  = false;
    this._pool   = [];   // active particles
    this._dirty  = false;
  }

  build() {
    if (this._built) return;
    this._built = true;

    // Geometry with custom per-particle attributes
    this._positions = new Float32Array(MAX_PARTICLES * 3);
    this._velocities= new Float32Array(MAX_PARTICLES * 3);
    this._ages      = new Float32Array(MAX_PARTICLES);
    this._lifetimes = new Float32Array(MAX_PARTICLES);
    this._sizes     = new Float32Array(MAX_PARTICLES);
    this._colors    = new Float32Array(MAX_PARTICLES * 3);
    this._pulls     = new Float32Array(MAX_PARTICLES * 3); // attractor
    this._pullForce = new Float32Array(MAX_PARTICLES);     // force magnitude (neg=attract,pos=repel)

    this._activeCount = 0;
    this._slots = Array.from({ length: MAX_PARTICLES }, (_, i) => i);
    this._freeSlots = [...this._slots];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geo.setAttribute('aAge',     new THREE.BufferAttribute(this._ages, 1));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(this._sizes, 1));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(this._colors, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      uniforms:       { uTime: { value: 0 } },
      vertexShader:   ParticleVertex,
      fragmentShader: ParticleFragment,
      transparent:  true,
      depthWrite:   false,
      blending:     THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.scene.add(this.points);

    this._liveParticles = [];
  }

  /** Burst outward from origin */
  burst(origin, count, colorHex, speed = 3.0) {
    const r = ((colorHex >> 16) & 0xff) / 255;
    const g = ((colorHex >>  8) & 0xff) / 255;
    const b = ( colorHex        & 0xff) / 255;

    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();
      this._spawn(
        origin.clone().add(dir.clone().multiplyScalar(0.1)),
        dir.clone().multiplyScalar(speed * (0.5 + Math.random())),
        null, 0,
        0.8 + Math.random() * 0.8,
        0.04 + Math.random() * 0.08,
        r, g, b
      );
    }
  }

  /** Pull inward toward a target */
  implode(target, count, colorHex) {
    const r = ((colorHex >> 16) & 0xff) / 255;
    const g = ((colorHex >>  8) & 0xff) / 255;
    const b = ( colorHex        & 0xff) / 255;

    for (let i = 0; i < count; i++) {
      const spread = 3.5;
      const pos = new THREE.Vector3(
        target.x + (Math.random() - 0.5) * spread,
        target.y + (Math.random() - 0.5) * spread,
        target.z + (Math.random() - 0.5) * spread
      );
      const toTarget = new THREE.Vector3().subVectors(target, pos).normalize();
      const speed    = 2.0 + Math.random() * 3.0;
      this._spawn(
        pos,
        toTarget.multiplyScalar(speed),
        target.clone(), -5.0, // attract
        0.6 + Math.random() * 0.6,
        0.03 + Math.random() * 0.06,
        r, g, b
      );
    }
  }

  /** Ambient floating debris pulled toward an orb */
  spawnAmbient(origin, colorHex, count = 5) {
    const r = ((colorHex >> 16) & 0xff) / 255;
    const g = ((colorHex >>  8) & 0xff) / 255;
    const b = ( colorHex        & 0xff) / 255;

    for (let i = 0; i < count; i++) {
      const spread = 2.5;
      const pos = new THREE.Vector3(
        origin.x + (Math.random() - 0.5) * spread,
        origin.y + (Math.random() - 0.5) * spread,
        origin.z + (Math.random() - 0.5) * spread * 0.3
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        0
      );
      this._spawn(
        pos, vel,
        origin.clone(), -1.8,
        1.5 + Math.random(),
        0.025 + Math.random() * 0.04,
        r, g, b
      );
    }
  }

  _spawn(pos, vel, attractor, pullForce, lifetime, size, r, g, b) {
    if (this._liveParticles.length >= MAX_PARTICLES) return;

    const idx = this._liveParticles.length;
    if (idx >= MAX_PARTICLES) return;

    this._liveParticles.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: vel.x, vy: vel.y, vz: vel.z,
      ax: attractor ? attractor.x : 0,
      ay: attractor ? attractor.y : 0,
      az: attractor ? attractor.z : 0,
      pullForce,
      age: 0, lifetime, size, r, g, b,
    });
  }

  update(dt, elapsed) {
    if (!this._built) return;

    const dead   = [];
    const alive  = [];

    for (const p of this._liveParticles) {
      p.age += dt;
      if (p.age >= p.lifetime) { dead.push(p); continue; }

      // Apply attraction / repulsion force
      if (p.pullForce !== 0) {
        const dx = p.ax - p.x;
        const dy = p.ay - p.y;
        const dz = p.az - p.z;
        const d2 = dx*dx + dy*dy + dz*dz + 0.01;
        const d  = Math.sqrt(d2);
        const f  = p.pullForce / d2;
        p.vx += (dx / d) * f * dt;
        p.vy += (dy / d) * f * dt;
        p.vz += (dz / d) * f * dt;
      }

      // Drag
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.vz *= 0.985;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      alive.push(p);
    }

    this._liveParticles = alive;

    // Write to buffer
    const total = alive.length;
    for (let i = 0; i < total; i++) {
      const p = alive[i];
      this._positions[i*3]   = p.x;
      this._positions[i*3+1] = p.y;
      this._positions[i*3+2] = p.z;
      this._ages[i]          = p.age / p.lifetime;
      this._sizes[i]         = p.size;
      this._colors[i*3]      = p.r;
      this._colors[i*3+1]    = p.g;
      this._colors[i*3+2]    = p.b;
    }

    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAge.needsUpdate     = true;
    geo.attributes.aSize.needsUpdate    = true;
    geo.attributes.aColor.needsUpdate   = true;
    geo.setDrawRange(0, total);
  }

  dispose() {
    if (!this._built) return;
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.scene.remove(this.points);
  }
}
