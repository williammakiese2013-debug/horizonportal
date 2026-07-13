/* ============================================================
   ZOOM / REDIMENSIONNEMENT — Pinch sur une poignée de coin
   ============================================================
   Logique totalement ISOLÉE du Drag & Drop (handGrab) : elle ne
   s'active que si le pinch démarre sur une poignée `.app-win-pinchzoom`
   (coins inférieurs de la fenêtre). Tant que `handScale.active` est
   vrai, updateHandGrab() n'est pas appelée (voir detectLoop), donc
   aucun conflit possible entre les deux gestes.
   Le facteur d'échelle est calculé à partir de la distance entre la
   main et le CENTRE de la fenêtre : main qui s'éloigne => agrandit,
   main qui se rapproche => rétrécit. Bornes strictes [0.5, 2.5].
*/
const HAND_SCALE_MIN = 0.5;
const HAND_SCALE_MAX = 2.5;

const handScale = {
  active: false,      // true tant que le pinch de zoom est maintenu
  centerX: 0,          // centre de la fenêtre (page px) au moment du grab
  centerY: 0,
  startDist: 0,          // distance main <-> centre au moment du grab
  startScale: 1            // échelle de la fenêtre au moment du grab
};

/* Applique state.windowScale (figé) à la fenêtre affichée sur les deux
   yeux. Appelée en continu depuis ensureZoomHandles() pour survivre aux
   re-rendus de renderHUD() (qui recrée #appWinEl via innerHTML). */
function applyWindowScaleTransform(){
  for(const side of ['L','R']){
    const wc = document.getElementById('appWindowCenter'+side);
    const el = wc ? wc.querySelector('#appWinEl') : null;
    if(el) el.style.transform = `scale(${state.windowScale.toFixed(3)})`;
  }
}

/* S'assure que les poignées de zoom (coins inférieurs) existent sur la
   fenêtre courante, et réapplique l'échelle figée à chaque frame — car
   #appWinEl est recréé par innerHTML à chaque renderHUD(). */
function ensureZoomHandles(){
  for(const side of ['L','R']){
    const wc = document.getElementById('appWindowCenter'+side);
    const el = wc ? wc.querySelector('#appWinEl') : null;
    if(!el) continue;
    if(!el.style.transformOrigin) el.style.transformOrigin = 'center center';
    if(!el.querySelector('.app-win-pinchzoom')){
      const br = document.createElement('div');
      br.className = 'app-win-pinchzoom app-win-pinchzoom-br';
      br.title = 'Pincez pour zoomer / dézoomer';
      br.textContent = '⤡';
      const bl = document.createElement('div');
      bl.className = 'app-win-pinchzoom app-win-pinchzoom-bl';
      bl.title = 'Pincez pour zoomer / dézoomer';
      bl.textContent = '⤢';
      el.appendChild(br);
      el.appendChild(bl);
    }
    const armed = handScale.active;
    el.querySelectorAll('.app-win-pinchzoom').forEach(h => h.classList.toggle('zoom-armed', armed));
  }
  applyWindowScaleTransform();
}

/* Point d'entrée appelé depuis detectLoop() à chaque frame où une main
   est détectée. Gère les 3 phases : début / maintien / fin — même
   structure que updateHandGrab(), pour rester isolée et cohérente. */
function updateHandScale(pinching, wasPinching, handScreen){
  if(!handScreen) return;

  /* --- 1. DÉBUT (Zoom) : le pinch démarre sur une poignée de coin --- */
  if(pinching && !wasPinching){
    const stack = document.elementsFromPoint(handScreen.pageX, handScreen.pageY);
    const zoomTarget = stack.find(n => n instanceof HTMLElement &&
      n.classList.contains('app-win-pinchzoom'));

    if(zoomTarget){
      const wc = document.getElementById('appWindowCenterL');
      const el = wc ? wc.querySelector('#appWinEl') : null;
      if(el){
        const r = el.getBoundingClientRect();
        handScale.centerX = r.left + r.width / 2;
        handScale.centerY = r.top + r.height / 2;
        // Distance de référence (main <-> centre fenêtre) au moment du pinch.
        // Le clamp à 20px évite une division par une valeur ~0 si le pinch
        // démarre exactement sur le centre.
        handScale.startDist = Math.max(20, Math.hypot(
          handScreen.pageX - handScale.centerX,
          handScreen.pageY - handScale.centerY));
        handScale.startScale = state.windowScale;
        handScale.active = true;
        if(typeof playAppleHover === 'function') playAppleHover();
      }
      return; // pas de clic instantané classique sur cette poignée
    }
  }

  /* --- 2. AJUSTEMENT EN TEMPS RÉEL --- */
  if(handScale.active && pinching){
    const dist = Math.hypot(
      handScreen.pageX - handScale.centerX,
      handScreen.pageY - handScale.centerY);
    const ratio = dist / handScale.startDist;
    const rawScale = handScale.startScale * ratio;
    // CONTRAINTE CRITIQUE : bornes strictes pour éviter une fenêtre
    // minuscule ou gigantesque.
    state.windowScale = Math.max(HAND_SCALE_MIN, Math.min(HAND_SCALE_MAX, rawScale));
    applyWindowScaleTransform();
    return;
  }

  /* --- 3. RELÂCHEMENT : on fige la fenêtre à sa nouvelle taille --- */
  if(handScale.active && !pinching){
    handScale.active = false;
    if(typeof toast === 'function') toast('🔍 Taille figée ×' + state.windowScale.toFixed(2));
    return;
  }
}

