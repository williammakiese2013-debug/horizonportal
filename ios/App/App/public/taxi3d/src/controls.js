import { getHandState } from './hand.js';

let controls = {
  gas: 0,
  brake: 0,
  steer: 0,
  horn: false,
  viewToggle: false,
  colorCycle: false,
};

// === TOUCH CONTROLS ===
export function initControls() {
  // Gas pedal
  const gasEl = document.getElementById('pedal-gas');
  if (gasEl) {
    gasEl.addEventListener('touchstart', e => { e.preventDefault(); controls.gas = 1; gasEl.classList.add('active'); }, { passive: false });
    gasEl.addEventListener('touchend', e => { e.preventDefault(); controls.gas = 0; gasEl.classList.remove('active'); }, { passive: false });
    gasEl.addEventListener('touchcancel', e => { controls.gas = 0; gasEl.classList.remove('active'); });
    gasEl.addEventListener('mousedown', () => { controls.gas = 1; gasEl.classList.add('active'); });
    gasEl.addEventListener('mouseup', () => { controls.gas = 0; gasEl.classList.remove('active'); });
    gasEl.addEventListener('mouseleave', () => { controls.gas = 0; gasEl.classList.remove('active'); });
  }

  // Brake pedal
  const brakeEl = document.getElementById('pedal-brake');
  if (brakeEl) {
    brakeEl.addEventListener('touchstart', e => { e.preventDefault(); controls.brake = 1; brakeEl.classList.add('active'); }, { passive: false });
    brakeEl.addEventListener('touchend', e => { e.preventDefault(); controls.brake = 0; brakeEl.classList.remove('active'); }, { passive: false });
    brakeEl.addEventListener('touchcancel', e => { controls.brake = 0; brakeEl.classList.remove('active'); });
    brakeEl.addEventListener('mousedown', () => { controls.brake = 1; brakeEl.classList.add('active'); });
    brakeEl.addEventListener('mouseup', () => { controls.brake = 0; brakeEl.classList.remove('active'); });
    brakeEl.addEventListener('mouseleave', () => { controls.brake = 0; brakeEl.classList.remove('active'); });
  }

  // Steering zone (left half)
  const steerZone = document.getElementById('steer-zone');
  let steerTouchId = null;
  let steerBaseX = 0;

  steerZone.addEventListener('touchstart', e => {
    if (steerTouchId !== null) return;
    const t = e.changedTouches[0];
    steerTouchId = t.identifier;
    steerBaseX = t.clientX;
  }, { passive: true });
  steerZone.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === steerTouchId) {
        const dx = (t.clientX - steerBaseX) / window.innerWidth * 4;
        controls.steer = Math.max(-1, Math.min(1, dx));
      }
    }
  }, { passive: true });
  steerZone.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === steerTouchId) { steerTouchId = null; controls.steer = 0; }
    }
  }, { passive: true });
  steerZone.addEventListener('touchcancel', () => { steerTouchId = null; controls.steer = 0; });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'w') controls.gas = 1;
    if (e.key === 'ArrowDown' || e.key === 's') controls.brake = 1;
    if (e.key === 'ArrowLeft' || e.key === 'a') controls.steer = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') controls.steer = 1;
    if (e.key === 'h') controls.horn = true;
    if (e.key === 'v') controls.viewToggle = true;
    if (e.key === 'c') controls.colorCycle = true;
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === 'w') controls.gas = 0;
    if (e.key === 'ArrowDown' || e.key === 's') controls.brake = 0;
    if (e.key === 'ArrowLeft' || e.key === 'a') { if (controls.steer < 0) controls.steer = 0; }
    if (e.key === 'ArrowRight' || e.key === 'd') { if (controls.steer > 0) controls.steer = 0; }
    if (e.key === 'h') controls.horn = false;
  });

  // Buttons
  document.getElementById('btn-horn')?.addEventListener('click', () => {
    controls.horn = true;
    setTimeout(() => controls.horn = false, 300);
  });
  document.getElementById('btn-view')?.addEventListener('click', () => {
    if (window.TX) {
      const modes = ['interior', 'hood', 'exterior'];
      const idx = modes.indexOf(window.TX.viewMode);
      window.TX.viewMode = modes[(idx + 1) % modes.length];
    }
  });
  document.getElementById('btn-lights')?.addEventListener('click', () => {
    controls.colorCycle = true;
  });

  // Gyroscope tilt steering (fallback)
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', e => {
      if (Math.abs(controls.steer) < 0.05 && e.gamma !== null) {
        controls.steer = Math.max(-1, Math.min(1, e.gamma / 45));
      }
    });
  }
}

// === HAND TRACKING CONTROLS ===
export function updateHandControls(dt) {
  const hs = getHandState();
  if (!hs || !hs.visible) return;

  // Only use hand controls if hands are in driving position
  // (wrist Y between 0.3 and 0.8 = hands at chest/steering wheel height)
  const wristY = hs.landmarks ? hs.landmarks[0].y : 0.5;
  if (wristY < 0.2 || wristY > 0.85) return;

  // Steering: based on hand X position
  if (Math.abs(hs.steerX) > 0.05) {
    controls.steer = hs.steerX;
  }

  // Gas: based on hand height (hands higher = less gas, hands lower = more gas)
  if (hs.gas > 0.05 && hs.gas < 0.95) {
    controls.gas = hs.gas;
  } else if (hs.gas <= 0.05) {
    controls.gas = 0;
  }

  // Brake: fist gesture or hands pulled back
  if (hs.fist) {
    controls.brake = 1;
  } else if (controls.brake > 0 && !hs.fist) {
    controls.brake = 0;
  }

  // View toggle: thumbs up
  if (hs.thumbsUp && !window._thumbsPrev) {
    controls.viewToggle = true;
  }
  window._thumbsPrev = hs.thumbsUp;

  // Horn: peace sign
  if (hs.peaceSign && !window._peacePrev) {
    controls.horn = true;
    setTimeout(() => controls.horn = false, 400);
  }
  window._peacePrev = hs.peaceSign;
}

export function getControls() { return controls; }
