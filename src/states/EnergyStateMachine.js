// ================================================================
// EnergyStateMachine.js
//
// States:
//   IDLE → CHARGING_BLUE → CHARGING_DUAL → FUSING → 
//   IMPLOSION → HOLLOW_PURPLE → RELEASE → IDLE
//
//   IDLE → CHARGING_RED  → CHARGING_DUAL (same path)
//
// Transitions are driven by gesture events from GestureDetector.
// ================================================================

export const STATE = Object.freeze({
  IDLE:           'IDLE',
  CHARGING_BLUE:  'CHARGING_BLUE',
  CHARGING_RED:   'CHARGING_RED',
  CHARGING_DUAL:  'CHARGING_DUAL',
  CHARGED_READY:  'CHARGED_READY',   // Both orbs full — float freely, await SNAP to fuse
  FUSING:         'FUSING',
  HOLLOW_PURPLE:  'HOLLOW_PURPLE',
  RELEASE:        'RELEASE',
});

export class EnergyStateMachine {
  constructor() {
    this.state     = STATE.IDLE;
    this.prevState = STATE.IDLE;

    // Gesture snapshot per hand
    this._gestures = { Left: 'NONE', Right: 'NONE' };

    // Charge levels (0–1), ramped up over time
    this.blueCharge = 0.0;
    this.redCharge  = 0.0;

    // Callbacks
    this.onStateChange = null;   // (newState, prevState) => void
    this.onRelease     = null;   // () => void
  }

  // ─────────────────────────────────────────────────────────────
  // Called by GestureDetector whenever a hand's gesture changes
  // ─────────────────────────────────────────────────────────────
  onGesture(hand, gesture) {
    this._gestures[hand] = gesture;
    this._evaluate();
  }

  // ─────────────────────────────────────────────────────────────
  // Called every frame with delta time (seconds)
  // ─────────────────────────────────────────────────────────────
  update(dt) {
    // Ramp charges based on active state
    const ramp    = dt * 0.9;    // ~1.1 s to full charge
    const decay   = dt * 1.8;   // faster decay

    switch (this.state) {
      case STATE.CHARGING_BLUE:
        this.blueCharge = Math.min(1.0, this.blueCharge + ramp);
        this.redCharge  = Math.max(0.0, this.redCharge  - decay);
        break;

      case STATE.CHARGING_RED:
        this.redCharge  = Math.min(1.0, this.redCharge  + ramp);
        this.blueCharge = Math.max(0.0, this.blueCharge - decay);
        break;

      case STATE.CHARGING_DUAL:
        this.blueCharge = Math.min(1.0, this.blueCharge + ramp * 0.7);
        this.redCharge  = Math.min(1.0, this.redCharge  + ramp * 0.7);
        // Auto-promote once both orbs are sufficiently charged
        if (this.blueCharge >= 0.90 && this.redCharge >= 0.90) {
          this._transition(STATE.CHARGED_READY);
        }
        break;

      case STATE.CHARGED_READY:
        // Lock charges at full — orbs float freely, no hands needed
        this.blueCharge = 1.0;
        this.redCharge  = 1.0;
        break;

      case STATE.FUSING:
      case STATE.HOLLOW_PURPLE:
      case STATE.RELEASE:
        // Charges are frozen during these phases
        break;

      default:
        // IDLE: decay both
        this.blueCharge = Math.max(0.0, this.blueCharge - decay * 0.5);
        this.redCharge  = Math.max(0.0, this.redCharge  - decay * 0.5);
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Evaluate state from current gesture snapshot
  // ─────────────────────────────────────────────────────────────
  _evaluate() {
    const L = this._gestures.Left;
    const R = this._gestures.Right;
    const s = this.state;

    // Block transitions during fusion / release sequences
    if (s === STATE.FUSING || s === STATE.HOLLOW_PURPLE || s === STATE.RELEASE) {
      // Right SNAP or right OPEN → release the Hollow Purple orb
      if (s === STATE.HOLLOW_PURPLE && (R === 'SNAP' || R === 'OPEN' || L === 'SNAP' || L === 'OPEN')) {
        this._transition(STATE.RELEASE);
      }
      return;
    }

    // ── CHARGED_READY: orbs floating free, await fuse gesture ─
    if (s === STATE.CHARGED_READY) {
      // Any SNAP or OPEN from either hand fires fusion
      if (R === 'SNAP' || R === 'OPEN' || L === 'SNAP' || L === 'OPEN') {
        this._transition(STATE.FUSING);
      }
      // Do NOT fall through — no decay/IDLE from hands disappearing
      return;
    }

    // ── Gesture mapping ──────────────────────────────────────
    // Right hand ROCK/FIST → Blue singularity
    // Left  hand POINT/FIST → Red plasma
    const rightCharge = R === 'ROCK' || R === 'FIST';
    const leftCharge  = L === 'POINT' || L === 'FIST';

    // SNAP from right hand → fuse (only if in CHARGING_DUAL)
    if (R === 'SNAP' || R === 'OPEN') {
      if (s === STATE.CHARGING_DUAL) {
        this._transition(STATE.FUSING);
        return;
      }
    }

    if (rightCharge && leftCharge) {
      // Both hands active → dual charging
      if (s !== STATE.CHARGING_DUAL) this._transition(STATE.CHARGING_DUAL);
    } else if (rightCharge) {
      // Only right → blue
      if (s !== STATE.CHARGING_BLUE) this._transition(STATE.CHARGING_BLUE);
    } else if (leftCharge) {
      // Only left → red
      if (s !== STATE.CHARGING_RED) this._transition(STATE.CHARGING_RED);
    } else if (L === 'NONE' && R === 'NONE') {
      // Both hands gone → idle
      if (s === STATE.CHARGING_BLUE || s === STATE.CHARGING_RED || s === STATE.CHARGING_DUAL) {
        this._transition(STATE.IDLE);
      }
    }
  }

  // Called externally when fusion animation finishes
  onFusionComplete() {
    this._transition(STATE.HOLLOW_PURPLE);
  }

  // Called externally when release animation finishes
  onReleaseComplete() {
    this.blueCharge = 0;
    this.redCharge  = 0;
    this._transition(STATE.IDLE);
  }

  _transition(newState) {
    if (this.state === newState) return;
    this.prevState = this.state;
    this.state     = newState;
    if (this.onStateChange) this.onStateChange(newState, this.prevState);
  }
}