/* Sécurité : si la main disparaît totalement pendant un zoom (perte de
   tracking), on relâche proprement (la taille reste figée à sa valeur
   courante) au lieu de laisser un état bloqué. */
function cancelHandScaleIfActive(){
  if(handScale.active){
    handScale.active = false;
  }
}
requestAnimationFrame(function tickZoomHandles(){
  ensureZoomHandles();
  requestAnimationFrame(tickZoomHandles);
});

/* ------------ Drag par regard — mise à jour en temps réel ------------ */
function tickDragGaze(){
  // Si un grab par pinch est en cours, c'est updateHandGrab() qui pilote
  // l'affichage (voir applyWindowDragTransform ci-dessus) : on ne touche
  // pas à state.dragGazeOffX/Y ici pour ne pas entrer en conflit.
  if(state.dragGazeMode && !handGrab.active && camL.object3D){
    const o3d = camL.object3D;
    const dyaw   = o3d.rotation.y - (state.dragGazeYawStart || 0);
    const dpitch = o3d.rotation.x - (state.dragGazePitchStart || 0);
    /* 30° de rotation = 500px de déplacement */
    const RANGE = Math.PI / 6;
    const dx = (dyaw   / RANGE) * 500;
    const dy = (-dpitch / RANGE) * 350;
    state.dragGazeOffX = state.dragGazeStartOffX + dx;
    state.dragGazeOffY = state.dragGazeStartOffY + dy;
    // Apply directly to DOM without full renderHUD for perf
    const appWindowTransform = state.appMaximized
      ? uiDepthTransform(420, 0.84, `translate(-50%,-50%) translateX(${state.dragGazeOffX}px) translateY(${state.dragGazeOffY}px)`)
      : uiDepthTransform(420, 0.78, `translate(-50%,-50%) translateX(${-640+state.dragGazeOffX}px) translateY(${state.dragGazeOffY}px)`);
    for(const side of ['L','R']){
      const wc = document.getElementById('appWindowCenter'+side);
      if(wc) wc.style.transform = appWindowTransform;
    }
  }
  requestAnimationFrame(tickDragGaze);
}
requestAnimationFrame(tickDragGaze);

/* ------------ Multitâche — positions monde fixes (world-locked) ------------ */
// Positions 3D fixes dans le monde (ne suivent pas la tête).
// Toutes les fenêtres restent DEVANT l'utilisateur (pas loin sur les
// côtés) : la principale au centre, les suivantes juste à sa gauche/droite
// ou juste au-dessus, en se chevauchant légèrement (effet "cascade").
// Captées au moment où l'utilisateur active le multitâche.
const MT_WORLD_POSITIONS = [
  new THREE.Vector3( 0,    1.7,  -3.4),  // slot 0: centre, pile devant (la plus proche/grande)
  new THREE.Vector3( 1.4,  1.75, -3.6),  // slot 1: juste à droite du centre, chevauche légèrement
  new THREE.Vector3(-1.4,  1.75, -3.6),  // slot 2: juste à gauche du centre
  new THREE.Vector3( 0.4,  2.75, -3.9),  // slot 3: au-dessus, légèrement décalé
  new THREE.Vector3(-0.5,  2.8,  -4.1),  // slot 4: au-dessus, de l'autre côté
];

// Légère bascule (rotateY) par fenêtre pour donner une impression de
// "face" et de "dos" dans l'empilement (des panneaux tournés les uns par
// rapport aux autres), tout en restant clairement tournés vers l'utilisateur
// (angles faibles — on veut un effet de profondeur, pas des fenêtres de
// travers qui semblent regarder ailleurs).
const MT_SLOT_TILT_DEG = [0, -4, 4, -3, 3];

