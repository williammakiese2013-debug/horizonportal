// handTracking.js
// Hand tracking MediaPipe (@mediapipe/tasks-vision), CAMÉRA ARRIÈRE.
//
// Adapté de taxi3d/src/hand.js (projet horizon-vr-portal-site), avec deux
// changements de fond pour ce jeu :
//   1. facingMode: 'environment' au lieu de 'user' — obligatoire ici car le
//      téléphone est logé dans le visualisateur Cardboard (écran + caméra
//      frontale contre le visage) : seule la caméra arrière peut encore voir
//      les mains levées devant le joueur.
//   2. Suivi de la VÉLOCITÉ RÉELLE du poing (pas seulement des gestes
//      statiques) : on garde un historique horodaté des positions du poignet
//      pour calculer un vecteur vitesse lissé, utilisé par combatControls.js
//      pour le coup de poing dynamique.
//
// NOTE IMPORTANTE (limite physique honnête) : MediaPipe ne donne que des
// coordonnées NORMALISÉES dans l'image caméra (x,y dans [0,1], z relatif,
// pas de mètres réels). On ne peut donc pas obtenir une "vraie" vitesse en
// m/s sans connaître la distance main-caméra et le FOV exact du capteur.
// CONFIG.HAND.VELOCITY_SCALE est un facteur de conversion empirique
// (unités normalisées/s → unités de jeu/s) — à recalibrer si besoin plutôt
// qu'un chiffre garanti physiquement exact.

import { CONFIG } from './config.js';

const LANDMARK_NAMES = [
  'wrist', 'thumb.cmc', 'thumb.mcp', 'thumb.ip', 'thumb.tip',
  'index.mcp', 'index.pip', 'index.dip', 'index.tip',
  'middle.mcp', 'middle.pip', 'middle.dip', 'middle.tip',
  'ring.mcp', 'ring.pip', 'ring.dip', 'ring.tip',
  'pinky.mcp', 'pinky.pip', 'pinky.dip', 'pinky.tip',
];

export const SKELETON_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

let handLandmarker = null;
let video = null;
let stream = null;
let enabled = false;
let detectionLoop = null;
let lastVideoTime = -1;

// Historique horodaté du poignet, utilisé pour la vélocité lissée.
// Chaque entrée : { t: performance.now()/1000, x, y, z }
const wristHistory = [];

const handState = {
  visible: false,
  landmarks: null,
  named: {},
  connections: SKELETON_CONNECTIONS,
  pinching: false,
  pointing: false,
  openPalm: false,
  fist: false,
  // Signe "Spider-Man" (index + auriculaire tendus, majeur + annulaire
  // repliés) : geste dédié au tir de toile, en plus du pinch.
  spiderSign: false,
  // Position de l'index (bout du doigt), en coordonnées NORMALISÉES image
  // (0..1), utilisée pour piloter un curseur virtuel à l'écran (tap tactile
  // via hand tracking, voir handPointer.js).
  indexTip: null,
  // Impulsion "tap" (vrai pendant une seule frame) : geste de poussée de
  // l'index vers la caméra, utilisé comme un clic/toucher virtuel.
  tap: false,
  // Vélocité 3D lissée du poignet, en unités de jeu/s (voir note ci-dessus).
  velocity: { x: 0, y: 0, z: 0, speed: 0 },
  // Squelettes de TOUTES les mains actuellement détectées (0 à 2 éléments,
  // chacun un tableau de 21 points {x,y,z}) — `landmarks` ci-dessus reste
  // la main ACTIVE (celle qui pilote pinch/pointing/tap, pour compatibilité
  // avec tout le code existant de combatControls.js) ; `hands` permet en
  // plus de dessiner les DEUX mains superposées quand les deux sont levées.
  hands: [],
};

// Historique du "span" (écartement poignet -> base du majeur), utilisé
// comme proxy visuel de la taille apparente de la main dans l'image pour
// détecter un geste de tap (voir note CONFIG.HAND.TAP_SPAN_GROWTH_THRESHOLD).
const spanHistory = [];
let lastTapTime = -999;

export function getHandState() {
  return handState;
}

// --- Pont externe (portail Horizon VR) ---------------------------------
// Quand ce jeu est chargé DANS une iframe du portail Horizon (voir
// window.openWebHero() / setupWebHeroBridge() côté portail), le hand
// tracking déjà actif là-bas (une seule caméra arrière disponible sur
// l'appareil) est réutilisé tel quel ici, au lieu de rouvrir notre propre
// caméra : le portail nous envoie son état de main via postMessage à
// chaque frame, et on l'applique directement à `handState`, lu ensuite
// sans changement par combatControls.js et handPointer.js.
let bridgeActive = false;

