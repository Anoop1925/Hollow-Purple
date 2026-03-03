// ================================================================
// GestureDetector.js
// Wraps MediaPipe Hands and emits classified gesture events.
//
// Detected gestures:
//  • ROCK      — index + pinky up, middle + ring folded
//  • POINT     — only index up (left hand only → Red)
//  • PINCH     — thumb + index very close (< threshold)
//  • SNAP      — rapid pinch-to-open velocity spike
//  • OPEN      — all fingers extended
//  • FIST      — all fingers folded
// ================================================================

export class GestureDetector {
  /**
   * @param {HTMLVideoElement}  videoEl
   * @param {HTMLCanvasElement} overlayCanvas
   */
  constructor(videoEl, overlayCanvas) {
    this.video   = videoEl;
    this.overlay = overlayCanvas;
    this.ctx     = overlayCanvas.getContext('2d');

    // Emitted state per hand keyed by label ('Left'|'Right')
    this.gestures = { Left: 'NONE', Right: 'NONE' };

    // Velocity tracking for snap detection
    this._prevPinchDist = { Left: 0, Right: 0 };
    this._snapCooldown  = { Left: 0, Right: 0 };

    // Callbacks
    this.onGesture      = null;   // (hand:string, gesture:string) => void
    this.onHandPosition = null;   // (hand:string, nx:number, ny:number) called every frame
    this.onResults      = null;   // raw results passthrough

    this._hands  = null;
    this._camera = null;
    this._ready  = false;
  }

