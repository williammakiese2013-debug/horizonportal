/* ============================================================
   handTracking.js — Horizon VR GLOBAL GESTURE LAYER
   ============================================================
   IMPORTANT: this file does NOT open a camera, load MediaPipe, or touch
   the WebXR hand-tracking API. All of that already exists and is running
   in js/vr-interactions/hand-tracking-vision.js, which exposes the live
   result every frame via `window.__handTrackAPI`:
     .isActive     -> bool, hand currently detected
     .screen       -> {pageX, pageY} cursor position in real page pixels
     .pointing     -> bool, "index finger extended, others curled",
                      already confirmed over a few frames (anti-jitter)

   This module's ONLY job is to turn that existing stream into two
   GLOBAL, portal-wide gestures, independent of the open-palm grab/move
   system that already exists (window-grab-move.js / window-zoom-resize.js):

     1. TAP    — point the finger at a target and HOLD it still for a
                 short moment ("dwell"). No push, no depth estimate: just
                 aim and hold, which is both easier to perform and far
                 more reliable than tracking a fast Z push from a single
                 mono camera (the old approach, prone to false triggers).
     2. SCROLL — smooth glide of the extended index finger along Y.

   Both gestures require `pointing` to be true (index extended, other
   fingers curled) — this is the shared "arming" gate, so an open palm
   (used for grab/move elsewhere) never accidentally triggers a tap or a
   scroll here.

   DWELL vs SCROLL: the dwell timer only accumulates while the on-screen
   cursor stays within a small radius of where the dwell started. As soon
   as the finger glides beyond that radius, the dwell resets to the new
   spot — which is exactly what naturally happens the instant a real
   scroll gesture starts, so the two gestures never fight over the same
   motion: stand still + point = click, glide up/down + point = scroll.
   ============================================================ */
(function () {
  // Tunable thresholds — exposed on window so they can be recalibrated
  // per-device without touching this file.
  const CONFIG = (window.HORIZON_NAV_CONFIG = Object.assign(
    {
      // --- TAP (dwell: point + hold still) ---
      DWELL_MS: 480, // how long the pointing finger must stay still over the same spot to fire a tap
      DWELL_STILL_PX: 26, // max on-screen drift (page px) tolerated while "holding"
      TAP_DEBOUNCE_MS: 350, // min time between two taps

      // --- SCROLL (Y axis, in page px/s) ---
      SCROLL_MIN_SPEED_PX: 60, // minimum |dy/dt| (page px/s) to start scrolling
      SCROLL_SENSITIVITY: 1.1, // scroll px produced per px/s of finger speed
      SCROLL_SMOOTHING: 0.35, // velocity smoothing (0..1, higher = snappier)
      SCROLL_INVERT: false, // true = gliding hand down scrolls content up

      HISTORY_WINDOW_S: 0.12, // sliding window used for the Y velocity estimate
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
    dwellProgress: 0, // 0..1, how far along the current dwell is (for UI feedback)
  };

  function getState() {
    return state;
  }
  window.HorizonHandNav = { getState, CONFIG };

  // Sliding history of the on-screen cursor, Y only: [{t, y}]
  const hist = [];
  let scrollVel = 0; // smoothed scroll velocity accumulator (page px/s)

  let dwellX = null, dwellY = null; // page px position where the current dwell started
  let dwellStart = 0;
  let dwellFired = false; // true once this dwell has already fired a tap (re-arms on move/unpoint)
  let lastTapTime = -999;

  function reset() {
    state.visible = false;
    state.pointing = false;
    state.tap = false;
    state.scrollDeltaY = 0;
    state.dwellProgress = 0;
    hist.length = 0;
    scrollVel = 0;
    dwellX = null; dwellY = null; dwellStart = 0; dwellFired = false;
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

    const screen = api.screen;
    if (!screen) {
      requestAnimationFrame(sample);
      return;
    }

    state.visible = true;
    state.screenX = screen.pageX;
    state.screenY = screen.pageY;
    state.pointing = !!api.pointing;

    if (!state.pointing) {
      dwellX = null; dwellY = null; dwellStart = 0; dwellFired = false;
      state.dwellProgress = 0;
      hist.length = 0;
      requestAnimationFrame(sample);
      return;
    }

    const now = performance.now();
    detectDwellTap(screen.pageX, screen.pageY, now);
    if (!state.tap) detectScroll(screen.pageY, now);

    requestAnimationFrame(sample);
  }

  function detectDwellTap(x, y, now) {
    if (dwellX === null) {
      dwellX = x; dwellY = y; dwellStart = now; dwellFired = false;
      state.dwellProgress = 0;
      return;
    }
    const drift = Math.hypot(x - dwellX, y - dwellY);
    if (drift > CONFIG.DWELL_STILL_PX) {
      // Finger moved away from the spot it was aiming at — restart the dwell here.
      dwellX = x; dwellY = y; dwellStart = now; dwellFired = false;
      state.dwellProgress = 0;
      return;
    }
    if (dwellFired) {
      state.dwellProgress = 1;
      return;
    }
    const elapsed = now - dwellStart;
    state.dwellProgress = Math.min(1, elapsed / CONFIG.DWELL_MS);
    const debounceOk = (now - lastTapTime) > CONFIG.TAP_DEBOUNCE_MS;
    if (elapsed >= CONFIG.DWELL_MS && debounceOk) {
      state.tap = true;
      dwellFired = true;
      lastTapTime = now;
    }
  }

  function detectScroll(y, nowMs) {
    const tSec = nowMs / 1000;
    hist.push({ t: tSec, y });
    while (hist.length > 2 && tSec - hist[0].t > CONFIG.HISTORY_WINDOW_S) hist.shift();
    if (hist.length < 2) return;

    const first = hist[0];
    const last = hist[hist.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0.001) return;

    const vY = (last.y - first.y) / dt; // page px/s

    if (Math.abs(vY) < CONFIG.SCROLL_MIN_SPEED_PX) {
      scrollVel *= 1 - CONFIG.SCROLL_SMOOTHING; // decay smoothly to a stop
      state.scrollDeltaY = Math.abs(scrollVel) > 0.5 ? scrollVel / 60 : 0;
      return;
    }

    const sign = CONFIG.SCROLL_INVERT ? -1 : 1;
    const targetVel = CONFIG.SCROLL_SENSITIVITY * vY * sign;
    scrollVel += (targetVel - scrollVel) * CONFIG.SCROLL_SMOOTHING;
    state.scrollDeltaY = scrollVel / 60; // convert px/s -> px for this ~60Hz-equivalent frame
  }

  requestAnimationFrame(sample);
})();