function isInIframe() {
  try { return window.top !== window.self; } catch (e) { return true; }
}

function applyExternalHandState(msg) {
  bridgeActive = true;
  handState.visible = !!msg.visible;
  handState.pinching = !!msg.pinching;
  handState.pointing = !!msg.pointing;
  handState.openPalm = !!msg.openPalm;
  handState.fist = !!msg.fist;
  handState.spiderSign = !!msg.spiderSign;
  handState.tap = !!msg.tap;
  handState.indexTip = msg.indexTip || null;
  // Le portail transmet désormais le squelette complet (21 points, déjà
  // recadrés "cover" comme la caméra — voir getBridgeLandmarks() côté
  // portail) : on peut donc dessiner un vrai squelette (chaque doigt +
  // chaque pliure), superposé à la bonne hauteur/distance, avec
  // drawSkeleton() ci-dessous, inchangé. Repli sur un unique point
  // "poignet" si le portail n'a pas encore de squelette lissé disponible
  // (ex : toute 1re frame juste après ouverture du pont).
  handState.landmarks = msg.landmarks && msg.landmarks.length === 21
    ? msg.landmarks
    : (msg.indexTip ? [{ x: msg.indexTip.x, y: msg.indexTip.y, z: 0 }] : null);
  handState.velocity = msg.velocity || { x: 0, y: 0, z: 0, speed: 0 };
  // Squelettes des 2 mains (si le portail en détecte plusieurs) — voir
  // getAllBridgeHands() côté portail. Repli sur [landmarks] (main active
  // seule) si le portail est une version plus ancienne sans ce champ.
  handState.hands = (Array.isArray(msg.allHands) && msg.allHands.length)
    ? msg.allHands
    : (handState.landmarks ? [handState.landmarks] : []);

  const hStatus = document.getElementById('hand-status');
  if (hStatus) {
    hStatus.style.display = 'block';
    hStatus.style.color = handState.visible ? '#37e0ff' : '#888';
    hStatus.textContent = handState.visible
      ? `🖐️ Pont Horizon actif (${handState.velocity.speed.toFixed(1)} u/s)`
      : '🖐️ Pont Horizon — main non détectée';
  }
}

window.addEventListener('message', (ev) => {
  const data = ev.data;
  if (!data || data.type !== 'horizon-hand-state') return;
  applyExternalHandState(data);
});

export function isExternallyBridged() {
  return bridgeActive;
}

export async function initHandTracking() {
  if (isInIframe()) {
    // On prévient le parent qu'on est prêt (utile pour réduire la latence
    // de la 1re trame, voir setupWebHeroBridge() côté portail), puis on
    // attend un court instant sa 1ère trame de hand tracking.
    try { window.parent.postMessage({ type: 'webhero-ready' }, '*'); } catch (e) {}

    const bridged = await new Promise((resolve) => {
      if (bridgeActive) { resolve(true); return; }
      const onMsg = (ev) => {
        if (ev.data && ev.data.type === 'horizon-hand-state') {
          window.removeEventListener('message', onMsg);
          resolve(true);
        }
      };
      window.addEventListener('message', onMsg);
      setTimeout(() => { window.removeEventListener('message', onMsg); resolve(false); }, 1500);
    });

    if (bridged) {
      enabled = true;
      // Le pont met à jour `handState` de façon asynchrone (postMessage),
      // mais rien ne redessinait jusqu'ici le squelette à l'écran dans ce
      // mode : on démarre donc ici la même boucle de rendu (rAF) que le
      // mode caméra locale, juste sans l'étape de détection MediaPipe
      // (déjà faite par le portail Horizon).
      const overlay = document.getElementById('hand-overlay');
      if (overlay) overlay.style.display = 'block';
      function bridgeRenderLoop() {
        drawOverlaySkeleton();
        detectionLoop = requestAnimationFrame(bridgeRenderLoop);
      }
      bridgeRenderLoop();
      console.log('[Hand] Suivi de la main délégué au portail Horizon (pont postMessage)');
      return true;
    }
    // Pas de pont détecté malgré l'iframe (ex : iframe générique hors du
    // portail Horizon) -> on retente quand même la caméra locale ci-dessous.
  }

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[Hand] getUserMedia indisponible');
      return false;
    }
    if (!document.createElement('canvas').getContext('webgl2')) {
      console.warn('[Hand] WebGL2 indisponible');
      return false;
    }

    const VERSION = '0.10.18';
    const visionSrc = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.js`;
    await loadScript(visionSrc);
    await waitForGlobal('FilesetResolver', 15000);
    await waitForGlobal('HandLandmarker', 15000);
    if (!window.FilesetResolver) return false;

    const wasmFs = await window.FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm/`
    );

    handLandmarker = await window.HandLandmarker.createFromOptions(wasmFs, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2, // les deux mains : la 1re (la plus stable) pilote le combat, la 2e est juste dessinée en plus
      minHandDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(video);

    // Caméra ARRIÈRE : voir la note en tête de fichier.
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: CONFIG.HAND.FACING_MODE,
        width: { ideal: CONFIG.HAND.VIDEO_WIDTH },
        height: { ideal: CONFIG.HAND.VIDEO_HEIGHT },
      },
    });
    video.srcObject = stream;
    await video.play();

    enabled = true;
    wristHistory.length = 0;

    const overlay = document.getElementById('hand-overlay');
    if (overlay) overlay.style.display = 'block';
    const hStatus = document.getElementById('hand-status');
    if (hStatus) hStatus.style.display = 'block';

    function detect() {
      if (!enabled || !handLandmarker || !video) return;
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const results = handLandmarker.detectForVideo(video, performance.now());
          updateHandState(results);
        } catch (e) {
          // on ignore les erreurs de détection ponctuelles (frame corrompue etc.)
        }
      }
      drawOverlaySkeleton();
      detectionLoop = requestAnimationFrame(detect);
    }
    detect();

    console.log('[Hand] Suivi de la main actif (caméra arrière)');
    return true;
  } catch (e) {
    console.warn('[Hand] Erreur d\'initialisation :', e);
    return false;
  }
}

