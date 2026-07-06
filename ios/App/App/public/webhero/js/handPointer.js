// handPointer.js
// Transforme le suivi de main (handTracking.js) en un pointeur tactile
// virtuel utilisable partout dans l'UI (mini-jeu de hacking, menus, boutons)
// pendant le Mode Cardboard : le bout de l'index sert de curseur affiché à
// l'écran, et un geste de "tap" (poussée de l'index vers la caméra, voir
// handState.tap dans handTracking.js) déclenche un clic à cet endroit —
// exactement comme un doigt qui touche une tablette.
//
// HYPOTHÈSE DE MAPPING (assumée, pas cachée) : la caméra utilisée est la
// caméra ARRIÈRE (non miroir), donc on projette directement
// x_écran = landmark.x * largeur, y_écran = landmark.y * hauteur, sans
// inversion horizontale (contrairement à une webcam frontale classique).

import { getHandState } from './handTracking.js';

function injectStyles() {
  if (document.getElementById('wh-hand-pointer-style')) return;
  const style = document.createElement('style');
  style.id = 'wh-hand-pointer-style';
  style.textContent = `
    #hand-pointer-cursor {
      position: fixed;
      top: 0; left: 0;
      width: 34px; height: 34px;
      margin: -17px 0 0 -17px;
      border-radius: 50%;
      border: 2px solid #7fe9ff;
      background: rgba(127, 233, 255, 0.18);
      box-shadow: 0 0 12px rgba(127, 233, 255, 0.55);
      pointer-events: none;
      z-index: 96;
      display: none;
      transition: transform 0.08s ease, background 0.08s ease;
    }
    #hand-pointer-cursor.tapping {
      transform: scale(0.7);
      background: rgba(127, 233, 255, 0.5);
    }
  `;
  document.head.appendChild(style);
}

export function createHandPointer() {
  injectStyles();

  const cursor = document.createElement('div');
  cursor.id = 'hand-pointer-cursor';
  document.body.appendChild(cursor);

  let active = false;

  function setActive(v) {
    active = v;
    if (!v) cursor.style.display = 'none';
  }

  function update() {
    if (!active) return;
    const hs = getHandState();

    if (!hs.visible || !hs.indexTip) {
      cursor.style.display = 'none';
      return;
    }

    const x = hs.indexTip.x * window.innerWidth;
    const y = hs.indexTip.y * window.innerHeight;
    cursor.style.display = 'block';
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;

    if (hs.tap) {
      cursor.classList.add('tapping');
      setTimeout(() => cursor.classList.remove('tapping'), 120);

      // "Toucher" l'élément sous le curseur, comme un tap sur une tablette :
      // ça déclenche naturellement les listeners 'click' déjà en place
      // (bouton VERROUILLER du hacking, boutons de menu, etc.).
      const el = document.elementFromPoint(x, y);
      if (el) el.click();
    }
  }

  return { setActive, update, isActive: () => active };
}
