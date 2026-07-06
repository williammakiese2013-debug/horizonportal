/* ============================================================
   HAND TRACKING — MediaPipe Tasks Vision (HandLandmarker, WASM + GPU)
   Suivi de la main via la caméra arrière pour piloter le curseur
   de regard (gaze cursor) + tout le reste de l'interaction main
   (clic, grab, scroll, zoom). Réutilise le flux du passthrough s'il
   est actif, sinon ouvre son propre flux caméra caché.

   MIGRATION (depuis hand-tracking-legacy.js / @mediapipe/hands) :
   seule la COUCHE DE DÉTECTION change (loadModel + runDetection plus
   bas). Absolument tout le reste — lissage One Euro, classification
   des gestes, curseur DOM/3D, grab/scale/scroll de fenêtre, squelette,
   watchdog, pont postMessage vers Web Hero — est repris À L'IDENTIQUE,
   pour que window.__handTrackAPI continue d'exposer EXACTEMENT le
   même format qu'avant (isActive, screen, pinching, pointing, openPalm,
   mode, handSpread, landmarks, handCount, allHands, activeHandIndex).
   handTracking.js et handPointer.js (qui ne lisent que cette API) n'ont
   donc besoin d'aucune modification.

   Ancien moteur : @mediapipe/hands (legacy, API "Hands", callback
   asynchrone hands.send()/onResults()).
   Nouveau moteur : @mediapipe/tasks-vision (HandLandmarker), qui tourne
   sur un runtime WASM moderne et supporte la délégation GPU. Sa méthode
   detectForVideo() est SYNCHRONE (pas de callback, pas de Promise qui
   peut rester bloquée en interne) : le bug historique "hands.send() qui
   ne se résout jamais" du moteur legacy ne peut plus se produire. Le
   watchdog est conservé quand même par prudence (caméra gelée, contexte
   WebGL GPU perdu en arrière-plan sur mobile), mais ne réagit plus à ce
   bug précis puisqu'il n'existe plus.
   ============================================================ */