export function stopHandTracking() {
  enabled = false;
  if (detectionLoop) { cancelAnimationFrame(detectionLoop); detectionLoop = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (video && video.parentNode) { video.parentNode.removeChild(video); video = null; }
  handLandmarker = null;
  handState.visible = false;
  handState.hands = [];
  wristHistory.length = 0;
  spanHistory.length = 0;
}

function updateHandState(results) {
  if (!results || !results.landmarks || results.landmarks.length === 0) {
    handState.visible = false;
    handState.landmarks = null;
    handState.hands = [];
    handState.indexTip = null;
    handState.tap = false;
    handState.velocity = { x: 0, y: 0, z: 0, speed: 0 };
    spanHistory.length = 0;
    return;
  }

  // Toutes les mains détectées (jusqu'à 2, voir numHands ci-dessus) sont
  // stockées pour l'affichage du squelette ; la PREMIÈRE (la plus stable
  // selon MediaPipe) reste la seule à piloter gestes/combat, exactement
  // comme avant quand une seule main était trackée.
  handState.hands = results.landmarks;

  const lm = results.landmarks[0];
  handState.visible = true;
  handState.landmarks = lm;

  const named = {};
  const raw = [];
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    const arr = [p.x, p.y, p.z];
    raw.push(arr);
    named[LANDMARK_NAMES[i]] = arr;
  }
  handState.named = named;
  handState.indexTip = { x: raw[8][0], y: raw[8][1] };

  detectGestures(raw);
  updateWristVelocity(raw[0]);
  updateTap(raw);
}

function detectGestures(raw) {
  const indexExtended = dist2D(raw[8], raw[5]) > 0.04;
  const middleExtended = dist2D(raw[12], raw[9]) > 0.04;
  const ringExtended = dist2D(raw[16], raw[13]) > 0.03;
  const pinkyExtended = dist2D(raw[20], raw[17]) > 0.03;
  const thumbExtended = dist2D(raw[4], raw[1]) > 0.04;

  const count = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

  // Poing fermé : déclenche le Mode Combat (voir combatControls.js).
  handState.fist = count === 0 && !thumbExtended;
  handState.openPalm = indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended;
  handState.pointing = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

  // Signe "Spider-Man" : index + auriculaire tendus, majeur + annulaire
  // repliés (le pouce peut être tendu ou non, on ne le contraint pas car
  // il varie beaucoup selon les gens qui font ce geste). Tir de toile.
  handState.spiderSign = indexExtended && pinkyExtended && !middleExtended && !ringExtended;

  // Pinch (index-pouce) : tir de toile (alternative au signe Spider-Man).
  const pinchDist = dist2D(raw[8], raw[4]);
  handState.pinching = pinchDist < 0.03;
}