  async init() {
    // MediaPipe Hands
    this._hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
    });

    this._hands.setOptions({
      maxNumHands:          2,
      modelComplexity:      1,
      minDetectionConfidence:  0.72,
      minTrackingConfidence:   0.60,
    });

    this._hands.onResults((results) => this._onResults(results));

    // Camera
    this._camera = new window.Camera(this.video, {
      onFrame: async () => {
        await this._hands.send({ image: this.video });
      },
      width: 640, height: 480,
    });

    await this._camera.start();
    this._ready = true;
  }

  // ─────────────────────────────────────────────────────────────
  // Internal: process MediaPipe results
  // ─────────────────────────────────────────────────────────────
  _onResults(results) {
    // ── Draw skeleton on full-screen overlay ─────────────────
    // Use display dimensions so landmarks span the full viewport
    const w = this.overlay.width  = this.overlay.offsetWidth  || window.innerWidth;
    const h = this.overlay.height = this.overlay.offsetHeight || window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const rawLabel  = results.multiHandedness[i].label;
        const label     = rawLabel === 'Left' ? 'Right' : 'Left';

        window.drawConnectors(this.ctx, landmarks,
          window.HAND_CONNECTIONS, { color: label === 'Right' ? '#00aaff55' : '#ff223355', lineWidth: 1.5 });
        window.drawLandmarks(this.ctx, landmarks,
          { color: label === 'Right' ? '#00cfff' : '#ff4455', lineWidth: 0.5, radius: 3 });

        // Emit palm-center position (average of MCP knuckles + wrist)
        // landmark 0=wrist, 5=index_mcp, 9=middle_mcp, 13=ring_mcp, 17=pinky_mcp
        const palmLMs = [0, 5, 9, 13, 17];
        let px = 0, py = 0;
        for (const idx of palmLMs) { px += landmarks[idx].x; py += landmarks[idx].y; }
        px /= palmLMs.length; py /= palmLMs.length;
        // Shift upward so orb floats above the palm
        py -= 0.10;
        if (this.onHandPosition) this.onHandPosition(label, px, py);

        // Classify gesture
        const gesture = this._classify(landmarks, label, results.multiHandedness[i].score);
        if (gesture !== this.gestures[label]) {
          this.gestures[label] = gesture;
          if (this.onGesture) this.onGesture(label, gesture);
        }
      }
    }

    // Clear gestures for hands that disappeared.
    // Use the SAME flip as above so keys match this.gestures
    const visibleLabels = new Set(
      (results.multiHandedness || []).map(h => h.label === 'Left' ? 'Right' : 'Left')
    );
    for (const hand of ['Left', 'Right']) {
      if (!visibleLabels.has(hand) && this.gestures[hand] !== 'NONE') {
        this.gestures[hand] = 'NONE';
        if (this.onGesture) this.onGesture(hand, 'NONE');
      }
    }

    if (this.onResults) this.onResults(results);
  }

  // ─────────────────────────────────────────────────────────────
  // Landmark indices (MediaPipe canonical)
  //   0:wrist  1:thumb_cmc  2:thumb_mcp  3:thumb_ip  4:thumb_tip
  //   5:index_mcp  6:index_pip  7:index_dip  8:index_tip
  //   9:middle_mcp 10:middle_pip 11:middle_dip 12:middle_tip
  //  13:ring_mcp  14:ring_pip  15:ring_dip  16:ring_tip
  //  17:pinky_mcp 18:pinky_pip 19:pinky_dip 20:pinky_tip
  // ─────────────────────────────────────────────────────────────

  _fingerExtended(lm, tipIdx, pipIdx, mcpIdx) {
    // A finger is extended if tip is higher than pip (smaller y in screen space)
    const tip = lm[tipIdx];
    const pip = lm[pipIdx];
    const mcp = lm[mcpIdx];
    // "extended" = tip further from wrist than pip along finger axis
    const tipD = Math.hypot(tip.x - lm[0].x, tip.y - lm[0].y);
    const pipD = Math.hypot(pip.x - lm[0].x, pip.y - lm[0].y);
    return tipD > pipD * 1.05;
  }

  _thumbExtended(lm) {
    const tip = lm[4]; const ip = lm[3]; const mcp = lm[2];
    const d1  = Math.hypot(tip.x - lm[0].x, tip.y - lm[0].y);
    const d2  = Math.hypot(ip.x  - lm[0].x, ip.y  - lm[0].y);
    return d1 > d2;
  }

  _pinchDist(lm) {
    const t = lm[4]; const i = lm[8];
    return Math.hypot(t.x - i.x, t.y - i.y, (t.z || 0) - (i.z || 0));
  }

  _classify(lm, label) {
    const index  = this._fingerExtended(lm, 8,  6,  5);
    const middle = this._fingerExtended(lm, 12, 10, 9);
    const ring   = this._fingerExtended(lm, 16, 14, 13);
    const pinky  = this._fingerExtended(lm, 20, 18, 17);
    const thumb  = this._thumbExtended(lm);

    const pd = this._pinchDist(lm);

    // ── Snap detection ────────────────────────────────────────
    const prevPd = this._prevPinchDist[label];
    const dpDt   = pd - prevPd;
    this._prevPinchDist[label] = pd;

    if (this._snapCooldown[label] > 0) this._snapCooldown[label]--;

    // A snap: rapid open from pinch → velocity spike > threshold
    if (dpDt > 0.055 && prevPd < 0.06 && this._snapCooldown[label] === 0) {
      this._snapCooldown[label] = 12; // frames cooldown
      return 'SNAP';
    }

    // ── Static gesture classification ─────────────────────────
    if (pd < 0.04) return 'PINCH';

    // Rock sign: index + pinky up, middle + ring down
    if (index && !middle && !ring && pinky) return 'ROCK';

    // Pointing: only index up
    if (index && !middle && !ring && !pinky) return 'POINT';

    // Open hand: all 4 fingers extended
    if (index && middle && ring && pinky) return 'OPEN';

    // Fist: nothing extended
    if (!index && !middle && !ring && !pinky) return 'FIST';

    return 'NONE';
  }

  destroy() {
    if (this._camera) this._camera.stop();
    if (this._hands)  this._hands.close();
  }
}
