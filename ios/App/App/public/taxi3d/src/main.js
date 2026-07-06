import { initRenderer, resize, render, getCamera, getScene } from './renderer.js';
import { buildCar, updateCarPhysics, getCarState, cycleAmbientColor, getAmbientColorIdx } from './car.js';
import { initWorld } from './world.js';
import { initSky, updateSky } from './sky.js';
import { initControls, getControls, updateHandControls } from './controls.js';
import { initHUD, updateHUD } from './hud.js';
import { initAudio, updateAudio } from './audio.js';
import { initHandTracking, getHandState } from './hand.js';

const TX = window.TX = {
  canvas: document.getElementById('game-canvas'),
  money: 0,
  passengers: 0,
  totalKm: 0,
  time: 0.4,
  paused: false,
  viewMode: 'interior',
  running: false,
  handTrackingReady: false,
};

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}
window.toast = toast;

async function init() {
  initRenderer(TX.canvas);
  initWorld();
  buildCar();
  initSky();
  initControls();
  initHUD();
  initAudio();

  // Hide loading
  const loadEl = document.getElementById('loading');
  if (loadEl) loadEl.style.display = 'none';

  // Démarrer hand tracking (asynchrone, ne bloque pas le jeu)
  initHandTracking().then(ok => {
    TX.handTrackingReady = ok;
    if (ok) toast('✋ Mains détectées ! Volant virtuel actif');
    else toast('📱 Contrôles tactiles (hand tracking non disponible)');
  }).catch(() => {
    toast('📱 Contrôles tactiles');
  });

  TX.lastTime = performance.now();
  TX.running = true;
  requestAnimationFrame(loop);
  window.addEventListener('resize', resize);
  setTimeout(() => toast('🚕 Gauche:volant | Droite:pédales | Client: cercle jaune'), 1000);
}

function loop(ts) {
  if (!TX.running) return;
  const dt = Math.min(0.05, (ts - TX.lastTime) / 1000);
  TX.lastTime = ts;

  TX.time = (TX.time + dt / 120) % 1;

  // Hand tracking controls
  updateHandControls(dt);

  const ctrl = getControls();
  if (ctrl.colorCycle) {
    ctrl.colorCycle = false;
    const color = cycleAmbientColor(1);
    const names = ['Orange', 'Bleu', 'Vert', 'Rose', 'Violet', 'Cyan', 'Rouge', 'Blanc', 'Éteint'];
    const idx = getAmbientColorIdx();
    if (idx < names.length) toast('💡 LED: ' + names[idx]);
  }

  // Physics
  updateCarPhysics(dt, ctrl);

  // Camera
  updateCamera(getControls());

  // Sky
  updateSky(dt);

  // Passengers
  updatePassengers(dt, getCarState());

  // HUD
  updateHUD(getCarState());

  // Audio
  updateAudio(getCarState());

  // Render
  render();

  requestAnimationFrame(loop);
}

let cameraSmooth = { x: 0, y: 1.2, z: 0 };

function updateCamera(controls) {
  const cam = getCamera();
  const cs = getCarState();
  if (!cam || !cs) return;

  if (controls.viewToggle) {
    const modes = ['interior', 'hood', 'exterior'];
    const idx = modes.indexOf(TX.viewMode);
    TX.viewMode = modes[(idx + 1) % modes.length];
    controls.viewToggle = false;
  }

  const target = cs.pos;
  const yaw = cs.yaw;
  const s = Math.sin(yaw), c = Math.cos(yaw);

  let tx, ty, tz;
  if (TX.viewMode === 'interior') {
    tx = target.x + s * 0.1 + c * 0.35;
    ty = target.y + 1.15;
    tz = target.z + c * 0.1 - s * 0.35;
  } else if (TX.viewMode === 'hood') {
    tx = target.x - s * 0.05;
    ty = target.y + 0.8;
    tz = target.z - c * 0.05;
  } else {
    const dist = 4, height = 2.5;
    tx = target.x + s * dist;
    ty = target.y + height;
    tz = target.z + c * dist;
  }

  cameraSmooth.x += (tx - cameraSmooth.x) * 5 * 0.016;
  cameraSmooth.y += (ty - cameraSmooth.y) * 5 * 0.016;
  cameraSmooth.z += (tz - cameraSmooth.z) * 5 * 0.016;

  cam.position.set(cameraSmooth.x, cameraSmooth.y, cameraSmooth.z);

  if (TX.viewMode === 'exterior') {
    cam.lookAt(target.x, target.y + 0.5, target.z);
  } else {
    cam.lookAt(target.x - s * 5, target.y + 0.8, target.z - c * 5);
  }
}

// === PASSENGER SYSTEM ===
let passenger = null;
let destMarker = null;
let pickupTimer = 0;

function spawnPassenger() {
  const T = THREE;
  const cs = getCarState();
  if (!cs) return;
  const angle = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * 40;
  const px = cs.pos.x + Math.cos(angle) * dist;
  const pz = cs.pos.z + Math.sin(angle) * dist;

  passenger = { pos: new T.Vector3(px, 0, pz), active: true, destination: null };

  // Clear old marker
  if (destMarker) { getScene().remove(destMarker); destMarker.geometry.dispose(); destMarker.material.dispose(); destMarker = null; }

  // Passenger marker (pulsing yellow ring)
  const ringGeo = new T.RingGeometry(0.5, 0.8, 24);
  const ringMat = new T.MeshBasicMaterial({ color: 0xffdd44, side: T.DoubleSide, transparent: true, opacity: 0.7 });
  destMarker = new T.Mesh(ringGeo, ringMat);
  destMarker.rotation.x = -Math.PI / 2;
  destMarker.position.set(px, 0.02, pz);
  getScene().add(destMarker);

  // Destination
  const da = Math.random() * Math.PI * 2;
  const dd = 15 + Math.random() * 30;
  passenger.destination = new T.Vector3(px + Math.cos(da) * dd, 0, pz + Math.sin(da) * dd);
}

function updatePassengers(dt, cs) {
  const T = THREE;
  const scene = getScene();
  if (!scene || !cs) return;

  if (!passenger) {
    pickupTimer += dt;
    if (pickupTimer > 8 + Math.random() * 7) {
      pickupTimer = 0;
      spawnPassenger();
    }
    return;
  }

  // Pulse marker
  if (destMarker && destMarker.material) {
    destMarker.material.opacity = 0.5 + Math.sin(performance.now() * 0.003) * 0.3;
    destMarker.scale.setScalar(1 + Math.sin(performance.now() * 0.002) * 0.1);
  }

  if (passenger.active) {
    const dx = cs.pos.x - passenger.pos.x;
    const dz = cs.pos.z - passenger.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3 && cs.speed < 1) {
      passenger.active = false;
      TX.passengers++;
      toast('✅ Client embarqué ! Suivez le cercle vert.');
      if (destMarker) {
        destMarker.material.color.setHex(0x44ff88);
        destMarker.position.set(passenger.destination.x, 0.02, passenger.destination.z);
      }
    }
  } else if (passenger.destination) {
    const dx = cs.pos.x - passenger.destination.x;
    const dz = cs.pos.z - passenger.destination.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3 && cs.speed < 1) {
      const fare = 5 + Math.floor(Math.random() * 15);
      TX.money += fare;
      TX.passengers--;
      toast('💰 Course terminée ! +$' + fare);
      if (destMarker) { scene.remove(destMarker); destMarker.geometry.dispose(); destMarker.material.dispose(); destMarker = null; }
      passenger = null;
      pickupTimer = 0;
    }
  }
}

init();
