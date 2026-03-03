// ================================================================
// FusionSequence.js — The Violent Collision of Blue and Red
// Handles: orbital dance, purple static, implosion, birth flash
// ================================================================
import * as THREE from 'three';

export class FusionSequence {
  /**
   * @param {THREE.Scene}     scene
   * @param {BlueOrb}         blueOrb
   * @param {RedOrb}          redOrb
   * @param {HollowPurple}    hollowPurple
   * @param {ParticleSystem}  particles
   */
  constructor(scene, blueOrb, redOrb, hollowPurple, particles) {
    this.scene        = scene;
    this.blue         = blueOrb;
    this.red          = redOrb;
    this.purple       = hollowPurple;
    this.particles    = particles;

    this.active       = false;
    this.phase        = 'idle';   // orbital | collide | implosion | birth
    this.t            = 0;
    this._onComplete  = null;

    // Purple static field mesh
    this._staticMesh  = null;
    this._built       = false;
  }

  build() {
    if (this._built) return;
    this._built = true;
    // Purple static debris plane — large quad with shader
    const geo = new THREE.PlaneGeometry(8, 8, 120, 120);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0.0 },
        uOpacity: { value: 0.0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 p = position;
          float n = sin(p.x * 8.0 + uTime * 4.0) * sin(p.y * 8.0 + uTime * 3.0) * 0.06;
          p.z += n;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform float uTime;
        uniform float uOpacity;
        varying vec2  vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                     mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }

        void main() {
          vec2 uv   = vUv;
          float t   = uTime;

          // Interference pattern — blue x red = purple static
          float blueWave = sin(uv.x * 25.0 - t * 6.0) * sin(uv.y * 18.0 + t * 4.0);
          float redWave  = cos(uv.x * 20.0 + t * 5.5) * cos(uv.y * 22.0 - t * 3.5);
          float intf     = blueWave * redWave;

          float n        = noise(uv * 12.0 + t * 0.5) * 2.0 - 1.0;
          float static_  = smoothstep(0.3, 0.8, abs(intf + n * 0.3));

          // Colour: purple-magenta-white
          vec3 col;
          float phase = intf * 0.5 + 0.5 + n * 0.2;
          col = mix(vec3(0.4, 0.0, 0.9), vec3(1.0, 0.0, 0.8), phase);
          col = mix(col, vec3(1.0), static_ * 0.6);

          // Vignette — concentrated in centre
          float vign = 1.0 - length(uv - 0.5) * 1.8;
          vign = max(vign, 0.0);

          float a = static_ * vign * uOpacity;
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    });

    this._staticMesh = new THREE.Mesh(geo, mat);
    this._staticMesh.visible = false;
    this.scene.add(this._staticMesh);
  }

  /**
   * Start the fusion sequence.
   * @param {THREE.Vector3} center   — where the merger happens
   * @param {Function}      onComplete
   */
  start(center, onComplete) {
    this.center     = center.clone();
    this.active     = true;
    this.phase      = 'orbital';
    this.t          = 0;
    this._onComplete = onComplete;

    if (this._staticMesh) {
      this._staticMesh.position.copy(center);
      this._staticMesh.visible = true;
    }
  }

  update(dt, elapsed) {
    if (!this.active) return;
    this.t += dt;

    if (this._staticMesh)
      this._staticMesh.material.uniforms.uTime.value = elapsed;

    switch (this.phase) {

      // ── Phase 1: Orbs orbit each other (1.2 s) ──────────────
      case 'orbital': {
        const dur   = 1.2;
        const p     = Math.min(this.t / dur, 1.0);
        const angle = elapsed * 3.5;
        const dist  = THREE.MathUtils.lerp(2.0, 0.3, p);

        this.blue.setPosition(
          this.center.x + Math.cos(angle)  * dist,
          this.center.y + Math.sin(angle * 0.4) * 0.25,
          this.center.z + Math.sin(angle)  * dist * 0.3
        );
        this.red.setPosition(
          this.center.x - Math.cos(angle)  * dist,
          this.center.y - Math.sin(angle * 0.4) * 0.25,
          this.center.z - Math.sin(angle)  * dist * 0.3
        );

        // Static opacity ramps in
        const staticOp = p * p * 0.7;
        if (this._staticMesh) this._staticMesh.material.uniforms.uOpacity.value = staticOp;

        if (p >= 1.0) { this.phase = 'collide'; this.t = 0; }
        break;
      }

      // ── Phase 2: Collision flash (0.25 s) ───────────────────
      case 'collide': {
        const dur = 0.25;
        const p   = Math.min(this.t / dur, 1.0);

        // Both orbs rush to center
        this.blue.setPosition(...this.center.toArray());
        this.red.setPosition( ...this.center.toArray());

        // Fade both out
        this.blue.setIntensity(1.0 - p);
        this.red.setIntensity( 1.0 - p);

        // Blast of particles
        if (p > 0.1 && p < 0.4) {
          this.particles.burst(this.center, 80, 0xaa44ff, 3.5);
        }

        if (p >= 1.0) {
          this.blue.hide();
          this.red.hide();
          this.phase = 'implosion';
          this.t     = 0;
          document.body.classList.add('glitching');
        }
        break;
      }

      // ── Phase 3: Silent implosion (0.3 s) ───────────────────
      case 'implosion': {
        const dur = 0.3;
        const p   = Math.min(this.t / dur, 1.0);

        // Static field slams to full, then cuts
        const staticOp = 1.0 - Math.pow(p, 2.0);
        if (this._staticMesh) this._staticMesh.material.uniforms.uOpacity.value = staticOp;

        // Inward particle implosion
        if (p < 0.5) this.particles.implode(this.center, 60, 0x9900ff);

        if (p >= 1.0) {
          this._staticMesh.visible = false;
          document.body.classList.remove('glitching');
          this.phase = 'birth';
          this.t     = 0;
          this.purple.setPosition(...this.center.toArray());
          this.purple.show();
        }
        break;
      }

      // ── Phase 4: Birth of Hollow Purple (0.9 s) ─────────────
      case 'birth': {
        const dur = 0.9;
        const p   = Math.min(this.t / dur, 1.0);

        this.purple.setBirthProgress(p);

        // Eject ring of particles on birth
        if (p < 0.05) this.particles.burst(this.center, 120, 0xcc00ff, 5.0);

        if (p >= 1.0) {
          this.active = false;
          this.phase  = 'idle';
          if (this._onComplete) this._onComplete();
        }
        break;
      }
    }
  }

  reset() {
    this.active = false;
    this.phase  = 'idle';
    this.t      = 0;
    if (this._staticMesh) {
      this._staticMesh.visible = false;
      this._staticMesh.material.uniforms.uOpacity.value = 0.0;
    }
    document.body.classList.remove('glitching');
  }

  dispose() {
    if (this._staticMesh) {
      this._staticMesh.geometry.dispose();
      this._staticMesh.material.dispose();
      this.scene.remove(this._staticMesh);
    }
  }
}
