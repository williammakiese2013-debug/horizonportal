// mobileControls.js
// Étape 4/N : contrôles tactiles pour jouer sans clavier/souris.
// - Joystick virtuel (côté gauche) : déplacement analogique
// - Zone de glisser (côté droit) : orientation de la caméra
// - Boutons : Sauter, Toile (maintenir pour swinguer), Courir (bascule)
//
// Ce module crée son propre DOM (pas besoin de toucher à index.html) et
// se branche uniquement sur l'API exposée par player.js.

import { CONFIG } from './config.js';

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .mc-layer {
      position: fixed;
      inset: 0;
      z-index: 20;
      touch-action: none;
    }
    .mc-look-zone {
      position: absolute;
      top: 0;
      right: 0;
      width: 60%;
      height: 100%;
    }
    .mc-joystick-zone {
      position: absolute;
      top: 0;
      left: 0;
      width: 40%;
      height: 100%;
    }
    .mc-joystick-base {
      position: absolute;
      width: 100px;
      height: 100px;
      margin-left: -50px;
      margin-top: -50px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 2px solid rgba(255, 255, 255, 0.35);
      display: none;
    }
    .mc-joystick-knob {
      position: absolute;
      width: 46px;
      height: 46px;
      margin-left: -23px;
      margin-top: -23px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.55);
      display: none;
    }
    .mc-buttons {
      position: fixed;
      right: 18px;
      bottom: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      z-index: 21;
    }
    .mc-btn {
      width: 78px;
      height: 78px;
      border-radius: 50%;
      background: rgba(20, 22, 30, 0.55);
      border: 2px solid rgba(255, 255, 255, 0.4);
      color: #f4f4f4;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    .mc-btn.active {
      background: rgba(244, 244, 244, 0.35);
    }
    .mc-run-btn {
      width: 60px;
      height: 60px;
      align-self: flex-end;
      font-size: 11px;
    }
    .mc-hint {
      position: fixed;
      top: 12px;
      left: 12px;
      right: 12px;
      color: #e5e7eb;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      background: rgba(10, 12, 18, 0.55);
      padding: 8px 12px;
      border-radius: 8px;
      pointer-events: none;
      z-index: 22;
      transition: opacity 0.6s ease;
    }
  `;
  document.head.appendChild(style);
}

export function createMobileControls(player) {
  injectStyles();

  // --- Message d'aide, disparaît tout seul après quelques secondes ---
  const hint = document.createElement('div');
  hint.className = 'mc-hint';
  hint.textContent =
    'Joystick à gauche pour te déplacer — glisse à droite pour regarder — 🕸 TOILE : accroche/lâche pour swinguer — ZIP : tir-grappin direct vers le point visé';
  document.body.appendChild(hint);
  setTimeout(() => {
    hint.style.opacity = '0';
    setTimeout(() => hint.remove(), 700);
  }, 5000);

  // --- Zones tactiles (joystick + regard) ---
  const layer = document.createElement('div');
  layer.className = 'mc-layer';

  const joystickZone = document.createElement('div');
  joystickZone.className = 'mc-joystick-zone';

  const joystickBase = document.createElement('div');
  joystickBase.className = 'mc-joystick-base';
  const joystickKnob = document.createElement('div');
  joystickKnob.className = 'mc-joystick-knob';

  const lookZone = document.createElement('div');
  lookZone.className = 'mc-look-zone';

  layer.appendChild(joystickZone);
  layer.appendChild(lookZone);
  document.body.appendChild(layer);
  document.body.appendChild(joystickBase);
  document.body.appendChild(joystickKnob);

  // --- Boutons d'action ---
  const buttons = document.createElement('div');
  buttons.className = 'mc-buttons';

  const runBtn = document.createElement('div');
  runBtn.className = 'mc-btn mc-run-btn';
  runBtn.textContent = 'COURIR';

  const jumpBtn = document.createElement('div');
  jumpBtn.className = 'mc-btn';
  jumpBtn.textContent = 'SAUT';

  const webBtn = document.createElement('div');
  webBtn.className = 'mc-btn';
  webBtn.textContent = 'TOILE';

  const zipBtn = document.createElement('div');
  zipBtn.className = 'mc-btn';
  zipBtn.textContent = 'ZIP';

  buttons.appendChild(runBtn);
  buttons.appendChild(jumpBtn);
  buttons.appendChild(webBtn);
  buttons.appendChild(zipBtn);
  document.body.appendChild(buttons);

  // --- Logique du joystick ---
  let joystickTouchId = null;
  let joystickOrigin = { x: 0, y: 0 };
  const radius = CONFIG.MOBILE_JOYSTICK_RADIUS;

  joystickZone.addEventListener('touchstart', (e) => {
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    joystickOrigin = { x: touch.clientX, y: touch.clientY };

    joystickBase.style.left = `${touch.clientX}px`;
    joystickBase.style.top = `${touch.clientY}px`;
    joystickKnob.style.left = `${touch.clientX}px`;
    joystickKnob.style.top = `${touch.clientY}px`;
    joystickBase.style.display = 'block';
    joystickKnob.style.display = 'block';
  });

  joystickZone.addEventListener('touchmove', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== joystickTouchId) continue;
      let dx = touch.clientX - joystickOrigin.x;
      let dy = touch.clientY - joystickOrigin.y;
      const dist = Math.min(Math.hypot(dx, dy), radius);
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist;

      joystickKnob.style.left = `${joystickOrigin.x + dx}px`;
      joystickKnob.style.top = `${joystickOrigin.y + dy}px`;

      // x : latéral (-1..1) — z : avant (1) / arrière (-1), même convention que
      // le clavier (voir player.js). Le stick vers le haut donne un dy négatif
      // à l'écran, d'où le signe inversé ici pour obtenir +1 = avancer.
      player.setMoveVector(dx / radius, -dy / radius);
    }
  });

  function endJoystick(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== joystickTouchId) continue;
      joystickTouchId = null;
      joystickBase.style.display = 'none';
      joystickKnob.style.display = 'none';
      player.setMoveVector(0, 0);
    }
  }
  joystickZone.addEventListener('touchend', endJoystick);
  joystickZone.addEventListener('touchcancel', endJoystick);

  // --- Logique de la zone de regard (glisser pour orienter la caméra) ---
  let lookTouchId = null;
  let lastLook = { x: 0, y: 0 };

  lookZone.addEventListener('touchstart', (e) => {
    const touch = e.changedTouches[0];
    lookTouchId = touch.identifier;
    lastLook = { x: touch.clientX, y: touch.clientY };
  });

  lookZone.addEventListener('touchmove', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== lookTouchId) continue;
      const dx = touch.clientX - lastLook.x;
      const dy = touch.clientY - lastLook.y;
      lastLook = { x: touch.clientX, y: touch.clientY };
      player.rotate(dx, dy);
    }
  });

  function endLook(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === lookTouchId) lookTouchId = null;
    }
  }
  lookZone.addEventListener('touchend', endLook);
  lookZone.addEventListener('touchcancel', endLook);

  // --- Boutons ---
  runBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    runBtn.classList.add('active');
    player.setRun(true);
  });
  runBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    runBtn.classList.remove('active');
    player.setRun(false);
  });

  jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jumpBtn.classList.add('active');
    player.jump();
  });
  jumpBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    jumpBtn.classList.remove('active');
  });

  webBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (player.isSwinging()) {
      player.releaseWeb();
      webBtn.classList.remove('active');
    } else {
      player.shootWeb();
      if (player.isSwinging()) webBtn.classList.add('active');
    }
  });

  zipBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    zipBtn.classList.add('active');
    if (player.isZipping()) {
      player.cancelZip(false);
    } else {
      player.zip();
    }
    setTimeout(() => zipBtn.classList.remove('active'), 150);
  });

  // La toile peut aussi se relâcher toute seule (atterrissage) : on garde le
  // bouton visuellement synchronisé avec l'état réel du joueur.
  function syncWebBtn() {
    if (!player.isSwinging()) webBtn.classList.remove('active');
    if (!player.isZipping()) zipBtn.classList.remove('active');
    requestAnimationFrame(syncWebBtn);
  }
  syncWebBtn();

  // --- Bascule pour le Mode Cardboard ---
  // En Mode Cardboard, tout passe par le hand tracking (voir combatControls.js
  // + handPointer.js) : on masque joystick/boutons tactiles pour éviter que
  // les deux systèmes de contrôle se marchent dessus, et on remet le vecteur
  // de déplacement à zéro pour ne pas laisser le joueur avancer tout seul.
  function setVisible(visible) {
    layer.style.display = visible ? '' : 'none';
    buttons.style.display = visible ? '' : 'none';
    if (!visible) {
      joystickTouchId = null;
      joystickBase.style.display = 'none';
      joystickKnob.style.display = 'none';
      player.setMoveVector(0, 0);
    }
  }

  return { setVisible };
}