// Distance de référence à laquelle la taille de base de la fenêtre
// (voir renderMultitaskSlots) est censée paraître "normale". worldToScreen()
// ne fait que projeter une POSITION — il ne rétrécit pas la fenêtre avec
// la distance — donc sans ce facteur, éloigner une fenêtre la déplaçait
// juste vers le centre de l'écran sans jamais la faire paraître plus
// petite/lointaine. On calcule ici un vrai facteur d'échelle en
// perspective (plus loin = plus petit), appliqué en plus de l'échelle de
// zoom manuel (state.windowScale n'affecte que la fenêtre "single") et de
// l'échelle de distance réglable par l'utilisateur (state.multiTaskDistanceScale).
const MT_REF_DISTANCE = 4.0;
const MT_MIN_SCALE = 0.55;
const MT_MAX_SCALE = 1.15;
const MT_BASE_SCALE = 0.55;   // taille modérée (le "5 fois moins" précédent était une expression, pas littéral — 0.2 rendait les fenêtres invisibles)

// Bornes de la molette "Distance des fenêtres" (panneau Multitâche) : on
// reste dans un intervalle qui évite à la fois un entassement contre le
// visage et un éparpillement trop lointain/illisible.
const MT_DIST_SCALE_MIN = 0.55;
const MT_DIST_SCALE_MAX = 1.45;

function tickMultitask(){
  if(state.multiTaskMode && state.multiTaskSlots.length && camL.object3D){
    const o3d = camL.object3D;
    const distScale = Math.max(MT_DIST_SCALE_MIN, Math.min(MT_DIST_SCALE_MAX, state.multiTaskDistanceScale || 1));
    state.multiTaskSlots.forEach((slot, idx)=>{
      // Calculer la position monde en tenant compte du yaw initial.
      // L'échelle de distance réglable s'applique sur X/Z uniquement (le
      // décalage en hauteur Y reste stable pour ne pas faire "sauter" les
      // fenêtres verticalement quand on ajuste la molette).
      const raw = MT_WORLD_POSITIONS[idx] || new THREE.Vector3(0,1.8,-3.5);
      const basePos = new THREE.Vector3(raw.x * distScale, raw.y, raw.z * distScale);
      // Appliquer le yaw initial pour que les fenêtres soient ancrées devant l'utilisateur au moment de l'activation
      const anchorYaw = state.multiTaskAnchorYaw || 0;
      const rotated = basePos.clone().applyAxisAngle(new THREE.Vector3(0,1,0), anchorYaw);

      const screen = worldToScreen(rotated, o3d);

      // Distance réelle caméra <-> fenêtre (même repère que worldToScreen)
      const local = rotated.clone();
      o3d.worldToLocal(local);
      const dist = Math.max(0.01, -local.z);
      const perspectiveScale = Math.max(MT_MIN_SCALE, Math.min(MT_MAX_SCALE, MT_REF_DISTANCE / dist));
      const tilt = MT_SLOT_TILT_DEG[idx] || 0;

      for(const side of ['L','R']){
        const wrap = document.getElementById(`mtSlotWrap_${side}_${idx}`);
        const winEl = document.getElementById(`mtWinEl_${side}_${idx}`);
        if(wrap && screen){
          wrap.style.left = screen.px + 'px';
          wrap.style.top  = screen.py + 'px';
          wrap.style.display = '';
          // z-index : la fenêtre au premier plan (indice le plus bas, voir
          // MT_WORLD_POSITIONS) reste toujours visuellement devant les
          // autres, pour un vrai effet de "pile" (superposition avant/arrière).
          wrap.style.zIndex = String(20 - idx);
          if(winEl) winEl.style.transform =
            `translate(-50%,-50%) perspective(1000px) rotateY(${tilt}deg) scale(${(MT_BASE_SCALE * perspectiveScale).toFixed(3)})`;
        } else if(wrap){
          // Derrière la caméra — cacher
          wrap.style.display = 'none';
        }
      }
    });
  }
  requestAnimationFrame(tickMultitask);
}
requestAnimationFrame(tickMultitask);



function tickResizeGaze(){
  if(state.resizeGazeMode && camL.object3D){
    const o3d = camL.object3D;
    const dyaw   = o3d.rotation.y - (state.resizeGazeYawStart || 0);
    const dpitch = o3d.rotation.x - (state.resizeGazePitchStart || 0);
    /* 45° de rotation = 400px de changement */
    const RANGE = Math.PI / 4;
    const dw = (dyaw   / RANGE) * 400;
    const dh = (-dpitch / RANGE) * 300;
    const nw = Math.max(320, Math.min(1400, state.resizeGazeStartW + dw));
    const nh = Math.max(200, Math.min(900,  state.resizeGazeStartH + dh));
    for(const side of ['L','R']){
      const wc = document.getElementById('appWindowCenter'+side);
      if(!wc) continue;
      const el = wc.querySelector('#appWinEl') || wc.querySelector('.app-window,.netflix-win');
      if(el){
        el.style.width  = nw+'px';
        el.style.height = nh+'px';
        const nr = el.querySelector('.nf-root');
        if(nr){ nr.style.width = nw+'px'; nr.style.height = (nh-44)+'px'; }
      }
    }
  }
  requestAnimationFrame(tickResizeGaze);
}
requestAnimationFrame(tickResizeGaze);