// Détecte un "tap" (clic/toucher virtuel) via la croissance rapide de
// l'écartement poignet -> base du majeur, proxy d'un rapprochement brusque
// de la main vers la caméra (geste de poussée vers l'avant, comme appuyer
// un bouton dans le vide). Voir la note sur CONFIG.HAND.TAP_SPAN_GROWTH_THRESHOLD
// en tête de config.js : ce n'est pas une vraie mesure de profondeur.
function updateTap(raw) {
  handState.tap = false;

  const now = performance.now() / 1000;
  const span = dist2D(raw[0], raw[9]); // poignet -> base du majeur
  spanHistory.push({ t: now, span });
  while (spanHistory.length > 2 && now - spanHistory[0].t > 0.15) {
    spanHistory.shift();
  }
  if (spanHistory.length < 2) return;

  const first = spanHistory[0];
  const last = spanHistory[spanHistory.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0.001 || first.span <= 0.001) return;

  const growthRate = (last.span - first.span) / first.span / dt; // relatif, /s
  if (growthRate > CONFIG.HAND.TAP_SPAN_GROWTH_THRESHOLD && now - lastTapTime > CONFIG.HAND.TAP_DEBOUNCE) {
    handState.tap = true;
    lastTapTime = now;
    spanHistory.length = 0; // évite de redéclencher sur la même poussée
  }
}

// Historique glissant du poignet -> vecteur vitesse lissé (moyenne sur
// CONFIG.HAND.VELOCITY_SMOOTHING_WINDOW secondes), converti en unités de jeu.
function updateWristVelocity(wrist) {
  const now = performance.now() / 1000;
  wristHistory.push({ t: now, x: wrist[0], y: wrist[1], z: wrist[2] });

  const window_s = CONFIG.HAND.VELOCITY_SMOOTHING_WINDOW;
  while (wristHistory.length > 2 && now - wristHistory[0].t > window_s) {
    wristHistory.shift();
  }

  if (wristHistory.length < 2) {
    handState.velocity = { x: 0, y: 0, z: 0, speed: 0 };
    return;
  }

  const first = wristHistory[0];
  const last = wristHistory[wristHistory.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0.001) return; // pas assez de temps écoulé, on garde la valeur précédente

  const scale = CONFIG.HAND.VELOCITY_SCALE;
  // Note : y de l'image caméra grandit vers le bas -> on inverse pour que
  // "vers le haut" soit positif dans l'espace jeu.
  const vx = ((last.x - first.x) / dt) * scale;
  const vy = -((last.y - first.y) / dt) * scale;
  const vz = ((last.z - first.z) / dt) * scale;
  handState.velocity = { x: vx, y: vy, z: vz, speed: Math.sqrt(vx * vx + vy * vy + vz * vz) };
}

function dist2D(a, b) {
  if (!a || !b) return 999;
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function waitForGlobal(name, timeout) {
  return new Promise((resolve, reject) => {
    if (window[name]) return resolve();
    const start = Date.now();
    const check = () => {
      if (window[name]) return resolve();
      if (Date.now() - start > timeout) return reject(new Error(name + ' timeout'));
      setTimeout(check, 100);
    };
    check();
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function drawOverlaySkeleton() {
  const overlay = document.getElementById('hand-overlay');
  if (!overlay) return;
  const hStatus = document.getElementById('hand-status');
  if (hStatus) {
    const gestureLabel = handState.fist ? 'POING'
      : (handState.pinching || handState.spiderSign) ? '🕸 TOILE'
      : handState.pointing ? '☝️ AVANCE'
      : handState.openPalm ? '🖐 PILOTAGE'
      : 'ACTIF';
    hStatus.textContent = handState.visible
      ? `✋ ${gestureLabel} (${handState.velocity.speed.toFixed(1)} u/s)`
      : '✋ recherche...';
    hStatus.style.color = handState.visible ? '#0f0' : '#888';
  }
  if (!handState.visible) { overlay.style.display = 'none'; return; }
  overlay.style.display = 'block';
  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  const w = overlay.width = window.innerWidth;
  const h = overlay.height = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  drawSkeleton(ctx, w, h);
}

export function drawSkeleton(ctx, w, h) {
  if (!handState.visible) return;
  const handsList = (handState.hands && handState.hands.length) ? handState.hands : (handState.landmarks ? [handState.landmarks] : []);
  handsList.forEach((lm, i) => {
    if (!lm) return;
    // La main "active" (celle qui pilote pinch/tap/pointing, toujours
    // handsList[0]) est verte ; une éventuelle 2e main est cyan, pour
    // rester lisible visuellement quand les deux mains sont levées.
    const color = i === 0 ? (handState.fist ? '#ff4444' : '#00ff88') : '#37e0ff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const p1 = lm[a], p2 = lm[b];
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    }
    for (let j = 0; j < lm.length; j++) {
      const p = lm[j];
      ctx.fillStyle = j % 4 === 0 ? color : '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
