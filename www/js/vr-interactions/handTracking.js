/* ============================================================
   handTracking.js — Horizon VR GLOBAL GESTURE LAYER
   ============================================================
   IMPORTANT: this file does NOT open a camera, load MediaPipe, or touch
   the WebXR hand-tracking API. All of that already exists and is running
   in js/vr-interactions/hand-tracking-legacy.js, which exposes the live
   result every frame via `window.__handTrackAPI`:
     .isActive     -> bool, hand currently detected
     .screen       -> {pageX, pageY} cursor position in real page pixels
     .landmarks    -> 21 {x,y,z} points (screen-normalized 0..1, same
                      "cover" projection as the camera feed; z is
                      MediaPipe's relative depth, wrist-referenced)
     .pointing     -> bool, "index finger extended, others curled",
                      already confirmed over 3 frames (anti-jitter)

   This module's ONLY job is to turn that existing stream into two
   GLOBAL, portal-wide gestures, independent of the pinch/grab system
   that already exists (window-grab-move.js):

     1. TAP    — fast push of the extended index finger along Z (depth)
     2. SCROLL — smooth glide of the extended index finger along Y

   Both gestures require `pointing` to be true (index extended, other
   fingers curled) — this is the shared "arming" gate, so an open palm
   or a pinch never accidentally triggers a tap/scroll.

   AXIS ISOLATION: every frame we compare the Z-velocity against the
   Y-velocity of the same short time window. Whichever axis dominates
   the other by AXIS_DOMINANCE_MARGIN "wins" the frame — a fast forward
   push never leaks into the scroll accumulator, and a vertical glide
   never fires a tap. See detectTap()/detectScroll() below.
   ============================================================ */
