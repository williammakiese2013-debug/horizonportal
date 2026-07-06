// main.js
// Étape 4/N : idem étape 3, + détection tactile et branchement des
// contrôles mobiles (joystick, regard au doigt, boutons saut/toile/courir).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createPostFxPass } from './postFxShader.js';
import { createScene, createCamera, createRenderer, addLights, createGround, handleResize } from './scene.js';
import { generateCity } from './city.js';
import { generateCars } from './cars.js';
import { createPlayer } from './player.js';
import { createMobileControls } from './mobileControls.js';
import { createDayNightCycle } from './dayNight.js';
import { createPuddles } from './puddles.js';
import { createUI } from './ui.js';
import { createNarrator } from './narrator.js';
import { createMissionManager } from './missionManager.js';
import { createPOIs } from './poi.js';
import { createHackingGame } from './hacking.js';
import { initHandTracking } from './handTracking.js';
import { createHandCombatMapper } from './combatControls.js';
import { createCardboardRenderer } from './stereoRenderer.js';
import { createHandPointer } from './handPointer.js';

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

const lights = addLights(scene, isTouchDevice);
createGround(scene);

const {
  buildingBoxes,
  buildingMeshes,
  streetCentersX,
  streetCentersZ,
  totalWidth,
  totalDepth,
  cityLights,
} = generateCity(scene);

// Lieux de mission (Central de Données, Docks) : créés avant le joueur pour
// que leurs structures fassent déjà partie de buildingMeshes/buildingBoxes
// (accroche de toile + collisions au sol) dès le premier frame.
const poi = createPOIs(scene, buildingBoxes, buildingMeshes, totalWidth, totalDepth);
const hacking = createHackingGame();

createPuddles(scene, buildingBoxes, totalWidth, totalDepth);
const dayNight = createDayNightCycle(scene, lights, cityLights);

const { update: updateCars } = generateCars(scene, streetCentersX, streetCentersZ, totalWidth, totalDepth);

const player = createPlayer(camera, renderer.domElement, buildingBoxes, buildingMeshes, scene, isTouchDevice);

// --- Mode Cardboard : hand tracking (caméra arrière) + rendu stéréo SBS ---
// Toutes les commandes (avancer, sauter, tir de toile, coup de poing, et le
// "tap" tactile pour le hacking/menus) passent par les gestes en Mode
// Cardboard — voir combatControls.js et handPointer.js.
//
// L'écran splitté (rendu stéréo) est actif EN PERMANENCE dès le lancement de
// l'application : il n'y a plus de bascule pour le désactiver. Le suivi de
// main (caméra arrière) est lancé dès le démarrage également ; s'il échoue
// (permissions refusées, pas de caméra...), le rendu stéréo reste quand même
// actif, seuls les gestes ne fonctionneront pas tant que la caméra n'est pas
// autorisée.
const handCombatMapper = createHandCombatMapper(player);
const handPointer = createHandPointer();
const cardboardRenderer = createCardboardRenderer(renderer, scene, camera);
const cardboardMode = true;
let mobileControlsHandle = null; // renseigné plus bas si isTouchDevice

// Le rendu stéréo (écran en deux) ne dépend d'aucune permission : il est
// actif dès cette ligne, sans attendre l'accès à la caméra.
handPointer.setActive(true);

async function startHandTrackingForCardboard() {
  const ok = await initHandTracking();
  const btn = document.getElementById('cardboardBtn');
  if (!ok) {
    btn?.classList.remove('active');
    alert('Suivi de la main indisponible (caméra arrière/permissions). L\'écran reste en mode stéréo, mais les gestes ne fonctionneront pas tant que l\'accès caméra n\'est pas autorisé — tu peux réessayer avec le bouton 🕶️.');
    return;
  }
  btn?.classList.add('active');
  showCardboardHint();
}

function showCardboardHint() {
  const hint = document.createElement('div');
  hint.textContent =
    '☝️ Index pointé vers l\'avant : avancer — 🖐 main levée d\'un coup sec : sauter — 🤟 signe Spider-Man (ou pincer) : tir de toile — ✊ poing : Mode Combat — pointe et pousse le doigt vers l\'écran pour "taper" (hacking/menus)';
  Object.assign(hint.style, {
    position: 'fixed', top: '12px', left: '12px', right: '12px',
    color: '#e5e7eb', fontFamily: 'system-ui, sans-serif', fontSize: '12px',
    background: 'rgba(10, 12, 18, 0.7)', padding: '10px 14px', borderRadius: '8px',
    pointerEvents: 'none', zIndex: '97', transition: 'opacity 0.6s ease',
  });
  document.body.appendChild(hint);
  setTimeout(() => {
    hint.style.opacity = '0';
    setTimeout(() => hint.remove(), 700);
  }, 6000);
}

// Lancement immédiat, dès le chargement du script (pas besoin de cliquer sur
// le bouton 🕶️ — il ne sert plus qu'à RÉESSAYER si la permission caméra a
// été refusée la première fois).
startHandTrackingForCardboard();

document.getElementById('cardboardBtn')?.addEventListener('click', () => {
  startHandTrackingForCardboard();
});

// Post-traitement : bloom sur les lumières vives (fenêtres, néons, soleil) +
// shader de finition (vignette / grain / aberration chromatique légère).
// Sur mobile on garde un bloom plus léger pour préserver les performances,
// mais on garde le shader de finition (peu coûteux) pour le rendu "poussé".
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  isTouchDevice ? 0.42 : 0.65, // force (un peu plus forte pour bien faire briller néons/fenêtres)
  0.4,   // rayon
  0.82   // seuil
);
composer.addPass(bloomPass);
const postFxPass = createPostFxPass();
composer.addPass(postFxPass);

