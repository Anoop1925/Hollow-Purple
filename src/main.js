// ================================================================
// main.js — Hollow Technique: Purple
// Orchestrates: Three.js scene, state machine, gesture detection,
// effects pipeline, and the render loop.
// ================================================================

import * as THREE          from 'three';
import { SceneComposer }   from './postprocessing/SceneComposer.js';
import { BlueOrb }         from './effects/BlueOrb.js';
import { RedOrb }          from './effects/RedOrb.js';
import { HollowPurple }    from './effects/HollowPurple.js';
import { FusionSequence }  from './effects/FusionSequence.js';
import { ParticleSystem }  from './effects/ParticleSystem.js';
import { GestureDetector } from './gesture/GestureDetector.js';
import { EnergyStateMachine, STATE } from './states/EnergyStateMachine.js';
import { AudioEngine } from './audio/AudioEngine.js';

// ── DOM references ────────────────────────────────────────────
const canvas   = document.getElementById('three-canvas');
const video    = document.getElementById('webcam');
const lmCanvas = document.getElementById('landmark-canvas');
const stateBadge  = document.getElementById('state-badge');
const gestureL    = document.getElementById('gesture-left');
const gestureR    = document.getElementById('gesture-right');
const instructions = document.getElementById('instructions');

// ── Three.js Setup ────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias:        true,
  powerPreference:  'high-performance',
  alpha:            false,   // opaque black bg — CSS mix-blend-mode:screen hides black
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace    = THREE.SRGBColorSpace;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setClearColor(0x000000, 1);  // solid black — disappears via screen blend

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // pure black so screen blend = no canvas

// Subtle ambient
const ambientLight = new THREE.AmbientLight(0x110022, 0.4);
scene.add(ambientLight);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.5, 6.5);

// star field removed — live camera CSS background is used instead

// ── Effects ───────────────────────────────────────────────────
const particles    = new ParticleSystem(scene);
const blueOrb      = new BlueOrb(scene);
const redOrb       = new RedOrb(scene);
const hollowPurple = new HollowPurple(scene);
const fusion       = new FusionSequence(scene, blueOrb, redOrb, hollowPurple, particles);

// Build all GPU resources
particles.build();
blueOrb.build();
redOrb.build();
hollowPurple.build();
fusion.build();

// ── Pre-compile & warm-up GPU shaders ────────────────────────
// Chrome/ANGLE defers real GPU program linking until the first draw call.
// renderer.compile() alone is NOT enough — we must render a real frame
// with every material active to force full compilation + linking NOW.
{
  // Temporarily make all meshes visible
  const hiddenMeshes = [];
  scene.traverse(obj => {
    if (obj.isMesh && !obj.visible) {
      obj.visible = true;
      hiddenMeshes.push(obj);
    }
  });

  // Force-compile shader programs
  renderer.compile(scene, camera);

  // Render TWO real frames to force ANGLE to fully link all programs
  // (first frame triggers link, second ensures pipeline is flushed)
  renderer.render(scene, camera);
  renderer.render(scene, camera);

  // Also warm up the post-processing pipeline
  composer.render();

  // Clear the screen so user doesn't see the warm-up
  renderer.clear();

  // Hide meshes again
  for (const m of hiddenMeshes) m.visible = false;
  console.log('[main] GPU warm-up complete —', hiddenMeshes.length, 'meshes pre-rendered');
}

// ── Composer ─────────────────────────────────────────────────
const composer = new SceneComposer(renderer, scene, camera);

// ── State machine ─────────────────────────────────────────────
const stateMachine = new EnergyStateMachine();

// ── Static fallback orb positions (used before hands detected) ──
const BLUE_POS  = new THREE.Vector3( 1.8, 0.3, 1.5);
const RED_POS   = new THREE.Vector3(-1.8, 0.3, 1.5);
const CENTER    = new THREE.Vector3( 0.0, 0.3, 1.5);

blueOrb.setPosition(...BLUE_POS.toArray());
redOrb.setPosition(...RED_POS.toArray());
hollowPurple.setPosition(...CENTER.toArray());

// ── Live hand-tracking positions (updated by GestureDetector) ──
const handPos = { Right: null, Left: null };

/** Convert MediaPipe normalized [0,1] screen coord to Three.js world space
 *  Flips X to match CSS mirrored camera display. worldZ is the z-plane to place orb at. */
function handNormToWorld(nx, ny, worldZ = 1.5) {
  const mirX = 1.0 - nx;          // mirror to match CSS scaleX(-1)
  const aspect = window.innerWidth / window.innerHeight;
  const dist   = camera.position.z - worldZ;  // distance from cam to orb plane
  const halfH  = dist * Math.tan((camera.fov * Math.PI / 180) / 2);
  const halfW  = halfH * aspect;
  return new THREE.Vector3(
    (mirX - 0.5) * 2.0 * halfW,
    (0.5 - ny)   * 2.0 * halfH + camera.position.y,
    worldZ
  );
}