(function () {
  // Tunable thresholds — exposed on window so they can be recalibrated
  // per-device without touching this file.
  const CONFIG = (window.HORIZON_NAV_CONFIG = Object.assign(
    {
      // --- TAP (Z axis) ---
      TAP_Z_DELTA: 0.028, // how much closer to the camera than "rest" depth counts as a push
      TAP_Z_SPEED: 0.16, // minimum |dz/dt| (z-units/s) to count as "fast"
      TAP_DEBOUNCE_MS: 380, // min time between two taps
      TAP_REARM_RATIO: 0.4, // must retreat back to 40% of the delta before re-arming
      REST_Z_SMOOTHING: 0.06, // EMA rate for the "neutral" resting depth

      // --- SCROLL (Y axis) ---
      SCROLL_MIN_SPEED: 0.05, // minimum |dy/dt| (normalized/s) to start scrolling
      SCROLL_SENSITIVITY: 900, // px of scroll per unit of normalized Y speed
      SCROLL_SMOOTHING: 0.35, // velocity smoothing (0..1, higher = snappier)
      SCROLL_INVERT: false, // true = gliding hand down scrolls content up

      // --- Cross-axis arbitration ---
      AXIS_DOMINANCE_MARGIN: 1.3, // an axis must beat the other by 30% to "win" the frame
      HISTORY_WINDOW_S: 0.12, // sliding window used for both velocity estimates
    },
    window.HORIZON_NAV_CONFIG || {}
  ));

  const state = {
    visible: false,
    pointing: false,
    screenX: 0,
    screenY: 0,
    tap: false, // true for exactly one frame when a tap fires
    scrollDeltaY: 0, // px to scroll this frame (0 = no scroll this frame)
  };

  function getState() {
    return state;
  }
  window.HorizonHandNav = { getState, CONFIG };

  // Sliding history of the index fingertip (landmark #8): {t, y, z}
  const hist = [];
  let restZ = null; // slow EMA of "neutral" depth, used as the tap baseline
  let armedForTap = true; // hysteresis: re-armed only once the finger returns near restZ
  let lastTapTime = -999;
  let scrollVel = 0; // smoothed scroll velocity accumulator

  function reset() {
    state.visible = false;
    state.pointing = false;
    state.tap = false;
    state.scrollDeltaY = 0;
    hist.length = 0;
    restZ = null;
    armedForTap = true;
    scrollVel = 0;
  }

  function sample() {
    const api = window.__handTrackAPI;
    state.tap = false;
    state.scrollDeltaY = 0;

    if (!api || !api.isActive) {
      reset();
      requestAnimationFrame(sample);
      return;
    }

    const lm = api.landmarks;
    const screen = api.screen;
    if (!lm || !screen) {
      requestAnimationFrame(sample);
      return;
    }

    state.visible = true;
    state.screenX = screen.pageX;
    state.screenY = screen.pageY;
    // Reuse the already-confirmed "index extended" gesture as the arming
    // gate for BOTH global gestures below — avoids re-detecting finger
    // extension from scratch and stays consistent with the rest of the
    // portal's hand UI (pinch/grab/depth all gate on their own explicit
    // gestures the same way).
    state.pointing = !!api.pointing;

    const now = performance.now() / 1000;
    const indexTip = lm[8];
    hist.push({ t: now, y: indexTip.y, z: indexTip.z || 0 });
    while (hist.length > 2 && now - hist[0].t > CONFIG.HISTORY_WINDOW_S) hist.shift();

    if (!state.pointing || hist.length < 2) {
      requestAnimationFrame(sample);
      return;
    }

    const first = hist[0];
    const last = hist[hist.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0.001) {
      requestAnimationFrame(sample);
      return;
    }

    const vZ = (last.z - first.z) / dt; // depth velocity (z-units/s)
    const vY = (last.y - first.y) / dt; // vertical velocity (normalized/s)

    // "Rest" depth only drifts while armed and NOT mid-push, so the tap
    // itself never drags its own baseline along with it.
    if (restZ === null) restZ = indexTip.z;
    else if (armedForTap) restZ += (indexTip.z - restZ) * CONFIG.REST_Z_SMOOTHING;

    detectTap(indexTip.z, vZ, vY, now);
    if (!state.tap) detectScroll(vY, vZ);

    requestAnimationFrame(sample);
  }

  function detectTap(z, vZ, vY, now) {
    const pushedIn = restZ - z > CONFIG.TAP_Z_DELTA; // closer to camera than neutral
    const fastEnough = Math.abs(vZ) > CONFIG.TAP_Z_SPEED;
    const debounceOk = (now - lastTapTime) * 1000 > CONFIG.TAP_DEBOUNCE_MS;
    // Z must clearly dominate Y for this same window, or a fast vertical
    // glide could spuriously read as a "push" on a noisy frame.
    const zDominatesY = Math.abs(vZ) > Math.abs(vY) * CONFIG.AXIS_DOMINANCE_MARGIN;

    if (armedForTap && pushedIn && fastEnough && debounceOk && zDominatesY) {
      state.tap = true;
      lastTapTime = now;
      armedForTap = false; // disarm until the finger retreats back out
    }
    if (!armedForTap && restZ - z < CONFIG.TAP_Z_DELTA * CONFIG.TAP_REARM_RATIO) {
      armedForTap = true; // finger is back near resting depth -> re-armed
    }
  }

  function detectScroll(vY, vZ) {
    if (Math.abs(vY) < CONFIG.SCROLL_MIN_SPEED) {
      scrollVel *= 1 - CONFIG.SCROLL_SMOOTHING; // decay smoothly to a stop
      state.scrollDeltaY = Math.abs(scrollVel) > 0.5 ? scrollVel / 60 : 0;
      return;
    }
    // Y must clearly dominate Z, or a forward push (tap) could bleed into
    // an unwanted scroll on the same frame.
    if (Math.abs(vZ) * CONFIG.AXIS_DOMINANCE_MARGIN > Math.abs(vY)) return;

    const sign = CONFIG.SCROLL_INVERT ? -1 : 1;
    const targetVel = CONFIG.SCROLL_SENSITIVITY * vY * sign;
    scrollVel += (targetVel - scrollVel) * CONFIG.SCROLL_SMOOTHING;
    state.scrollDeltaY = scrollVel / 60; // convert px/s -> px for this ~60Hz-equivalent frame
  }

  requestAnimationFrame(sample);
})();
