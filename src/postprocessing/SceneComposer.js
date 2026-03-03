// ================================================================
// SceneComposer.js — WebGL Post-Processing Pipeline
//
// Passes (in order):
//   1. RenderPass        — normal scene render
//   2. UnrealBloomPass   — cinematic bloom
//   3. ShaderPass(Glitch)— chromatic aberration + scanlines
//   4. ShaderPass(Lens)  — gravitational lens distortion
//   5. OutputPass        — gamma correction
// ================================================================
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { GlitchShader, GravLensShader } from '../shaders/PostFXShaders.js';

export class SceneComposer {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene}         scene
   * @param {THREE.Camera}        camera
   */
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene    = scene;
    this.camera   = camera;

    this._build();
  }

  _build() {
    const { renderer, scene, camera } = this;
    const size = new THREE.Vector2();
    renderer.getSize(size);

    // ── EffectComposer — alpha-enabled render targets ─────────
    const rtParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format:    THREE.RGBAFormat,
      type:      THREE.HalfFloatType,
    };
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, rtParams);
    this.composer = new EffectComposer(renderer, rt);
    this.composer.renderToScreen = true;

    // 1. Scene — clear to transparent each frame
    this.renderPass = new RenderPass(scene, camera);
    this.renderPass.clearColor  = new THREE.Color(0, 0, 0);
    this.renderPass.clearAlpha  = 0;
    this.renderPass.clear       = true;
    this.composer.addPass(this.renderPass);

    // 2. Bloom — targeted: only very bright emissive elements bloom
    this.bloomPass = new UnrealBloomPass(
      size,
      /*strength*/  0.55,
      /*radius*/    0.50,
      /*threshold*/ 0.60   // only pixels brighter than 0.6 bloom
    );
    this.composer.addPass(this.bloomPass);

    // 3. Glitch / chromatic aberration
    this.glitchPass = new ShaderPass(GlitchShader);
    this.composer.addPass(this.glitchPass);

    // 4. Gravitational lens
    this.lensPass = new ShaderPass(GravLensShader);
    // Override the default array value with a proper Three.js Vector2
    this.lensPass.uniforms.uOrbPos.value = new THREE.Vector2(0.5, 0.5);
    this.composer.addPass(this.lensPass);

    // 5. Output (gamma)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  /** Update per-frame uniforms */
  update(elapsed, glitchAmount, rgbSplit, lensStrength, orbScreenPos) {
    const g = this.glitchPass.uniforms;
    g.uTime.value      = elapsed;
    g.uAmount.value    = glitchAmount;
    g.uRGBSplit.value  = rgbSplit;
    g.uScanlines.value = Math.max(0, glitchAmount - 0.4);

    const l = this.lensPass.uniforms;
    l.uTime.value     = elapsed;
    l.uStrength.value = lensStrength;
    if (orbScreenPos) l.uOrbPos.value.copy(orbScreenPos);
  }

  /** Set bloom intensity (0–3) */
  setBloom(strength, radius, threshold) {
    this.bloomPass.strength  = strength;
    this.bloomPass.radius    = radius;
    this.bloomPass.threshold = threshold;
  }

  render() {
    this.composer.render();
  }

  resize(w, h) {
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
  }
}
