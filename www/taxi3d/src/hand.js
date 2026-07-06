// MediaPipe Hand Tracking — squelette complet 21 landmarks
// Utilise @mediapipe/tasks-vision (WASM, GPU delegate)

let handLandmarker = null;
let lastVideoTime = -1;
let lastResults = null;
let video = null;
let stream = null;
let enabled = false;
let detectionLoop = null;

// Noms des articulations
const LANDMARK_NAMES = [
  'wrist',           // 0
  'thumb.cmc',       // 1
  'thumb.mcp',       // 2
  'thumb.ip',        // 3
  'thumb.tip',       // 4
  'index.mcp',       // 5
  'index.pip',       // 6
  'index.dip',       // 7
  'index.tip',       // 8
  'middle.mcp',      // 9
  'middle.pip',      // 10
  'middle.dip',      // 11
  'middle.tip',      // 12
  'ring.mcp',        // 13
  'ring.pip',        // 14
  'ring.dip',        // 15
  'ring.tip',        // 16
  'pinky.mcp',       // 17
  'pinky.pip',       // 18
  'pinky.dip',       // 19
  'pinky.tip',       // 20
];

// Connexions pour le dessin du squelette
export const SKELETON_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],           // thumb
  [0,5],[5,6],[6,7],[7,8],           // index
  [0,9],[9,10],[10,11],[11,12],      // middle
  [0,13],[13,14],[14,15],[15,16],    // ring
  [0,17],[17,18],[18,19],[19,20],    // pinky
  [5,9],[9,13],[13,17],              // palm
];

// État exposé globalement
const handState = {
  visible: false,
  landmarks: null,    // raw array [{x,y,z}] — main "active" (pilote la conduite)
  hands: [],          // TOUTES les mains détectées (jusqu'à 2), pour le squelette dessiné
  named: {},          // nom → [x,y,z]
  connections: SKELETON_CONNECTIONS,
  // Gestes
  pinching: false,
  pointing: false,
  openPalm: false,
  fist: false,
  thumbsUp: false,
  peaceSign: false,
  highFive: false,
  extendedCount: 0,
  // Versions normalisées pour le contrôle
  steerX: 0,   // -1..1
  steerY: 0,   // -1..1
  gas: 0,      // 0..1
};

export function getHandState() { return handState; }

export async function initHandTracking() {
  try {
    // Vérifier disponibilité WebGL2 et getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[Hand] getUserMedia non disponible');
      return false;
    }
    if (!document.createElement('canvas').getContext('webgl2')) {
      console.warn('[Hand] WebGL2 non disponible');
      return false;
    }

    // Charger la vision WASM bundle
    const VERSION = '0.10.18';
    const visionSrc = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.js`;
    await loadScript(visionSrc);
    console.log('[Hand] Vision bundle loaded');

    // Attendre que les globaux soient disponibles
    await waitForGlobal('FilesetResolver', 15000);
    await waitForGlobal('HandLandmarker', 15000);

    if (!window.FilesetResolver) {
      console.warn('[Hand] FilesetResolver non trouvé');
      return false;
    }

    const wasmFs = await window.FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm/`
    );
    console.log('[Hand] WASM fileset loaded');

    handLandmarker = await window.HandLandmarker.createFromOptions(wasmFs, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    console.log('[Hand] HandLandmarker initialized');

    // Camera
    video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(video);

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    video.srcObject = stream;
    await video.play();

    enabled = true;
    lastResults = null;

    // Afficher l'overlay squelette
    const overlay = document.getElementById('hand-overlay');
    if (overlay) overlay.style.display = 'block';
    const hStatus = document.getElementById('hand-status');
    if (hStatus) hStatus.style.display = 'block';

    // Boucle de détection
    function detect() {
      if (!enabled || !handLandmarker || !video) return;
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          lastResults = handLandmarker.detectForVideo(video, performance.now());
          updateHandState(lastResults);
        } catch (e) {
          // ignore detection errors
        }
      }
      // Dessiner le squelette
      drawOverlaySkeleton();
      detectionLoop = requestAnimationFrame(detect);
    }
    detect();

    console.log('[Hand] Hand tracking actif');
    return true;
  } catch (e) {
    console.warn('[Hand] Erreur initialisation:', e);
    return false;
  }
}

export function stopHandTracking() {
  enabled = false;
  if (detectionLoop) { cancelAnimationFrame(detectionLoop); detectionLoop = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (video && video.parentNode) { video.parentNode.removeChild(video); video = null; }
  handLandmarker = null;
  lastResults = null;
  handState.visible = false;
  handState.hands = [];
}

function updateHandState(results) {
  if (!results || !results.landmarks || results.landmarks.length === 0) {
    handState.visible = false;
    handState.landmarks = null;
    handState.hands = [];
    return;
  }

  // Toutes les mains détectées (jusqu'à 2, numHands:2 déjà configuré plus
  // haut) sont conservées pour le dessin du squelette ; la première reste
  // la seule à piloter les gestes/volant, comme avant.
  handState.hands = results.landmarks;

  // On prend la première main détectée
  const lm = results.landmarks[0];
  handState.visible = true;
  handState.landmarks = lm;

  // Remplir les formes nommées
  const named = {};
  const raw = [];
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    const arr = [p.x, p.y, p.z];
    raw.push(arr);
    named[LANDMARK_NAMES[i]] = arr;
  }
  handState.named = named;

  // Gestes
  detectGestures(lm, named, raw);
}