(function setupHandTrack(){
  /* CDN jsDelivr — @mediapipe/tasks-vision est distribué en module ES
     (vision_bundle.mjs) ; on le charge via import() dynamique, ce qui
     fonctionne même depuis un <script> classique (non-module) comme
     celui-ci. Le runtime WASM (.wasm/.data) est servi par le même CDN,
     dans le sous-dossier /wasm. */
  const TASKS_VISION_VERSION = '0.10.14';
  const TASKS_VISION_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/vision_bundle.mjs`;
  const TASKS_VISION_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
  /* Modèle officiel "HandLandmarker" (float16, léger, optimisé mobile),
     hébergé par Google — c'est le modèle recommandé par la doc Tasks
     Vision, équivalent modernisé du modelComplexity:0 ("Lite") legacy. */
  const HAND_MODEL_ASSET_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

  let visionModule = null;   // module @mediapipe/tasks-vision une fois importé
  let handLandmarker = null; // instance HandLandmarker (remplace l'ancienne instance Hands)
  let usingGPU = false;      // vrai si la délégation GPU a pu être activée

  /* Canvas plein écran (par-dessus toute l'interface) pour dessiner le
     squelette de la main en temps réel — pur repère visuel d'aim assist,
     indépendant du curseur gaze/hand existant. */
  let skeletonCanvas = null;
  let skeletonCtx = null;

  let vid = null;          // <video> utilisé comme source (propre ou emprunté au passthrough)
  let ownStream = null;    // flux caméra ouvert par ce module (si passthrough inactif)
  let usingOwnVideo = false;
  let active = false;
  let loading = false;
  let rafId = null;          // boucle de détection (fallback rAF si rVFC indisponible)
  let renderRafId = null;    // boucle de rendu (curseur), tourne au framerate de l'écran
  let lastVideoTime = -1;
  let lastResultTs = 0;      // horodatage du dernier résultat de détection (succès OU échec) reçu
  let watchdogInterval = null; // surveille les blocages internes (caméra gelée / contexte GPU perdu) et relance le pipeline
  const WATCHDOG_STALL_MS = 5000;   // au-delà, on considère le pipeline figé
  const WATCHDOG_CHECK_MS = 2000;
  let reinitInProgress = false;

  /* Etat du curseur main, en coordonnées écran (page), calculé sur l'oeil gauche */
  let handScreen = null;     // {pageX, pageY} en coordonnées page
  let handVisible = false;
  let pinching = false;
  let renderPrevPinching = false; // pinch au frame de rendu précédent (pour les fronts grab/scale/click)
  let pinchArmed = true;     // anti-répétition (hystérésis)
  let handInteractionMode = 'far'; // 'far'=ray+pinch, 'close'=direct touch+poke
  let handSpread = 0;

  /* --- NOUVEAUX GESTES ---------------------------------------------
     - pointing   : index seul tendu (autres doigts repliés) → sélection
       à distance (active le dwell-click, désactivé par défaut en mode
       main pour laisser le pinch être le seul déclencheur instantané).
     - openPalm   : main grande ouverte (4 doigts tendus) → tenue ~0.6s
       déclenche un recentrage de l'interface (comme le bouton ⊙).
     - swipe      : déplacement horizontal rapide de la paume → navigue
       (onglets Écran d'accueil, galerie, etc.).
     ------------------------------------------------------------------ */
  let pointing = false;
  let openPalm = false;
  let openPalmHoldStart = 0;      // horodatage du début de la tenue "main ouverte"
  let openPalmTriggered = false;  // anti-répétition tant que la main reste ouverte
  const OPEN_PALM_HOLD_MS = 600;  // durée de tenue avant déclenchement du recentrage
  let palmX = null, palmY = null; // centre de paume (normalisé 0..1), pour le swipe
  const swipeHistory = [];        // [{x, t}] fenêtre glissante pour la détection de balayage
  const SWIPE_WINDOW_MS = 350;
  const SWIPE_MIN_DIST = 0.16;    // distance normalisée mini pour valider un balayage
  let swipeCooldownUntil = 0;     // anti-répétition après un balayage détecté

  /* "Viens ici" : index qui se recroqueville (comme pour faire signe à
     quelqu'un d'approcher) → rapproche le menu d'un cran à chaque
     repliement. Anti-répétition par hystérésis : il faut ré-étendre
     l'index au-delà de BECKON_CURL_OUT avant qu'un nouveau repliement
     ne compte, comme un geste répété "viens... viens... viens". */
  let beckonArmed = true;
  const BECKON_CURL_IN = 0.9;    // index recroquevillé (déclenche)
  const BECKON_CURL_OUT = 1.15;  // index ré-étendu (réarme)
  const BECKON_STEP_PX = 40;     // rapprochement/éloignement par geste
  const BECKON_MIN_DEPTH = -200; // même borne que le slider "Distance de l'interface"
  const BECKON_MAX_DEPTH = 400;  // idem, borne haute du slider

  /* "Au loin" (geste inverse) : poing fermé qui s'ouvre en grand, comme
     pour repousser quelque chose → éloigne le menu d'un cran. */
  let fistWasClosed = false;

  /* "Signe V / Paix" (index + majeur tendus, annulaire + auriculaire
     repliés) tenu ~600ms → bascule le passthrough caméra (fond réel),
     sans avoir à toucher l'écran ni chercher le bouton 📷. Même logique
     de tenue/anti-répétition que la main ouverte (recentrage). */
  let peaceSign = false;
  let peaceSignHoldStart = 0;
  let peaceSignTriggered = false;
  const PEACE_SIGN_HOLD_MS = 600;

  /* --- Cible brute (issue de la détection, cadence caméra) vs valeur affichée
     (lissée, mise à jour à CHAQUE frame de rendu). Ce découpage est la clé de
     la fluidité perçue : même si le HandLandmarker ne livre de nouvelles
     coordonnées qu'à la cadence caméra (~15-30 Hz), TOUT (curseur ET
     squelette) est lissé et redessiné à la cadence d'affichage réelle
     (60-120 Hz), sans à-coups — et surtout à partir des MÊMES points
     lissés, pour que le curseur et le squelette dessiné ne fassent jamais
     qu'un avec la main réelle. */
  let rawLandmarks = null;          // 21 points bruts de la main ACTIVE (celle qui pilote l'interaction)
  let rawVW = 0, rawVH = 0;         // dimensions vidéo au moment de la détection
  let dispLandmarks = null;         // 21 points lissés (EMA) de la main ACTIVE, utilisés pour le curseur ET le squelette
  let lastRenderTs = 0;
  let pokeBaseline = undefined;     // ligne de base Z index-tip/wrist pour le geste de "poke"

  /* --- SUIVI DEUX MAINS -----------------------------------------------
     NOTE : numHands est volontairement figé à 1 ci-dessous (optimisation
     demandée : latence/FPS maximum sur mobile avec une seule main suivie).
     Toute la plomberie "plusieurs mains" (dispHandsAll, pinchArmedAll...)
     est conservée telle quelle pour ne rien casser côté Web Hero (pont
     postMessage, voir getAllBridgeHands plus bas) : elle contiendra
     simplement 0 ou 1 élément au lieu de 0/1/2. --- */
  let rawHandsAll = [];              // [{ landmarks:[21 pts bruts], label:'Left'|'Right'|null }, ...] (0 ou 1 élément)
  let dispHandsAll = [];             // même forme, landmarks lissés (One Euro) — un tableau par main détectée
  let pinchArmedAll = [];            // hystérésis pinch, une entrée par main (indexée comme dispHandsAll)
  let pinchingAll = [];              // état pinch courant, une entrée par main
  let activeHandIdx = 0;             // index (dans dispHandsAll) de la main qui pilote l'interaction

  /* --- FILTRE "ONE EURO" (Casiez et al.) ---------------------------------
     Lissage ADAPTATIF : plus de lissage quand la main est quasi immobile
     (tremblement de détection écrasé), moins de lissage quand elle bouge
     vite (pas de retard perceptible au clic/déplacement rapide). Simple
     post-traitement mathématique, indépendant du moteur de détection —
     inchangé par cette migration. Un filtre par (main, landmark, axe
     x/y/z) — recréé à chaque nouvelle apparition de main pour repartir
     sur un historique propre. --------- */
  function makeOneEuro(minCutoff, beta, dCutoff){
    let xPrev = null, dxPrev = 0, tPrev = null;
    function alpha(cutoff, dt){
      const tau = 1/(2*Math.PI*cutoff);
      return 1/(1+tau/dt);
    }
    return function(x, t){
      if(tPrev === null){ xPrev = x; dxPrev = 0; tPrev = t; return x; }
      const dt = Math.max(1e-4, t - tPrev);
      const dx = (x - xPrev) / dt;
      const aD = alpha(dCutoff, dt);
      dxPrev = aD*dx + (1-aD)*dxPrev;
      const cutoff = minCutoff + beta*Math.abs(dxPrev);
      const a = alpha(cutoff, dt);
      const xf = a*x + (1-a)*xPrev;
      xPrev = xf; tPrev = t;
      return xf;
    };
  }
  const ONEEURO_MIN_CUTOFF = 0.9;
  const ONEEURO_BETA = 1.4;
  const ONEEURO_D_CUTOFF = 1.0;
  let filtersAll = []; // filtersAll[handIdx] = [{x,y,z}, ...21] (fonctions de filtrage)
  function makeHandFilters(){
    const arr = new Array(21);
    for(let i=0;i<21;i++){
      arr[i] = {
        x: makeOneEuro(ONEEURO_MIN_CUTOFF, ONEEURO_BETA, ONEEURO_D_CUTOFF),
        y: makeOneEuro(ONEEURO_MIN_CUTOFF, ONEEURO_BETA, ONEEURO_D_CUTOFF),
        z: makeOneEuro(ONEEURO_MIN_CUTOFF, ONEEURO_BETA, ONEEURO_D_CUTOFF)
      };
    }
    return arr;
  }

  /* --- Anti-mélange des gestes -------------------------------------------
     Chaque geste "posé" (pointing, main ouverte, signe V, poing fermé/ouvert)
     doit être confirmé sur plusieurs frames consécutifs de rendu avant d'être
     pris en compte : ça évite qu'un simple tremblement d'un seul frame ne
     fasse "sauter" d'un geste à l'autre. Le pincement (pinch) est TOUJOURS
     prioritaire et exclut explicitement tous les autres gestes tant qu'il
     est actif — les deux familles de gestes ne se chevauchent donc plus
     jamais. Les confirmateurs sont recréés à chaque activation du hand
     tracking (enableHandTrack) pour repartir sur un état propre. --- */
  function makeConfirmer(framesNeeded){
    let confirmed = false, streak = 0, lastRaw = false;
    return function(raw){
      if(raw === lastRaw){ streak++; } else { streak = 1; lastRaw = raw; }
      if(streak >= framesNeeded) confirmed = raw;
      return confirmed;
    };
  }
  let confirmPointing, confirmOpenPalm, confirmPeaceSign, confirmFistClosed, confirmFistOpen;

  /* Cache des rects des conteneurs .eye : un getBoundingClientRect() par frame
     force un reflow layout coûteux. On les recalcule seulement au resize/
     changement d'orientation (+ un filet de sécurité périodique). */
  let eyeRectsCache = null;
  let eyeRectsCacheTs = 0;
  const EYE_RECT_TTL = 500;
  function getEyeRects(force){
    const now = performance.now();
    if(force || !eyeRectsCache || (now - eyeRectsCacheTs) > EYE_RECT_TTL){
      const eyeL = document.getElementById('eyeLeft');
      const eyeR = document.getElementById('eyeRight');
      if(eyeL && eyeR){
        eyeRectsCache = { L: eyeL.getBoundingClientRect(), R: eyeR.getBoundingClientRect() };
        eyeRectsCacheTs = now;
      }
    }
    return eyeRectsCache;
  }
  window.addEventListener('resize', ()=>getEyeRects(true));
  window.addEventListener('orientationchange', ()=>getEyeRects(true));

  const btn = document.createElement('button');
  btn.id = 'handTrackBtn';
  btn.className = 'handtrack-btn';
  btn.title = 'Suivi des mains (hand tracking)';
  btn.innerHTML = '🖐️';
  btn.setAttribute('aria-label','Activer le suivi des mains');
  document.body.appendChild(btn);

  /* Indicateur de statut texte (existait déjà en CSS mais n'était jamais créé) */
  const statusEl = document.createElement('div');
  statusEl.id = 'handTrackStatus';
  statusEl.className = 'hand-status';
  statusEl.style.display = 'none';
  document.body.appendChild(statusEl);
  let missStreak = 0;          // nb de frames consécutives sans détection
  const MISS_GRACE = 18;       // tolère de courtes pertes avant d'afficher "main perdue"
  function setStatus(text){
    if(!text){ statusEl.style.display = 'none'; return; }
    statusEl.textContent = text;
    statusEl.style.display = 'block';
  }

  function ensureOwnVideo(){
    if(vid) return vid;
    vid = document.createElement('video');
    vid.id = 'handTrackVideo';
    vid.setAttribute('playsinline','');
    vid.setAttribute('webkit-playsinline','');
    vid.muted = true;
    vid.autoplay = true;
    document.body.appendChild(vid);
    return vid;
  }

  async function acquireVideo(){
    /* Réutiliser le flux du passthrough si actif */
    if(window.__passthroughAPI && window.__passthroughAPI.active && window.__passthroughAPI.video){
      usingOwnVideo = false;
      return window.__passthroughAPI.video;
    }
    /* Sinon, ouvrir notre propre flux caméra arrière, caché */
    usingOwnVideo = true;
    const v = ensureOwnVideo();
    ownStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:'environment', width:{ideal:640}, height:{ideal:480} }
    });
    v.srcObject = ownStream;
    await v.play();
    return v;
  }

  function releaseOwnVideo(){
    if(ownStream){ ownStream.getTracks().forEach(t=>t.stop()); ownStream=null; }
    if(vid && usingOwnVideo) vid.srcObject = null;
  }

  /* Crée (une seule fois) le canvas transparent plein écran qui accueille
     le dessin du squelette. `pointer-events:none` + z-index élevé pour
     rester purement visuel, par-dessus l'OS/l'interface, sans jamais
     intercepter le moindre clic/tap. */
  function ensureSkeletonCanvas(){
    if(skeletonCanvas) return skeletonCanvas;
    skeletonCanvas = document.createElement('canvas');
    skeletonCanvas.id = 'handSkeletonCanvas';
    skeletonCanvas.style.position = 'fixed';
    skeletonCanvas.style.top = '0';
    skeletonCanvas.style.left = '0';
    skeletonCanvas.style.width = '100vw';
    skeletonCanvas.style.height = '100vh';
    skeletonCanvas.style.pointerEvents = 'none';
    skeletonCanvas.style.zIndex = '9999';
    skeletonCanvas.style.display = 'none'; // masqué tant que le hand tracking est inactif
    document.body.appendChild(skeletonCanvas);
    skeletonCtx = skeletonCanvas.getContext('2d');
    resizeSkeletonCanvas();
    window.addEventListener('resize', resizeSkeletonCanvas);
    window.addEventListener('orientationchange', resizeSkeletonCanvas);
    return skeletonCanvas;
  }

  /* Canvas pont-écran homogène : la taille du canvas de dessin colle
     exactement à la taille de l'écran (innerWidth/innerHeight), sans
     multiplication par devicePixelRatio : la résolution du buffer est
     multipliée par DPR et le contexte est mis à l'échelle pour que les
     coordonnées en pixels CSS correspondent pile aux pixels physiques,
     garantissant une superposition parfaite sans flou ni décalage. */
  function resizeSkeletonCanvas(){
    if(!skeletonCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    skeletonCanvas.width = window.innerWidth * dpr;
    skeletonCanvas.height = window.innerHeight * dpr;
    skeletonCanvas.style.width = window.innerWidth + 'px';
    skeletonCanvas.style.height = window.innerHeight + 'px';
    skeletonCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------------------------------------------------------------
     CHARGEMENT DU MODÈLE — MediaPipe Tasks Vision (HandLandmarker)
     Remplace l'ancien loadModel() basé sur @mediapipe/hands (script UMD
     + hands.setOptions()). Ici :
       1) import() dynamique du bundle ES @mediapipe/tasks-vision ;
       2) FilesetResolver.forVisionTasks() résout le runtime WASM ;
       3) HandLandmarker.createFromOptions() avec :
          - numHands: 1            (optimisation demandée : 1 seule main
                                     suivie = latence/FPS maximum)
          - delegate: 'GPU'        (délégation GPU = FPS max sur mobile),
                                     avec repli automatique sur 'CPU' si
                                     le GPU n'est pas disponible/supporté
                                     sur l'appareil (ne bloque jamais le
                                     démarrage du suivi de main)
          - runningMode: 'VIDEO'   (mode vidéo continu, adapté à un flux
                                     caméra live plutôt qu'à des images
                                     isolées)
     --------------------------------------------------------------- */
  async function createLandmarker(delegate){
    const { FilesetResolver, HandLandmarker } = visionModule;
    const filesetResolver = await FilesetResolver.forVisionTasks(TASKS_VISION_WASM_BASE);
    return HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: HAND_MODEL_ASSET_URL,
        delegate
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  }

  async function loadModel(){
    if(handLandmarker) return handLandmarker;

    if(!visionModule){
      visionModule = await import(/* webpackIgnore: true */ TASKS_VISION_MODULE_URL);
    }

    try{
      handLandmarker = await createLandmarker('GPU');
      usingGPU = true;
      console.log('[HandTrack] HandLandmarker initialisé (délégation GPU)');
    } catch(gpuErr){
      console.warn('[HandTrack] délégation GPU indisponible, repli CPU', gpuErr);
      handLandmarker = await createLandmarker('CPU');
      usingGPU = false;
      console.log('[HandTrack] HandLandmarker initialisé (délégation CPU)');
    }

    return handLandmarker;
  }

  /* Connexions standard du squelette de main (21 points). Dessinées à la
     main (plutôt que via un utilitaire de dessin générique) car on a
     besoin de projeter CHAQUE point avec mapToEye() — inchangé par cette
     migration : le HandLandmarker retourne exactement la même topologie
     à 21 points que l'ancien moteur. */
  const HAND_BONES = [
    [0,1],[1,2],[2,3],[3,4],       // pouce
    [0,5],[5,6],[6,7],[7,8],       // index
    [5,9],[9,10],[10,11],[11,12],  // majeur
    [9,13],[13,14],[14,15],[15,16],// annulaire
    [13,17],[17,18],[18,19],[19,20],// auriculaire
    [0,17]                         // base de la paume
  ];

  /* Efface puis redessine le squelette (points + connexions), style
     "interface spatiale" : vert fluo, sans remplissage opaque qui
     boucherait la vue des apps derrière.

     IMPORTANT — alignement : le flux caméra n'est JAMAIS affiché "1:1" sur
     toute la fenêtre. Il est toujours recadré en mode "cover" à l'intérieur
     de CHAQUE œil (.eye), exactement comme le fait le passthrough
     (setupPassthrough > drawFrame) et comme le fait le curseur main
     (renderLoop > mapToEye). On applique donc ici EXACTEMENT la même
     transformation mapToEye() que le curseur, point par point, une fois
     par œil — c'est ce qui garantit que le dessin colle pile sur la main
     réelle vue à travers la caméra, dans les deux yeux.

     Appelée depuis renderLoop() (cadence d'affichage 60-120Hz) avec les
     points DÉJÀ LISSÉS (dispLandmarks) — les mêmes que ceux qui pilotent le
     curseur — donc le squelette suit la main sans à-coups et reste
     parfaitement synchronisé avec le curseur ("la main et le squelette ne
     font qu'un"). */
  function drawHandSkeleton(handsList, rects, vw, vh){
    if(!skeletonCtx || !skeletonCanvas) return;
    const ctx = skeletonCtx;

    const dpr = window.devicePixelRatio || 1;
    if(skeletonCanvas.width !== window.innerWidth*dpr || skeletonCanvas.height !== window.innerHeight*dpr){
      skeletonCanvas.width = window.innerWidth * dpr;
      skeletonCanvas.height = window.innerHeight * dpr;
      skeletonCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if(!handsList || !handsList.length || !rects || !vw || !vh) return;

    function drawForEye(rect, landmarks, color){
      if(!rect || !rect.width || !rect.height) return;
      const pts = landmarks.map(p=>{
        const m = mapToEye(p.x, p.y, vw, vh, rect.width, rect.height);
        return { x: rect.left + m.px, y: rect.top + m.py };
      });
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.beginPath();
      HAND_BONES.forEach(([a,b])=>{
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      });
      ctx.stroke();
      ctx.fillStyle = color;
      pts.forEach(p=>{
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fill();
      });
    }
    /* La main ACTIVE (celle qui pilote le curseur/pinch) est tracée en
       vert vif ; toute autre main détectée en même temps (2e main, si un
       jour numHands est remonté à 2) est tracée en cyan. */
    handsList.forEach((h, i)=>{
      const color = (i === activeHandIdx) ? '#00FF00' : '#37e0ff';
      drawForEye(rects.L, h, color);
      drawForEye(rects.R, h, color);
    });
  }

  /* ---------------------------------------------------------------
     Classification de gestes simples à partir des 21 landmarks.
     Heuristique indépendante de l'orientation de la main : un doigt
     est considéré "tendu" si son extrémité (tip) est plus éloignée du
     poignet que son articulation médiane (pip) — fonctionne même main
     tournée/inclinée, contrairement à une comparaison sur l'axe Y seul.
     --------------------------------------------------------------- */
  function dist3(a, b){
    return Math.hypot(a.x-b.x, a.y-b.y, (a.z||0)-(b.z||0));
  }
  function isFingerExtended(landmarks, tipIdx, pipIdx, wrist){
    return dist3(wrist, landmarks[tipIdx]) > dist3(wrist, landmarks[pipIdx]) * 1.15;
  }
  function classifyGesture(landmarks){
    const wrist = landmarks[0];
    const idxExt   = isFingerExtended(landmarks, 8,  6,  wrist);
    const midExt   = isFingerExtended(landmarks, 12, 10, wrist);
    const ringExt  = isFingerExtended(landmarks, 16, 14, wrist);
    const pinkyExt = isFingerExtended(landmarks, 20, 18, wrist);
    const extendedCount = [idxExt, midExt, ringExt, pinkyExt].filter(Boolean).length;
    return {
      pointing: idxExt && !midExt && !ringExt && !pinkyExt,
      openPalm: extendedCount >= 4,
      peaceSign: idxExt && midExt && !ringExt && !pinkyExt,
      extendedCount
    };
  }

  /* Main grande ouverte tenue ~600ms → recentre l'interface (même action
     que le bouton ⊙ Recentrer), sans compte à rebours visuel puisque la
     tenue du geste EST le délai. */
  function updateOpenPalmRecenter(isOpen){
    const now = performance.now();
    if(!isOpen){
      openPalmHoldStart = 0; openPalmTriggered = false; return;
    }
    if(!openPalmHoldStart) openPalmHoldStart = now;
    if(openPalmTriggered) return;
    if(now - openPalmHoldStart >= OPEN_PALM_HOLD_MS){
      openPalmTriggered = true;
      if(camL && camL.object3D){
        state.initYaw = camL.object3D.rotation.y;
        state.initPitch = camL.object3D.rotation.x;
        positionFlatScreen();
        _prevLocked = null; // force re-freeze
        if(state.locked) setTimeout(freezeHUDNow, 30);
      }
      playAppleClick();
      toast('🖐️ Interface recentrée');
    }
  }

  /* Signe V (paix) tenu ~600ms → bascule le passthrough caméra, sans
     compte à rebours visuel (la tenue du geste EST le délai), sur le
     même principe que le recentrage à main ouverte ci-dessus. */
  function updatePeaceSignPassthrough(isPeace){
    const now = performance.now();
    if(!isPeace){
      peaceSignHoldStart = 0; peaceSignTriggered = false; return;
    }
    if(!peaceSignHoldStart) peaceSignHoldStart = now;
    if(peaceSignTriggered) return;
    if(now - peaceSignHoldStart >= PEACE_SIGN_HOLD_MS){
      peaceSignTriggered = true;
      playAppleClick();
      if(typeof window.togglePassthrough === 'function'){
        window.togglePassthrough();
      }
    }
  }

  /* Balayage horizontal main ouverte (et hors pincement) → navigation.
     Fenêtre glissante de positions récentes du centre de paume ; si le
     déplacement dépasse SWIPE_MIN_DIST en moins de SWIPE_WINDOW_MS, on
     déclenche l'action associée. */
  function updateSwipeDetection(x, isOpen){
    const now = performance.now();
    if(!isOpen || pinching || x == null){
      swipeHistory.length = 0;
      return;
    }
    swipeHistory.push({ x, t: now });
    while(swipeHistory.length && now - swipeHistory[0].t > SWIPE_WINDOW_MS) swipeHistory.shift();
    if(now < swipeCooldownUntil || swipeHistory.length < 2) return;
    const dx = swipeHistory[swipeHistory.length-1].x - swipeHistory[0].x;
    if(Math.abs(dx) >= SWIPE_MIN_DIST){
      const dir = dx > 0 ? 'right' : 'left';
      swipeCooldownUntil = now + 700;
      openPalmHoldStart = now; // évite un recentrage accidentel juste après le balayage
      swipeHistory.length = 0;
      triggerGestureSwipe(dir);
    }
  }

  /* Action déclenchée par le balayage : navigue les onglets de l'Écran
     d'accueil (Galerie / Scènes / VR Meet Up / Divertissement) quand cet
     écran est actif. Facilement extensible : ajouter un cas ici pour
     brancher le balayage sur d'autres écrans (galerie photo, etc). */
  function triggerGestureSwipe(dir){
    const VH_TABS = ['galerie','scenes','vrmeetup','entertainment'];
    if(state.activeApp === 'visionhome'){
      const cur = VH_TABS.indexOf(state.vhHomeTab || 'galerie');
      const next = dir === 'left'
        ? Math.min(VH_TABS.length - 1, cur + 1)
        : Math.max(0, cur - 1);
      if(next !== cur){
        playAppleClick();
        handleAction('vhTab:' + VH_TABS[next]);
      }
      return;
    }
    toast(dir === 'left' ? '👉 Balayage' : '👈 Balayage');
  }

  /* Action déclenchée par le geste "viens ici" : rapproche le menu d'un
     cran (même variable que le slider "Distance de l'interface" dans
     Réglages > Calibration VR, pour rester parfaitement synchronisé). */
  function triggerBeckonApproach(){
    const cur = state.uiDepthExtra || 0;
    const next = Math.max(BECKON_MIN_DEPTH, cur - BECKON_STEP_PX);
    if(next === cur) return; // déjà au plus proche
    state.uiDepthExtra = next;
    const rng = document.getElementById('rngUiDepth');
    const lbl = document.getElementById('valUiDepth');
    if(rng) rng.value = next;
    if(lbl) lbl.textContent = (next >= 0 ? '+' : '') + next + 'px';
    try{ localStorage.setItem('calib:uiDepth', String(next)); }catch(_){}
    renderHUD();
    playAppleClick();
    toast('👋 Menu rapproché');
  }

  /* Action déclenchée par le geste "au loin" (poing qui s'ouvre en grand) :
     éloigne le menu d'un cran — symétrique de triggerBeckonApproach(). */
  function triggerPushAway(){
    const cur = state.uiDepthExtra || 0;
    const next = Math.min(BECKON_MAX_DEPTH, cur + BECKON_STEP_PX);
    if(next === cur) return; // déjà au plus loin
    state.uiDepthExtra = next;
    const rng = document.getElementById('rngUiDepth');
    const lbl = document.getElementById('valUiDepth');
    if(rng) rng.value = next;
    if(lbl) lbl.textContent = (next >= 0 ? '+' : '') + next + 'px';
    try{ localStorage.setItem('calib:uiDepth', String(next)); }catch(_){}
    renderHUD();
    playAppleClick();
    toast('🖐️ Menu éloigné');
    /* Repousse le déclenchement du recentrage par main-ouverte-tenue,
       pour ne pas enchaîner accidentellement sur ce geste. */
    openPalmHoldStart = performance.now();
  }

  /* ---------------------------------------------------------------
     handleDetectionResult(result) — remplace l'ancien onResults()
     callback de @mediapipe/hands. Contrairement à l'ancien moteur,
     detectForVideo() est SYNCHRONE : cette fonction est appelée
     directement depuis runDetection() ci-dessous, dans la même frame,
     et ne fait que capturer la dernière détection brute. Tout le reste
     (lissage, gestes, dessin) reste calculé dans renderLoop() à la
     cadence d'écran — inchangé.
     --------------------------------------------------------------- */
  function handleDetectionResult(result){
    lastResultTs = performance.now(); // preuve de vie du pipeline de détection (voir watchdog)

    var allHands = (result && result.landmarks) || [];
    var allHandedness = (result && result.handednesses) || [];

    /* Filtre de plausibilité (taille de paume) appliqué à CHAQUE main
       détectée : une main dont la "taille" apparente est aberrante
       (< 0.02 ou > 0.5, en unités normalisées image) est très probablement
       un faux positif et est écartée sans faire échouer la détection. */
    var valid = [];
    for(var i=0;i<allHands.length;i++){
      var lm = allHands[i];
      if(!lm || lm.length < 21) continue;
      var palm = Math.hypot(lm[0].x-lm[9].x, lm[0].y-lm[9].y, (lm[0].z||0)-(lm[9].z||0));
      if(palm < 0.02 || palm > 0.5) continue;
      /* Tasks Vision expose la "handedness" sous forme de catégories
         { categoryName: 'Left'|'Right', displayName, score, index } au
         lieu de l'ancien { label: 'Left'|'Right' } — on adapte juste ce
         champ, la logique de filtrage reste identique. */
      var hd = allHandedness[i] && allHandedness[i][0];
      valid.push({ landmarks: lm, label: hd ? (hd.categoryName || hd.label || null) : null });
    }

    if(valid.length){
      handVisible = true;
      missStreak = 0;
      setStatus(valid.length > 1 ? '✋✋ 2 mains détectées' : '✋ Main détectée');
      rawHandsAll = valid;
      rawLandmarks = valid[0].landmarks; // repli : affiné dans renderLoop() selon la main réellement active
      rawVW = vid.videoWidth; rawVH = vid.videoHeight;
    } else {
      missStreak++;
      if(missStreak <= MISS_GRACE){ setStatus('🔎 Main partiellement perdue…'); return; }
      handVisible = false;
      rawLandmarks = null;
      rawHandsAll = [];
      setStatus('👋 Main non détectée…');
    }
  }

  /* Reproduit le mapping "cover" utilisé par le passthrough (drawFrame)
     pour convertir une coordonnée normalisée vidéo (0..1) en pixels
     à l'intérieur du conteneur .eye (quel que soit son ratio). */
  function mapToEye(nx, ny, vw, vh, eyeW, eyeH){
    const scale = Math.max(eyeW/vw, eyeH/vh);
    const sw = eyeW/scale, sh = eyeH/scale, sx = (vw-sw)/2, sy = (vh-sh)/2;
    const vx = nx*vw, vy = ny*vh;
    const cx = (vx - sx) / sw;
    const cy = (vy - sy) / sh;
    return { px: cx*eyeW, py: cy*eyeH };
  }

  function updateCursorDOM(el, px, py, isActive, isPinching, isPointing){
    if(!el) return;
    if(isActive){
      el.classList.add('hand-driven');
      el.style.left = px+'px';
      el.style.top = py+'px';
      el.classList.toggle('hand-curl', !!isPinching);
      el.classList.toggle('hand-point', !isPinching && !!isPointing);
    } else {
      el.classList.remove('hand-driven','hand-pinch','hand-point','hand-curl');
      el.style.left = '';
      el.style.top = '';
    }
  }

  function update3DCursor(id, px, py, eyeW, eyeH, o3d, visible){
    const el = document.getElementById(id);
    if(!el) return;
    const ringId = id.replace('handCursor','handCursorRing');
    const ringEl = document.getElementById(ringId);
    if(!visible || !o3d){
      el.setAttribute('visible','false');
      if(ringEl) ringEl.setAttribute('visible','false');
      return;
    }
    const fov = THREE.MathUtils.degToRad(75);
    const tanH = Math.tan(fov/2);
    const aspect = eyeW/eyeH;
    const depth = 1.4;
    const ndx = (px - eyeW/2) / (eyeW/2);
    const ndy = (eyeH/2 - py) / (eyeH/2);
    const lx = ndx * depth * tanH * aspect;
    const ly = ndy * depth * tanH;
    el.object3D.position.set(lx, ly, -depth);
    el.setAttribute('visible','true');
    if(ringEl){
      ringEl.object3D.position.set(lx, ly, -depth);
      ringEl.setAttribute('visible','true');
    }
  }

  /* ---------------------------------------------------------------
     DÉTECTION — cadencée par les frames vidéo réelles (requestVideoFrameCallback
     quand dispo, sinon repli rAF classique avec vérification de currentTime).
     Ne touche à AUCUN élément DOM : elle se contente de mettre à jour les
     "landmarks bruts" (rawLandmarks) + l'horodatage du dernier résultat.
     Tout le lissage, la classification des gestes, le dessin du squelette
     et le rendu visuel (curseur, grab, scale, clic) sont délégués à
     renderLoop() ci-dessous, qui tourne indépendamment à la cadence
     d'affichage — c'est ce découplage qui supprime les saccades quand la
     caméra tourne plus lentement que l'écran.

     detectForVideo() (Tasks Vision) est SYNCHRONE : contrairement à
     l'ancien hands.send() (Promise pouvant rester bloquée indéfiniment
     en interne sur certains mobiles après ~10-30s), il retourne son
     résultat immédiatement, dans le même tick JS. Plus besoin de verrou
     "sendInFlight" ni de timeout de sécurité sur l'appel lui-même.
     --------------------------------------------------------------- */
  function runDetection(){
    if(!vid || vid.readyState < 2 || !handLandmarker) return;
    if(vid.currentTime === lastVideoTime) return; // pas de nouvelle frame caméra
    lastVideoTime = vid.currentTime;

    const vw = vid.videoWidth, vh = vid.videoHeight;
    if(!vw || !vh) return;

    try{
      const result = handLandmarker.detectForVideo(vid, performance.now());
      handleDetectionResult(result);
    } catch(e){
      /* Frame ignorée (ex : main en transition, contexte GPU momentanément
         indisponible). lastResultTs n'est pas mis à jour ici -> si ça
         persiste au-delà de WATCHDOG_STALL_MS, le watchdog réinitialisera
         le pipeline (voir reinitHands ci-dessous). */
      console.warn('[HandTrack] detectForVideo a échoué', e);
    }
  }

  /* Détruit puis recrée intégralement l'instance HandLandmarker, pour
     sortir d'un blocage persistant (ex : contexte WebGL du délégué GPU
     perdu après une mise en arrière-plan prolongée sur mobile) que le
     simple retour d'erreur de detectForVideo() ne suffit pas à réparer. */
  async function reinitHands(){
    if(reinitInProgress || !active) return;
    reinitInProgress = true;
    try{
      console.warn('[HandTrack] pipeline figé détecté — réinitialisation automatique');
      const old = handLandmarker;
      handLandmarker = null;
      lastVideoTime = -1;
      if(old && typeof old.close === 'function'){
        try{ old.close(); } catch(e){ /* ignore */ }
      }
      await loadModel();
      lastResultTs = performance.now(); // repousse l'échéance du watchdog pendant le rechargement
    } catch(e){
      console.warn('[HandTrack] échec de la réinitialisation automatique', e);
    } finally {
      reinitInProgress = false;
    }
  }

  function startWatchdog(){
    if(watchdogInterval) return;
    lastResultTs = performance.now();
    watchdogInterval = setInterval(()=>{
      if(!active || reinitInProgress) return;
      if(performance.now() - lastResultTs > WATCHDOG_STALL_MS){
        reinitHands();
      }
    }, WATCHDOG_CHECK_MS);
  }

  function stopWatchdog(){
    if(watchdogInterval){ clearInterval(watchdogInterval); watchdogInterval = null; }
  }

  function detectLoop(){
    /* Repli utilisé uniquement si requestVideoFrameCallback n'existe pas
       (anciens Safari/WebView). Reste cadencé par currentTime pour ne
       jamais lancer detectForVideo deux fois sur la même frame. */
    if(!active){ rafId=null; return; }
    rafId = requestAnimationFrame(detectLoop);
    runDetection();
  }

  function onVideoFrame(){
    if(!active) return;
    runDetection();
    vid.requestVideoFrameCallback(onVideoFrame);
  }

  /* ---------------------------------------------------------------
     RENDU — tourne en continu via requestAnimationFrame tant que le hand
     tracking est actif, à la cadence native de l'écran (60/90/120 Hz selon
     l'appareil), indépendamment de la cadence de détection. À chaque frame :
       1) on rapproche les 21 points affichés (dispLandmarks) des 21 points
          bruts (rawLandmarks) avec un lissage exponentiel dont le facteur
          dépend du temps écoulé réel (dt) — donc identique en fluidité
          perçue quel que soit le framerate de l'appareil ; le squelette et
          le curseur lisent ensuite les mêmes points lissés ;
       2) on reprojette cette position lissée à l'écran en utilisant des
          rects .eye mis en cache (pas de reflow forcé à chaque frame) ;
       3) on met à jour le curseur DOM/3D et on pilote grab/scale/clic sur
          des positions toujours à jour, donc un geste de glisser-déposer
          reste fluide même entre deux détections caméra.
     Entièrement inchangé par cette migration : opère uniquement sur
     rawHandsAll/dispHandsAll, quel que soit le moteur qui les alimente.
     --------------------------------------------------------------- */
  function updateHandRay(hs){
    var cookOv = document.getElementById('cooking-overlay');
    if(cookOv && cookOv.classList.contains('active')){ hs = null; }
    let ray = document.getElementById('handRayEl');
    if(!ray){
      ray = document.createElement('div');
      ray.id = 'handRayEl';
      ray.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;';
      document.body.appendChild(ray);
    }
    if(handInteractionMode === 'far' && hs){
      const cx = hs.pageX|0, cy = hs.pageY|0;
      const sx = (window.innerWidth*0.5)|0, sy = window.innerHeight;
      const dx = cx - sx, dy = cy - sy;
      const len = Math.max(Math.hypot(dx, dy), 1);
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      ray.style.display = 'block';
      ray.style.width = len + 'px';
      ray.style.height = '2px';
      ray.style.left = sx + 'px';
      ray.style.top = (sy - 1) + 'px';
      ray.style.transformOrigin = '0 0';
      ray.style.transform = 'rotate(' + ang + 'deg)';
      ray.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(100,200,255,0.6))';
      ray.style.borderRadius = '1px';
      ray.style.boxShadow = '0 0 3px rgba(100,200,255,0.3)';
    } else {
      ray.style.display = 'none';
    }
  }
  function renderLoop(ts){
    if(!active){ renderRafId=null; return; }
    renderRafId = requestAnimationFrame(renderLoop);

    const now = ts || performance.now();
    const dt = lastRenderTs ? Math.min(0.1, (now - lastRenderTs)/1000) : 0;
    lastRenderTs = now;

    const cursorL = document.getElementById('cursorL');
    const cursorR = document.getElementById('cursorR');

    if(!rawHandsAll.length){
      /* Aucune main détectée : curseur + squelette cachés, on relâche tout
         geste en cours. */
      if(handGrab.active) cancelHandGrabIfActive();
      if(handDepth.active) cancelHandDepthIfActive();
      if(handScroll.active) cancelHandScrollIfActive();
      if(handScale.active) cancelHandScaleIfActive();
      dispLandmarks = null;
      dispHandsAll.length = 0;
      pinchArmedAll.length = 0;
      pinchingAll.length = 0;
      activeHandIdx = 0;
      handScreen = null;
      updateHandRay(null);
      pinching = false; pinchArmed = true;
      pointing = false; openPalm = false; peaceSign = false;
      renderPrevPinching = false;
      updateCursorDOM(cursorL, 0, 0, false, false);
      updateCursorDOM(cursorR, 0, 0, false, false);
      update3DCursor('handCursorL', 0, 0, 1, 1, null, false);
      update3DCursor('handCursorR', 0, 0, 1, 1, null, false);
      drawHandSkeleton(null, null, 0, 0);
      return;
    }

    /* --- Lissage exponentiel des 21 points DE CHAQUE MAIN DÉTECTÉE
       (pas seulement du curseur) : indépendant du framerate,
       alpha = 1 - e^(-dt/tau). Chaque main a son propre historique lissé
       (dispHandsAll[i]). Le squelette dessine TOUTES les mains lissées ;
       seule la main ACTIVE (voir plus bas) pilote en plus le
       curseur/pinch/grab. --- */
    while(dispHandsAll.length > rawHandsAll.length){
      dispHandsAll.pop(); pinchArmedAll.pop(); pinchingAll.pop(); filtersAll.pop();
    }
    for(let hi=0; hi<rawHandsAll.length; hi++){
      const rawLm = rawHandsAll[hi].landmarks;
      const prevDisp = dispHandsAll[hi];

      const palmSize = Math.hypot(
        rawLm[0].x-rawLm[9].x, rawLm[0].y-rawLm[9].y, (rawLm[0].z||0)-(rawLm[9].z||0)
      );
      let validHand = palmSize > 0.02 && palmSize < 0.5;
      if(validHand && prevDisp && prevDisp.length === rawLm.length){
        const prevPalm = Math.hypot(
          prevDisp[0].x-prevDisp[9].x, prevDisp[0].y-prevDisp[9].y, prevDisp[0].z-prevDisp[9].z
        );
        if(prevPalm > 0.001 && (palmSize / prevPalm) > 3.0) validHand = false; // saut de taille > 3×
      }

      if(!prevDisp || prevDisp.length !== rawLm.length){
        /* Nouvelle main (ou changement de nombre de points) : on repart sur
           un historique de filtre propre pour éviter tout "saut" hérité
           d'une main précédente à cet index de tableau. */
        filtersAll[hi] = makeHandFilters();
        dispHandsAll[hi] = rawLm.map(p=>({x:p.x, y:p.y, z:p.z||0}));
      } else if(dt > 0 && validHand){
        if(!filtersAll[hi]) filtersAll[hi] = makeHandFilters();
        const fh = filtersAll[hi];
        for(let i=0;i<rawLm.length;i++){
          prevDisp[i].x = fh[i].x(rawLm[i].x, now/1000);
          prevDisp[i].y = fh[i].y(rawLm[i].y, now/1000);
          prevDisp[i].z = fh[i].z(rawLm[i].z||0, now/1000);
        }
      }
      if(pinchArmedAll[hi] === undefined) pinchArmedAll[hi] = true;
      const dl = dispHandsAll[hi];
      const tiDist = Math.hypot(dl[4].x - dl[8].x, dl[4].y - dl[8].y);
      if(pinchArmedAll[hi] && tiDist < 0.035){ pinchingAll[hi] = true; pinchArmedAll[hi] = false; }
      else if(!pinchArmedAll[hi] && tiDist > 0.06){ pinchingAll[hi] = false; pinchArmedAll[hi] = true; }
      if(pinchingAll[hi] === undefined) pinchingAll[hi] = false;
    }

    /* --- Choix de la main ACTIVE (celle qui pilote le curseur unique) :
       priorité à une main déjà active si elle est toujours détectée (évite
       de sauter d'une main à l'autre sans raison à chaque frame), sinon à
       la main en train de pincer, sinon la première main détectée. --- */
    if(activeHandIdx >= dispHandsAll.length) activeHandIdx = 0;
    let bestIdx = -1;
    for(let hi=0; hi<pinchingAll.length; hi++){ if(pinchingAll[hi]){ bestIdx = hi; break; } }
    if(bestIdx === -1) bestIdx = (activeHandIdx < dispHandsAll.length) ? activeHandIdx : 0;
    activeHandIdx = bestIdx;

    dispLandmarks = dispHandsAll[activeHandIdx];
    rawLandmarks = rawHandsAll[activeHandIdx].landmarks;

    const rects = getEyeRects();
    if(rects) drawHandSkeleton(dispHandsAll, rects, rawVW, rawVH);

    const wrist = dispLandmarks[0];
    const indexTip = dispLandmarks[8];
    const indexPip = dispLandmarks[6];
    const middleMcp = dispLandmarks[9];
    const thumbTip = dispLandmarks[4];

    /* --- HAND SPREAD (taille apparente → distance) pour le choix du mode --- */
    handSpread = Math.hypot(dispLandmarks[12].x - dispLandmarks[0].x, dispLandmarks[12].y - dispLandmarks[0].y);
    if(!window.__forceHandMode){
      if(handInteractionMode === 'far' && handSpread > 0.28) handInteractionMode = 'close';
      if(handInteractionMode === 'close' && handSpread < 0.22) handInteractionMode = 'far';
    } else { handInteractionMode = window.__forceHandMode; }

    /* --- CLIC : geste "index qui avance et se plie légèrement" (comme
       appuyer un bouton virtuel dans le vide), MÊME geste qu'on soit loin
       ou proche de la cible. pokeZ suit la profondeur relative (z) du
       bout de l'index par rapport au poignet ; pokeBaseline s'adapte
       lentement à la pose courante de la main tant qu'on ne clique pas
       (dérive naturelle), pour ne réagir qu'à un mouvement volontaire et
       assez rapide de l'index vers l'avant + repli. --- */
    const pokeZ = indexTip.z - wrist.z;
    if(pokeBaseline === undefined) pokeBaseline = pokeZ;
    if(!pinching){
      pokeBaseline += (pokeZ - pokeBaseline) * Math.min(1, dt * 2.0);
    }
    const pokeDelta = pokeZ - pokeBaseline;
    if(pinchArmed && pokeDelta > 0.07){ pinching = true; pinchArmed = false; }
    else if(!pinchArmed && pokeDelta < 0.02){ pinching = false; pinchArmed = true; }
    pointing = pokeDelta > 0.03;
    openPalm  = false;
    peaceSign = false;

    const palmPts = [dispLandmarks[0], dispLandmarks[5], dispLandmarks[9], dispLandmarks[13], dispLandmarks[17]];
    palmX = palmPts.reduce((s,p)=>s+p.x,0) / palmPts.length;
    palmY = palmPts.reduce((s,p)=>s+p.y,0) / palmPts.length;

    if(!rects) return;
    const posL = mapToEye(indexTip.x, indexTip.y, rawVW, rawVH, rects.L.width, rects.L.height);
    const posR = mapToEye(indexTip.x, indexTip.y, rawVW, rawVH, rects.R.width, rects.R.height);

    handScreen = { pageX: rects.L.left + posL.px, pageY: rects.L.top + posL.py };
    updateHandRay(handScreen);

    updateCursorDOM(cursorL, posL.px, posL.py, true, pinching, pointing);
    updateCursorDOM(cursorR, posR.px, posR.py, true, pinching, pointing);

    if(camL && camL.object3D) update3DCursor('handCursorL', posL.px, posL.py, rects.L.width, rects.L.height, camL.object3D, true);
    if(camR && camR.object3D) update3DCursor('handCursorR', posR.px, posR.py, rects.R.width, rects.R.height, camR.object3D, true);

    /* --- ZOOM / GRAB & MOVE : priorité au zoom si le pinch démarre sur
       une poignée de coin (.app-win-pinchzoom) ; sinon priorité au grab
       de fenêtre si le pinch démarre sur la poignée de drag ; sinon,
       comportement inchangé (clic instantané sur la cible sous le
       curseur, ex: boutons/dwell). Les deux gestes s'excluent
       mutuellement : tant que handScale.active est vrai, updateHandGrab
       n'est jamais appelée, et vice versa. Les fronts pinching/wasPinching
       sont évalués ICI (cadence d'affichage) pour un geste de
       glisser-déposer parfaitement fluide. --- */
    const wasPinching = renderPrevPinching;
    const grabbedBefore = handGrab.active;
    const scaledBefore = handScale.active;
    const scrolledBefore = handScroll.active;
    const depthBefore = handDepth.active;
    updateHandScale(pinching, wasPinching, handScreen);
    if(!handScale.active && !scaledBefore){
      updateHandGrab(pinching, wasPinching, handScreen);
    }
    if(pinching && !wasPinching && !handGrab.active && !grabbedBefore &&
       !handScale.active && !scaledBefore && !handScroll.active && !scrolledBefore &&
       !handDepth.active && !depthBefore &&
       window.__handTrackPinchClick){
      window.__handTrackPinchClick();
    }
    renderPrevPinching = pinching;
  }

  async function enableHandTrack(){
    if(loading || active) return;
    loading = true;
    btn.classList.add('loading');
    try{
      toast('🖐️ Chargement du suivi des mains…');
      await loadModel();
      /* Important : on affecte bien le retour à `vid`, sinon en mode
         passthrough (flux caméra réutilisé) la variable restait `null`
         et la boucle de détection ne se déclenchait jamais. */
      vid = await acquireVideo();
      active = true;
      state.handTrackActive = true;
      btn.classList.add('active');
      btn.classList.remove('loading');
      btn.innerHTML = '✋';
      loading = false;
      missStreak = 0;
      lastRenderTs = 0;
      rawLandmarks = null; dispLandmarks = null; pokeBaseline = undefined;
      rawHandsAll = []; dispHandsAll = []; pinchArmedAll = []; pinchingAll = []; filtersAll = []; activeHandIdx = 0;
      pointing = false; openPalm = false; peaceSign = false;
      /* Confirmateurs anti-mélange repartis sur un état propre à chaque
         activation, pour ne jamais hériter d'un tremblement de la session
         précédente. */
      confirmPointing   = makeConfirmer(3);
      confirmOpenPalm   = makeConfirmer(3);
      confirmPeaceSign  = makeConfirmer(3);
      confirmFistClosed = makeConfirmer(3);
      confirmFistOpen   = makeConfirmer(3);
      startWatchdog();
      getEyeRects(true); // pré-calcule les rects avant le premier rendu
      ensureSkeletonCanvas();
      resizeSkeletonCanvas(); // au cas où l'écran ait tourné pendant que c'était masqué
      skeletonCanvas.style.display = 'block';
      setStatus('🔎 Recherche de votre main…');
      /* Détection : requestVideoFrameCallback si dispo (se déclenche
         exactement à l'arrivée d'une nouvelle frame caméra, pas de tick
         "gaspillé"), sinon repli rAF classique. */
      if(vid && typeof vid.requestVideoFrameCallback === 'function'){
        vid.requestVideoFrameCallback(onVideoFrame);
      } else {
        detectLoop();
      }
      /* Rendu : boucle indépendante à la cadence d'affichage. */
      renderRafId = requestAnimationFrame(renderLoop);
      toast(usingGPU ? '🖐️ Suivi des mains activé (GPU)' : '🖐️ Suivi des mains activé (CPU)');
    } catch(err){
      loading = false;
      btn.classList.remove('loading');
      console.warn('[HandTrack]', err);
      toast('❌ Suivi des mains indisponible — '+(err.message||err));
    }
  }

  function disableHandTrack(){
    active = false;
    state.handTrackActive = false;
    stopWatchdog();
    if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
    if(renderRafId){ cancelAnimationFrame(renderRafId); renderRafId=null; }
    releaseOwnVideo();
    cancelHandGrabIfActive();
    cancelHandDepthIfActive();
    cancelHandScrollIfActive();
    cancelHandScaleIfActive();
    handVisible = false; pinching = false; pinchArmed = true; renderPrevPinching = false;
    pointing = false; openPalm = false; peaceSign = false;
    rawLandmarks = null; dispLandmarks = null; handScreen = null;
    rawHandsAll = []; dispHandsAll = []; pinchArmedAll = []; pinchingAll = []; filtersAll = []; activeHandIdx = 0;
    updateHandRay(null);
    const rayEl=document.getElementById('handRayEl');
    if(rayEl) rayEl.remove();
    updateCursorDOM(document.getElementById('cursorL'), 0, 0, false, false);
    updateCursorDOM(document.getElementById('cursorR'), 0, 0, false, false);
    update3DCursor('handCursorL', 0, 0, 1, 1, null, false);
    update3DCursor('handCursorR', 0, 0, 1, 1, null, false);
    btn.classList.remove('active');
    btn.innerHTML = '🖐️';
    missStreak = 0;
    setStatus(null);
    if(skeletonCtx && skeletonCanvas){ skeletonCtx.clearRect(0,0,window.innerWidth, window.innerHeight); }
    if(skeletonCanvas) skeletonCanvas.style.display = 'none';
    toast('🖐️ Suivi des mains désactivé');
  }

  btn.addEventListener('click', ()=>{ if(active) disableHandTrack(); else enableHandTrack(); });
  window.toggleHandTrack = ()=>{ if(active) disableHandTrack(); else enableHandTrack(); };

  /* Les 21 points de la main (dispLandmarks, lissés) reprojetés dans le
     repère "plein écran" (0..1) avec exactement le même recadrage "cover"
     que celui appliqué au flux vidéo réel (mapToEye) — c'est ce qui
     garantit que le squelette transmis à Web Hero (voir setupWebHeroBridge
     ci-dessous) tombe pile à la même hauteur/distance apparente que la
     main vue à travers la caméra du portail, sans distorsion d'aspect. */
  function getBridgeLandmarks(){
    if(!dispLandmarks || !rawVW || !rawVH) return null;
    const w = window.innerWidth, h = window.innerHeight;
    if(!w || !h) return null;
    return dispLandmarks.map(p=>{
      const m = mapToEye(p.x, p.y, rawVW, rawVH, w, h);
      return { x: m.px / w, y: m.py / h, z: p.z || 0 };
    });
  }

  /* Comme getBridgeLandmarks() mais pour TOUTES les mains détectées (0 ou 1
     avec numHands:1), même reprojection "cover" par point. Permet à Web
     Hero de dessiner un squelette pour chaque main levée — voir
     handTracking.js côté Web Hero. */
  function getAllBridgeHands(){
    if(!rawVW || !rawVH || !dispHandsAll.length) return [];
    const w = window.innerWidth, h = window.innerHeight;
    if(!w || !h) return [];
    return dispHandsAll.map((lm)=> lm.map(p=>{
      const m = mapToEye(p.x, p.y, rawVW, rawVH, w, h);
      return { x: m.px / w, y: m.py / h, z: p.z || 0 };
    }));
  }

  /* API exposée pour gazeTick() et pour la couche de navigation globale
     (handTracking.js / handPointer.js) : position écran courante du
     curseur main (page coords), et si une main est actuellement détectée.
     FORMAT IDENTIQUE à l'ancien moteur @mediapipe/hands — rien à changer
     dans les fichiers qui consomment cette API. */
  window.__handTrackAPI = {
    get isActive(){ return active && handVisible; },
    get screen(){ return handScreen; },
    get pinching(){ return pinching; },
    get pointing(){ return pointing; },
    get openPalm(){ return openPalm; },
    get mode(){ return handInteractionMode; },
    get handSpread(){ return handSpread; },
    /* Squelette complet (21 points, {x,y,z} normalisés 0..1, repère plein
       écran, même recadrage "cover" que la caméra) — utilisé par le pont
       Web Hero pour reconstruire un squelette précis (chaque doigt + chaque
       pliure), et non plus un simple point de curseur. */
    get landmarks(){ return getBridgeLandmarks(); },
    /* Nombre de mains actuellement détectées (0 ou 1, voir numHands:1
       ci-dessus) + squelette de CHACUNE (voir getAllBridgeHands ci-dessus). */
    get handCount(){ return dispHandsAll.length; },
    get allHands(){ return getAllBridgeHands(); },
    get activeHandIndex(){ return activeHandIdx; },
    /* Nouveau : expose si la délégation GPU a pu être activée, utile pour
       du diagnostic/affichage de debug côté UI si besoin. */
    get usingGPU(){ return usingGPU; }
  };
})();
