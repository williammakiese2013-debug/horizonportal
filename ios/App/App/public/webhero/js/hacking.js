// hacking.js
// Mini-jeu de piratage utilisé pendant les quêtes d'infiltration : au lieu
// de combattre, le joueur doit "verrouiller" un signal qui oscille sur une
// barre, plusieurs fois de suite, avant la fin du temps imparti. Jouable
// au clavier/souris (Espace ou clic) comme au tactile (bouton).

import { CONFIG } from './config.js';

function injectStyles() {
  if (document.getElementById('wh-hack-style')) return;
  const style = document.createElement('style');
  style.id = 'wh-hack-style';
  style.textContent = `
    .wh-hack-overlay {
      position: fixed; inset: 0; z-index: 95;
      display: none; align-items: center; justify-content: center;
      background: rgba(4,6,10,0.82); font-family: system-ui, sans-serif; color: #f4f4f4;
    }
    .wh-hack-panel {
      width: min(520px, 90vw);
      background: rgba(10,14,20,0.9);
      border: 1px solid rgba(55,224,255,0.4);
      border-radius: 12px;
      padding: 24px 26px;
      box-shadow: 0 0 40px rgba(55,224,255,0.15);
    }
    .wh-hack-title { font-size: 15px; font-weight: 700; letter-spacing: 1px; color: #7fe9ff; margin-bottom: 4px; text-transform: uppercase; }
    .wh-hack-sub { font-size: 12px; color: #9fb0bb; margin-bottom: 18px; }
    .wh-hack-track {
      position: relative;
      height: 14px;
      border-radius: 7px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      margin-bottom: 20px;
      overflow: hidden;
    }
    .wh-hack-zone {
      position: absolute; top: 0; bottom: 0;
      background: rgba(74,222,128,0.45);
      border-left: 2px solid #4ade80; border-right: 2px solid #4ade80;
    }
    .wh-hack-marker {
      position: absolute; top: -3px; bottom: -3px; width: 4px;
      background: #ffffff; box-shadow: 0 0 8px #fff;
    }
    .wh-hack-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .wh-hack-progress { font-size: 12px; color: #c9ccd3; }
    .wh-hack-lock {
      cursor: pointer;
      background: rgba(55,224,255,0.25);
      border: 2px solid rgba(55,224,255,0.6);
      color: #fff; font-weight: 700; letter-spacing: 1px;
      padding: 10px 22px; border-radius: 8px; user-select: none;
    }
    .wh-hack-lock:active { background: rgba(55,224,255,0.5); }
    .wh-hack-misses { font-size: 12px; color: #ff8a8a; margin-top: 10px; }
    .wh-hack-timer { font-size: 12px; color: #ffcf8a; }
  `;
  document.head.appendChild(style);
}

export function createHackingGame() {
  injectStyles();

  const overlay = document.createElement('div');
  overlay.className = 'wh-hack-overlay';
  overlay.innerHTML = `
    <div class="wh-hack-panel">
      <div class="wh-hack-title">Intrusion réseau</div>
      <div class="wh-hack-sub">Verrouille le signal (Espace / clic) quand le curseur traverse la zone verte.</div>
      <div class="wh-hack-track"><div class="wh-hack-zone" id="wh-hack-zone"></div><div class="wh-hack-marker" id="wh-hack-marker"></div></div>
      <div class="wh-hack-row">
        <span class="wh-hack-progress" id="wh-hack-progress">Nœud 1 / ${CONFIG.HACK_NODE_COUNT}</span>
        <span class="wh-hack-timer" id="wh-hack-timer"></span>
        <div class="wh-hack-lock" id="wh-hack-lock">VERROUILLER</div>
      </div>
      <div class="wh-hack-misses" id="wh-hack-misses"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const el = {
    zone: overlay.querySelector('#wh-hack-zone'),
    marker: overlay.querySelector('#wh-hack-marker'),
    progress: overlay.querySelector('#wh-hack-progress'),
    timer: overlay.querySelector('#wh-hack-timer'),
    lock: overlay.querySelector('#wh-hack-lock'),
    misses: overlay.querySelector('#wh-hack-misses'),
  };

  let running = false;
  let node = 0;
  let misses = 0;
  let pos = 0; // 0..100
  let dir = 1;
  let speed = 55; // %/s, augmente à chaque nœud
  let zoneStart = 40;
  let zoneWidth = 20;
  let timeLeft = CONFIG.HACK_TIME_PER_NODE;
  let rafId = null;
  let lastT = 0;
  let doneCallback = null;

  function newNode() {
    zoneWidth = Math.max(10, 20 - node * 2);
    zoneStart = 5 + Math.random() * (95 - zoneWidth - 5);
    speed = 45 + node * 12;
    pos = Math.random() * 100;
    dir = Math.random() > 0.5 ? 1 : -1;
    timeLeft = CONFIG.HACK_TIME_PER_NODE;
    el.zone.style.left = zoneStart + '%';
    el.zone.style.width = zoneWidth + '%';
    el.progress.textContent = `Nœud ${node + 1} / ${CONFIG.HACK_NODE_COUNT}`;
    el.misses.textContent = misses > 0 ? `Échecs : ${misses} / ${CONFIG.HACK_MAX_MISSES}` : '';
  }

  function finish(success) {
    running = false;
    cancelAnimationFrame(rafId);
    overlay.style.display = 'none';
    document.removeEventListener('keydown', onKey);
    if (doneCallback) doneCallback(success);
  }

  function attemptLock() {
    if (!running) return;
    if (pos >= zoneStart && pos <= zoneStart + zoneWidth) {
      node++;
      if (node >= CONFIG.HACK_NODE_COUNT) {
        finish(true);
        return;
      }
      newNode();
    } else {
      misses++;
      el.misses.textContent = `Échecs : ${misses} / ${CONFIG.HACK_MAX_MISSES}`;
      if (misses >= CONFIG.HACK_MAX_MISSES) {
        finish(false);
      }
    }
  }

  function onKey(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      attemptLock();
    } else if (e.code === 'Escape') {
      finish(false);
    }
  }

  el.lock.addEventListener('click', attemptLock);
  el.lock.addEventListener('touchstart', (e) => { e.preventDefault(); attemptLock(); });

  function tick(now) {
    if (!running) return;
    const delta = lastT ? Math.min((now - lastT) / 1000, 0.1) : 0;
    lastT = now;

    pos += dir * speed * delta;
    if (pos > 100) { pos = 100; dir = -1; }
    if (pos < 0) { pos = 0; dir = 1; }
    el.marker.style.left = pos + '%';

    timeLeft -= delta;
    el.timer.textContent = Math.max(0, timeLeft).toFixed(1) + 's';
    if (timeLeft <= 0) {
      misses++;
      el.misses.textContent = `Échecs : ${misses} / ${CONFIG.HACK_MAX_MISSES}`;
      if (misses >= CONFIG.HACK_MAX_MISSES) {
        finish(false);
        return;
      }
      newNode();
    }

    rafId = requestAnimationFrame(tick);
  }

  function start(onDone) {
    doneCallback = onDone;
    node = 0;
    misses = 0;
    running = true;
    lastT = 0;
    overlay.style.display = 'flex';
    newNode();
    document.addEventListener('keydown', onKey);
    rafId = requestAnimationFrame(tick);
  }

  return { start, isRunning: () => running };
}