// ── Postprocessing targets ─────────────────────────────────────
let glitchAmount  = 0.0;
let rgbSplitAmt   = 0.0;
let lensStrength  = 0.0;
let bloomStrength = 0.45;
// ── Screen shake state ────────────────────────────────────
let shakeTimer  = 0.0;
let shakeMag    = 0.0;

// ── Audio engine ──────────────────────────────────────────
const audio = new AudioEngine();
// Init on first user interaction (browser gesture requirement)
let audioReady = false;
document.addEventListener('click', () => {
  if (!audioReady) { audio.init(); audioReady = true; }
}, { once: false });

// ── White flash overlay trigger ──────────────────────────
function triggerFlash() {
  const overlay = document.getElementById('flash-overlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.05s ease-in';
  overlay.style.opacity = '1';
  setTimeout(() => {
    overlay.style.transition = 'opacity 0.45s ease-out';
    overlay.style.opacity = '0';
  }, 80);
}
// ── State change handler ───────────────────────────────────────
stateMachine.onStateChange = (newState, prevState) => {
  updateHUD(newState);

  switch (newState) {
    case STATE.IDLE:
      blueOrb.hide();
      redOrb.hide();
      hollowPurple.hide();
      fusion.reset();
      glitchAmount = 0;
      rgbSplitAmt  = 0;
      lensStrength = 0;
      setBloomForState('idle');
      flyTicker = null;
      if (audioReady) { audio.stopBlue(); audio.stopRed(); audio.stopPurple(); }
      break;

    case STATE.CHARGING_BLUE:
      blueOrb.show();
      blueOrb.setIntensity(0.05);
      blueOrb.setCharge(0.0);
      if (audioReady) audio.startBlue();
      break;

    case STATE.CHARGING_RED:
      redOrb.show();
      redOrb.setIntensity(0.05);
      redOrb.setCharge(0.0);
      if (audioReady) audio.startRed();
      break;

    case STATE.CHARGING_DUAL:
      blueOrb.show();
      redOrb.show();
      redOrb.setCharge(0.0);    // red starts charging from scratch
      redOrb.setIntensity(0.05);
      if (audioReady) { audio.startBlue(); audio.startRed(); }
      break;

    case STATE.CHARGED_READY: {
      // Lock orb positions in the air — store current world positions
      BLUE_POS.copy(blueOrb.mesh ? blueOrb.mesh.position : BLUE_POS);
      RED_POS.copy(redOrb.mesh  ? redOrb.mesh.position  : RED_POS);
      CENTER.lerpVectors(BLUE_POS, RED_POS, 0.5);
      blueOrb.setIntensity(1.0);
      redOrb.setIntensity(1.0);
      blueOrb.setCharge(1.0);
      redOrb.setCharge(1.0);
      setBloomForState('ready');
      // Flash a HUD prompt
      stateBadge.textContent = '⚡ SNAP TO FUSE';
      break;
    }

    case STATE.FUSING:
      setBloomForState('fusing');
      if (audioReady) { audio.stopBlue(); audio.stopRed(); audio.playFusion(); audio.playImplosion(); }
      fusion.start(CENTER, () => stateMachine.onFusionComplete());
      break;

    case STATE.HOLLOW_PURPLE:
      lensStrength = 0.18;
      setBloomForState('purple');
      if (audioReady) audio.startPurple();
      particles.burst(CENTER, 30, 0xcc00ff, 2.0);
      break;

    case STATE.RELEASE: {
      glitchAmount = 0.85;
      rgbSplitAmt  = 1.0;
      setBloomForState('release');
      if (audioReady) { audio.stopPurple(); audio.playRelease(); }
      triggerFlash();
      shakeTimer = 1.2;
      shakeMag   = 0.20;
      // Radial particle explosion in multiple bursts (360° scatter)
      particles.burst(CENTER, 120, 0xcc00ff, 6.0);
      setTimeout(() => particles.burst(CENTER, 80, 0xffffff, 4.5), 80);
      setTimeout(() => particles.burst(CENTER, 60, 0x9900ff, 3.0), 180);
      // Launch the orb with the new explosive sequence
      hollowPurple.setPosition(...CENTER.toArray());
      const fly = hollowPurple.launchAndReturn(() => {
        stateMachine.onReleaseComplete();
        flyTicker = null;
      });
      let lastElapsed = null;
      flyTicker = (elapsed) => {
        if (!lastElapsed) { lastElapsed = elapsed; return; }
        const stillGoing = fly(elapsed - lastElapsed);
        lastElapsed = elapsed;
        if (!stillGoing) flyTicker = null;
      };
      break;
    }
  }
};
// Fix typo in closure
let flyTicker = null;

// ── HUD helpers ───────────────────────────────────────────────
function updateHUD(state) {
  const classes = ['idle','blue','red','dual','fusing','implosion','hollow_purple','release'];
  stateBadge.className = 'badge';
  const map = {
    [STATE.IDLE]:           ['idle',         'IDLE'],
    [STATE.CHARGING_BLUE]:  ['blue',         'CHARGING ◆ BLUE'],
    [STATE.CHARGING_RED]:   ['red',          'CHARGING ◆ RED'],
    [STATE.CHARGING_DUAL]:  ['dual',         'DUAL CHARGE'],
    [STATE.CHARGED_READY]:  ['ready',        '⚡ SNAP TO FUSE'],
    [STATE.FUSING]:         ['fusing',       'FUSING...'],
    [STATE.HOLLOW_PURPLE]:  ['hollow_purple','◉ HOLLOW PURPLE'],
    [STATE.RELEASE]:        ['release',      '⚡ RELEASE'],
  };
  const [cls, label] = map[state] || ['idle','IDLE'];
  stateBadge.classList.add(cls);
  stateBadge.textContent = label;
}

function setBloomForState(s) {
  const presets = {
    //            strength radius threshold
    idle:    [0.40, 0.40, 0.70],
    ready:   [0.80, 0.55, 0.40],  // both orbs blazing full, anticipation
    fusing:  [0.65, 0.50, 0.55],
    purple:  [0.85, 0.55, 0.45],
    release: [1.10, 0.60, 0.35],
  };
  const [str, rad, thr] = presets[s] || presets.idle;
  composer.setBloom(str, rad, thr);
}

// ── Gesture detector ─────────────────────────────────────────
const detector = new GestureDetector(video, lmCanvas);

detector.onGesture = (hand, gesture) => {
  stateMachine.onGesture(hand, gesture);
  if (hand === 'Left')  gestureL.textContent = `✋ LEFT:  ${gesture}`;
  if (hand === 'Right') gestureR.textContent = `🤚 RIGHT: ${gesture}`;
  // Clear tracked position when hand disappears
  if (gesture === 'NONE') handPos[hand] = null;
};

detector.onHandPosition = (hand, nx, ny) => {
  handPos[hand] = handNormToWorld(nx, ny, 1.8);
};

// Start MediaPipe (graceful failure if camera denied)
detector.init().catch(err => {
  console.warn('[GestureDetector] init failed:', err.message);
  // Allow keyboard fallback (see below)
});

// ── Keyboard fallback (for testing without camera) ─────────────
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'b')  stateMachine.onGesture('Right', 'ROCK');
  if (key === 'r')  stateMachine.onGesture('Left',  'POINT');
  if (key === ' ')  { stateMachine.onGesture('Right','ROCK'); stateMachine.onGesture('Left','POINT'); }
  if (key === 'f')  { stateMachine.onGesture('Right','SNAP'); }
  if (key === 'escape') {
    stateMachine.onGesture('Right', 'NONE');
    stateMachine.onGesture('Left',  'NONE');
  }
});
window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'b' && stateMachine.state === STATE.CHARGING_BLUE)
    stateMachine.onGesture('Right', 'NONE');
  if (key === 'r' && stateMachine.state === STATE.CHARGING_RED)
    stateMachine.onGesture('Left', 'NONE');
});