function detectGestures(lm, named, raw) {
  const tip   = i => raw[i];
  const pip   = i => raw[i];
  const mcp   = i => raw[i];
  const wrist = raw[0];

  // Hauteur relative du poignet (pour savoir si la main est en position de conduite)
  const wristY = wrist[1];
  const wristX = wrist[0];

  // Distance index tip - index mcp (étendu ?)
  const indexExtended = dist2D(raw[8], raw[5]) > 0.04;
  const middleExtended = dist2D(raw[12], raw[9]) > 0.04;
  const ringExtended = dist2D(raw[16], raw[13]) > 0.03;
  const pinkyExtended = dist2D(raw[20], raw[17]) > 0.03;

  // Pouce: vérifier si le tip est loin de la paume
  const thumbExtended = dist2D(raw[4], raw[1]) > 0.04;

  // Compter doigts étendus (sans le pouce)
  let count = 0;
  if (indexExtended) count++;
  if (middleExtended) count++;
  if (ringExtended) count++;
  if (pinkyExtended) count++;
  handState.extendedCount = count;

  // Fist: aucun doigt étendu + pouce replié
  handState.fist = count === 0 && !thumbExtended;

  // Open palm: tous les doigts étendus
  handState.openPalm = indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended;

  // Pointing: seul l'index est étendu
  handState.pointing = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

  // Peace sign: index + middle étendus, autres repliés
  handState.peaceSign = indexExtended && middleExtended && !ringExtended && !pinkyExtended;

  // High five (5 doigts ouverts): comme open palm mais spécifique
  handState.highFive = count >= 4 && thumbExtended;

  // Thumbs up: pouce étendu, autres repliés, main pas à l'envers
  handState.thumbsUp = count === 0 && thumbExtended;

  // Pinch: index tip proche du thumb tip
  const pinchDist = dist2D(raw[8], raw[4]);
  handState.pinching = pinchDist < 0.03;

  // --- Contrôles de conduite ---
  // Position des deux mains pour le volant
  // Si 2 mains détectées, utiliser la moyenne
  if (results && results.landmarks && results.landmarks.length >= 2) {
    const lm2 = results.landmarks[1];
    const w2 = [lm2[0].x, lm2[0].y, lm2[0].z];
    const avgX = (wrist[0] + w2[0]) / 2;
    // Steer X: -1 (tourné à gauche) à +1 (tourné à droite)
    handState.steerX = Math.max(-1, Math.min(1, (avgX - 0.5) * 3));
    // Gas: basé sur la hauteur moyenne des mains (plus hautes = moins de gaz)
    const avgY = (wrist[1] + w2[1]) / 2;
    handState.steerY = Math.max(-1, Math.min(1, (0.5 - avgY) * 4));
    // Gas: si les mains sont en position basse (volant)
    if (avgY > 0.3 && avgY < 0.8) {
      handState.gas = Math.max(0, Math.min(1, (0.7 - avgY) * 2.5));
    } else {
      handState.gas = 0;
    }
  } else {
    // Une seule main détectée
    handState.steerX = Math.max(-1, Math.min(1, (wrist[0] - 0.5) * 3));
    handState.steerY = Math.max(-1, Math.min(1, (0.5 - wrist[1]) * 4));
    if (wrist[1] > 0.3 && wrist[1] < 0.8) {
      handState.gas = Math.max(0, Math.min(1, (0.7 - wrist[1]) * 2.5));
    } else {
      handState.gas = 0;
    }
  }

  // Exposer globalement pour compatibilité
  window._mrfHand = {
    handVisible: handState.visible,
    wrist: raw[0],
    indexTip: raw[8],
    thumbTip: raw[4],
    middleTip: raw[12],
    pinching: handState.pinching,
    pointing: handState.pointing,
    openPalm: handState.openPalm,
    fist: handState.fist,
    thumbsUp: handState.thumbsUp,
    peaceSign: handState.peaceSign,
    highFive: handState.highFive,
    extendedCount: handState.extendedCount,
    getLandmark: (i) => raw[i] || null,
  };
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
  // Status indicator
  const hStatus = document.getElementById('hand-status');
  if (hStatus) {
    hStatus.textContent = handState.visible ? '✋ ACTIF' : '✋';
    hStatus.style.color = handState.visible ? '#0f0' : '#666';
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

// Dessiner le squelette sur un canvas (pour overlay debug)
export function drawSkeleton(ctx, w, h) {
  if (!handState.visible) return;
  const connections = SKELETON_CONNECTIONS;
  const handsList = (handState.hands && handState.hands.length) ? handState.hands : (handState.landmarks ? [handState.landmarks] : []);

  handsList.forEach((lm, idx) => {
    if (!lm) return;
    // Main active (celle qui pilote) en vert, 2e main (si levée) en cyan.
    const color = idx === 0 ? '#00ff88' : '#37e0ff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const [i, j] of connections) {
      const p1 = lm[i], p2 = lm[j];
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    }

    for (let i = 0; i < lm.length; i++) {
      const p = lm[i];
      ctx.fillStyle = i % 4 === 0 ? color : '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