handleResize(camera, renderer, composer);

const hud = document.getElementById('hud');

// --- Menu principal / choix du mode ---
const ui = createUI();
const narrator = createNarrator();
let gameStarted = false;
let storyMode = false;
let missionManager = null;

function beginGame(mode) {
  storyMode = mode === 'story';
  ui.hideMenu();
  gameStarted = true;

  if (!isTouchDevice) {
    player.controls.lock();
  }

  if (storyMode) {
    hud.style.display = 'none';
    ui.showStoryHud();
    if (isTouchDevice) ui.showAttackButton();
    missionManager = createMissionManager({
      scene,
      buildingBoxes,
      camera,
      player,
      ui,
      narrator,
      poi,
      hacking,
    });
    missionManager.start();
  }
}

ui.el.storyBtn.addEventListener('click', () => beginGame('story'));
ui.el.freeBtn.addEventListener('click', () => beginGame('free'));

ui.el.freeroamBtn.addEventListener('click', () => {
  ui.hideVictory();
  ui.hideStoryHud();
});
ui.el.menuBtn.addEventListener('click', () => {
  window.location.reload();
});

ui.el.attackBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  ui.el.attackBtn.classList.add('active');
  player.attack();
  setTimeout(() => ui.el.attackBtn.classList.remove('active'), 150);
});
ui.el.attackBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  ui.el.attackBtn.classList.add('active');
  player.attack();
  setTimeout(() => ui.el.attackBtn.classList.remove('active'), 150);
});

if (isTouchDevice) {
  // Sur mobile, pas de pointer lock : le HUD desktop est masqué,
  // les instructions tactiles s'affichent à la place (voir mobileControls.js).
  hud.style.display = 'none';
  mobileControlsHandle = createMobileControls(player);
  // Le Mode Cardboard (écran splitté + gestes) est permanent désormais : le
  // joystick/boutons tactiles ne servent plus à rien et sont masqués dès le
  // départ pour ne pas mélanger les deux systèmes de contrôle.
  mobileControlsHandle.setVisible(false);
} else {
  player.controls.addEventListener('lock', () => {
    hud.style.display = 'none';
  });
  player.controls.addEventListener('unlock', () => {
    hud.style.display = 'block';
  });

  // Bouton "Toile" pour se déplacer/swinguer sans avoir à maintenir le clic
  const webBtn = document.getElementById('webBtn');
  webBtn.style.display = 'flex';
  webBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!player.controls.isLocked) player.controls.lock();
    webBtn.classList.add('active');
    player.shootWeb();
  });
  webBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    webBtn.classList.remove('active');
    player.releaseWeb();
  });
  webBtn.addEventListener('mouseleave', () => {
    webBtn.classList.remove('active');
    player.releaseWeb();
  });

  // Bouton "Zip" (équivalent souple du clic droit) pour les joueurs qui
  // préfèrent cliquer plutôt que d'utiliser le bouton droit de la souris.
  const zipBtn = document.createElement('div');
  zipBtn.id = 'zipBtn';
  zipBtn.title = 'Zip (tir-grappin direct)';
  zipBtn.textContent = '⚡';
  Object.assign(zipBtn.style, {
    display: 'flex',
    position: 'fixed',
    right: '120px',
    bottom: '24px',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(20, 22, 30, 0.55)',
    border: '2px solid rgba(255, 255, 255, 0.4)',
    color: '#f4f4f4',
    fontSize: '26px',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    zIndex: '30',
    cursor: 'pointer',
  });
  document.body.appendChild(zipBtn);
  zipBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!player.controls.isLocked) player.controls.lock();
    zipBtn.style.background = 'rgba(55, 224, 255, 0.4)';
    player.zip();
    setTimeout(() => { zipBtn.style.background = 'rgba(20, 22, 30, 0.55)'; }, 150);
  });
}

let lastTime = performance.now();
const crosshair = document.getElementById('crosshair');

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (gameStarted) {
    player.update(delta);
    if (storyMode && missionManager) missionManager.update(delta);

    // Retour visuel du réticule : s'allume quand un point d'accroche valide
    // est disponible dans l'axe du regard (assistance de visée de la toile).
    if (crosshair && !isTouchDevice && player.controls.isLocked) {
      crosshair.classList.toggle('can-anchor', player.hasValidAnchorAhead());
    }

    // Mapping hand tracking -> actions du joueur (avancer, sauter, toile,
    // poing/coup à vélocité dynamique). Actif uniquement en Mode Cardboard.
    if (cardboardMode) handCombatMapper.update(delta);
  }

  // Curseur/tap virtuel : actif dès le Mode Cardboard activé, même avant le
  // début de la partie (pour pouvoir taper les boutons du menu à la main).
  if (cardboardMode) handPointer.update();

  updateCars(delta);
  dayNight.update(delta, camera.position);
  postFxPass.uniforms.time.value = now / 1000;

  // En Mode Cardboard, on bascule sur le rendu stéréo SBS + distorsion en
  // barillet (dual PerspectiveCamera + shader de post-traitement dédié) au
  // lieu du composer bloom/postfx habituel : la stéréoscopie a besoin de
  // deux passes de rendu brutes vers ses propres render targets, ce que
  // l'EffectComposer mono-caméra ne gère pas nativement. Compromis assumé :
  // pas de bloom pendant le Mode Cardboard pour l'instant.
  if (cardboardMode) {
    cardboardRenderer.render();
  } else {
    composer.render();
  }
}

animate();