/* ------------ Gaze (3s dwell) — restauré ------------ */
let gazeTarget=null, gazeStart=0;
const DWELL = 3000;
const POINT_DWELL = 900; /* sélection à distance : geste "doigt pointé seul" */
const _gazeEye = $('eyeLeft');
const _ringCircs = [null, null];
(function cacheRingCircs(){
  const r1 = $('cursorL'), r2 = $('cursorR');
  _ringCircs[0] = r1 ? r1.querySelector('circle') : null;
  _ringCircs[1] = r2 ? r2.querySelector('circle') : null;
})();
function setRingProgress(p){
  const off = 88 * (1-p);
  for(const c of _ringCircs){ if(c) c.setAttribute('stroke-dashoffset', off); }
}
function gazeTick(){
  if(!state.gazeEnabled || !state.primed){
    setRingProgress(0); requestAnimationFrame(gazeTick); return;
  }
  let cx, cy;
  const handAPI = window.__handTrackAPI;
  const handActive = handAPI && handAPI.isActive && handAPI.screen;
  if(handActive){
    cx = handAPI.screen.pageX;
    cy = handAPI.screen.pageY;
  } else {
    const bb = _gazeEye.getBoundingClientRect();
    cx = bb.left + bb.width/2;
    cy = bb.top  + bb.height/2;
  }
  const stack = document.elementsFromPoint(cx, cy);
  const el = stack.find(n => n instanceof HTMLElement && n.hasAttribute('data-gaze'));
  if(el !== gazeTarget){
    if(gazeTarget) gazeTarget.setAttribute('data-gaze-active','false');
    gazeTarget = el || null;
    gazeStart = performance.now();
    if(gazeTarget){
      gazeTarget.setAttribute('data-gaze-active','true');
      playAppleHover();
    }
    if(state.activeApp === 'notes'){
      state.notesGazeKey = gazeTarget ? gazeTarget.getAttribute('data-kb') : null;
      state.notesGazeStart = gazeStart;
    }
  }
  let progress = 0;
  /* En mode hand tracking, ce dwell-ci (regard) reste désactivé — le clic
     main utilise son propre système de tenue (pointer l'index et
     l'immobiliser un instant), géré séparément dans handTracking.js /
     handPointer.js avec son propre anneau de progression. Le rond blanc
     ci-dessous reste réservé au regard (gaze), quand le hand tracking est
     désactivé. */
  if(gazeTarget && !handActive){
    const action = gazeTarget.getAttribute('data-action');
    const dwell = (action === 'cinema:scrub:confirm' || action === 'resize:confirm' || action === 'drag:confirm') ? 2000 : (state.activeApp === 'sims3' ? 1500 : DWELL);
    progress = Math.min(1, (performance.now()-gazeStart)/dwell);
    if(state.activeApp === 'notes' && gazeTarget.hasAttribute('data-kb')){
      const circle = gazeTarget.querySelector('.kb-ring circle');
      if(circle){
        const dash = 2*Math.PI*10;
        circle.setAttribute('stroke-dashoffset', (dash*(1-progress)).toFixed(2));
      }
    }
    if(progress>=1){
      const action = gazeTarget.getAttribute('data-action');
      gazeTarget.classList.add('gaze-flash');
      setTimeout(()=>gazeTarget && gazeTarget.classList.remove('gaze-flash'),360);
      playAppleClick();
      handleAction(action);
      gazeStart = performance.now() + 600;
    }
  }
  setRingProgress(handActive ? 0 : progress);
  requestAnimationFrame(gazeTick);
}

/* Pincement (pinch) détecté par le Hand Tracking = clic instantané sur la
   cible actuellement survolée par le curseur main, sans attendre le dwell. */
window.__handTrackPinchClick = function(){
  if(!gazeTarget) return;
  const action = gazeTarget.getAttribute('data-action');
  if(!action) return;
  gazeTarget.classList.add('gaze-flash');
  setTimeout(()=>gazeTarget && gazeTarget.classList.remove('gaze-flash'),360);
  playAppleClick();
  handleAction(action);
  gazeStart = performance.now() + 600;
  setRingProgress(0);
};