// ── Instructions dismiss ──────────────────────────────────────
document.addEventListener('click', () => instructions.classList.add('hidden'));

// ── Resize handler ────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer.resize(w, h);
});

// ── World-to-screen helper ────────────────────────────────────
function worldToScreen(worldPos) {
  const v = worldPos.clone().project(camera);
  return new THREE.Vector2(
    (v.x * 0.5 + 0.5),
    (1.0 - (v.y * 0.5 + 0.5))
  );
}

// ── Particle ambient emitters (per state) ─────────────────────
let ambientTimer = 0;
const AMBIENT_INTERVAL = 0.08; // s

// ── Clock & Render Loop ───────────────────────────────────────
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);

  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // State machine tick
  stateMachine.update(dt);
  const s  = stateMachine.state;
  const bc = stateMachine.blueCharge;
  const rc = stateMachine.redCharge;

  // ── Hand-tracking: move orbs to live hand positions (only while actively charging) ─
  const trackingActive = s === STATE.CHARGING_BLUE ||
                         s === STATE.CHARGING_RED  ||
                         s === STATE.CHARGING_DUAL;
  const lerpSpeed = dt * 12;
  if (trackingActive) {
    if (handPos.Right) {
      BLUE_POS.lerp(handPos.Right, lerpSpeed);
      blueOrb.setPosition(...BLUE_POS.toArray());
    }
    if (handPos.Left) {
      RED_POS.lerp(handPos.Left, lerpSpeed);
      redOrb.setPosition(...RED_POS.toArray());
    }
    if (handPos.Right && handPos.Left) {
      CENTER.lerpVectors(handPos.Right, handPos.Left, 0.5);
    }
  } else if (s === STATE.CHARGED_READY) {
    // Orbs locked — add gentle floating animation
    const float = Math.sin(elapsed * 1.8) * 0.04;
    blueOrb.setPosition(BLUE_POS.x, BLUE_POS.y + float, BLUE_POS.z);
    redOrb.setPosition( RED_POS.x,  RED_POS.y  - float, RED_POS.z);
  }

  // ── Per-state visual updates ────────────────────────────
  if (s === STATE.CHARGING_BLUE || s === STATE.CHARGING_DUAL) {
    blueOrb.setIntensity(bc);
    blueOrb.setCharge(bc);
    if (audioReady) audio.updateBlueCharge(bc);
    blueOrb.update(dt, elapsed);
  }
  if (s === STATE.CHARGING_RED || s === STATE.CHARGING_DUAL) {
    redOrb.setIntensity(rc);
    redOrb.setCharge(rc);
    if (audioReady) audio.updateRedCharge(rc);
    redOrb.update(dt, elapsed);
  }  if (s === STATE.CHARGED_READY) {
    blueOrb.update(dt, elapsed);
    redOrb.update(dt, elapsed);
  }  if (s === STATE.CHARGING_DUAL) {
    // Camera slight shake as charges build
    const shake = 0.015 * bc * rc;
    camera.position.x = Math.sin(elapsed * 23) * shake;
    camera.position.y = 0.5 + Math.cos(elapsed * 17) * shake;
  } else if (shakeTimer > 0) {
    // Violent release screen shake
    shakeTimer -= dt;
    const decay = Math.max(0, shakeTimer / 0.9);
    camera.position.x += (Math.random() - 0.5) * shakeMag * decay;
    camera.position.y += (Math.random() - 0.5) * shakeMag * decay;
  } else {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, dt * 4);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.5, dt * 4);
  }

  // Fusion sequence tick
  if (s === STATE.FUSING) {
    fusion.update(dt, elapsed);
    glitchAmount = THREE.MathUtils.lerp(glitchAmount, 0.5, dt * 3);
    rgbSplitAmt  = THREE.MathUtils.lerp(rgbSplitAmt, 0.7, dt * 3);
  }

  // Hollow purple tick
  if (s === STATE.HOLLOW_PURPLE) {
    hollowPurple.update(dt, elapsed);
    lensStrength = THREE.MathUtils.lerp(lensStrength, 0.18, dt * 2);
    glitchAmount = THREE.MathUtils.lerp(glitchAmount, 0.0, dt * 2);
    rgbSplitAmt  = THREE.MathUtils.lerp(rgbSplitAmt, 0.25, dt * 2);
  }

  // Release tick
  if (s === STATE.RELEASE) {
    hollowPurple.update(dt, elapsed);
    if (flyTicker) flyTicker(elapsed);
    glitchAmount = THREE.MathUtils.lerp(glitchAmount, 0.0, dt * 1.5);
    rgbSplitAmt  = THREE.MathUtils.lerp(rgbSplitAmt, 0.0, dt * 1.5);
    lensStrength = THREE.MathUtils.lerp(lensStrength, 0.0, dt * 3);
  }

  // Ambient particles
  ambientTimer += dt;
  if (ambientTimer >= AMBIENT_INTERVAL) {
    ambientTimer = 0;
    if (s === STATE.CHARGING_BLUE  || s === STATE.CHARGING_DUAL) {
      particles.spawnAmbient(blueOrb._built ? blueOrb.mesh.position : BLUE_POS, 0x0066ff, 3);
    }
    if (s === STATE.CHARGING_RED   || s === STATE.CHARGING_DUAL) {
      particles.spawnAmbient(redOrb._built ? redOrb.mesh.position : RED_POS, 0xff2200, 3);
    }
    if (s === STATE.HOLLOW_PURPLE) {
      particles.spawnAmbient(CENTER, 0xaa00ff, 4);
    }
  }
  particles.update(dt, elapsed);

  // ── Compute Hollow Purple orb screen position for lens pass ──
  let orbScreenPos = new THREE.Vector2(0.5, 0.5);
  if (s === STATE.HOLLOW_PURPLE || s === STATE.RELEASE) {
    orbScreenPos = worldToScreen(hollowPurple.mesh.position);
  }

  // ── Composer update ───────────────────────────────────────
  composer.update(elapsed, glitchAmount, rgbSplitAmt, lensStrength, orbScreenPos);

  // ── Render ───────────────────────────────────────────────
  composer.render();
}

tick();
