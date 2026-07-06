/* ============================================================
   WEB HERO — pont hand tracking Horizon -> jeu embarqué (iframe)
   ============================================================
   Le jeu "Web Hero" (webhero/index.html) a SA PROPRE détection de main
   (caméra arrière, MediaPipe) quand il tourne seul. Embarqué ici dans le
   Game Launcher, on lui évite d'ouvrir une 2e caméra (impossible/inutile
   puisque le portail Horizon en a déjà une active) : on relaie en continu
   l'état de main DÉJÀ suivi par le portail (window.__handTrackAPI) vers
   l'iframe via postMessage, sous une forme compatible avec le format
   interne attendu par le jeu (voir js/handTracking.js du jeu, fonction
   applyExternalHandState).
   Limites honnêtes : le portail Horizon ne détecte que pinch / index tendu
   (pointing) / paume ouverte (openPalm), pas de poing fermé ni de signe
   "Spider-Man" dédiés. On approxime donc le poing fermé (utilisé en Mode
   Combat par le jeu) à partir de l'écartement de main (handSpread) quand
   aucun autre geste n'est reconnu — un signal honnête mais approximatif.
   La vélocité (utilisée par le jeu pour le saut et la puissance du coup de
   poing) est calculée ici à partir du déplacement du curseur main d'une
   frame à l'autre (le portail Horizon ne l'expose pas nativement). */
(function setupWebHeroBridge(){
  let bridgeRafId = null;
  let prevPos = null;   // {x,y,t} en coordonnées normalisées (0..1)
  let lastPinch = false;

  function getFrame(){ return document.getElementById('webhero-frame'); }

  function computeExternalHandState(){
    const api = window.__handTrackAPI;
    const now = performance.now()/1000;
    if(!api || !api.isActive || !api.screen){
      prevPos = null;
      return { visible:false, pinching:false, pointing:false, openPalm:false,
        fist:false, spiderSign:false, tap:false, indexTip:null, landmarks:null,
        allHands:[], velocity:{x:0,y:0,z:0,speed:0} };
    }

    const nx = Math.max(0, Math.min(1, api.screen.pageX / window.innerWidth));
    const ny = Math.max(0, Math.min(1, api.screen.pageY / window.innerHeight));

    let vx=0, vy=0, speed=0;
    if(prevPos){
      const dt = Math.max(now - prevPos.t, 1/120);
      vx = (nx - prevPos.x) / dt;
      vy = -((ny - prevPos.y) / dt); // vers le haut = positif, comme le jeu
      speed = Math.hypot(vx, vy);
    }
    prevPos = { x:nx, y:ny, t:now };

    // Poing fermé (Mode Combat du jeu) approximé : aucun geste reconnu par
    // le portail + main resserrée (handSpread faible). Voir note ci-dessus.
    const fist = !api.pinching && !api.pointing && !api.openPalm && (api.handSpread||0) < 0.16 && (api.handSpread||0) > 0;

    /* Squelette complet (21 points, coordonnées 0..1 plein écran, déjà
       recadrées "cover" comme la caméra — voir getBridgeLandmarks()) : permet
       à Web Hero de dessiner un vrai squelette (chaque doigt + chaque
       pliure), superposé à la bonne hauteur/distance, plutôt qu'un point
       de curseur unique. Repli sur un point unique (juste indexTip) si le
       portail n'a pas encore de squelette lissé disponible (1re frame). */
    const landmarks = (typeof api.landmarks !== 'undefined') ? api.landmarks : null;
    /* Squelettes des DEUX mains (si détectées) — voir getAllBridgeHands()
       côté portail. handTracking.js (Web Hero) s'en sert pour dessiner
       chaque main levée, en plus de `landmarks` (main active, inchangé
       pour compatibilité avec le code existant). */
    const allHands = (typeof api.allHands !== 'undefined') ? api.allHands : [];

    return {
      visible: true,
      pinching: !!api.pinching,
      pointing: !!api.pointing,
      openPalm: !!api.openPalm,
      fist: fist,
      spiderSign: false, // non détecté par le portail Horizon
      tap: !!api.pinching && !lastPinch, // front montant du pinch = clic virtuel
      indexTip: { x: nx, y: ny },
      landmarks: landmarks,
      allHands: allHands,
      velocity: { x: vx, y: vy, z: 0, speed: speed },
    };
  }

  function sendState(){
    const frame = getFrame();
    if(!frame || !frame.contentWindow) return;
    const state = computeExternalHandState();
    try{
      frame.contentWindow.postMessage(Object.assign({ type:'horizon-hand-state' }, state), '*');
    }catch(_){}
    lastPinch = state.pinching;
  }

  function bridgeTick(){
    sendState();
    bridgeRafId = requestAnimationFrame(bridgeTick);
  }

  window.openWebHero = function(){
    const hud = document.getElementById('webhero-hud');
    const frame = getFrame();
    if(!hud || !frame) return;
    if(!frame.getAttribute('src')){
      frame.setAttribute('src','webhero/index.html');
    }
    hud.classList.add('active');
    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.opacity='0';
    });
    if(window.__handTrackAPI && !window.__handTrackAPI.isActive && typeof window.toggleHandTrack==='function'){
      window.toggleHandTrack();
    }
    prevPos = null; lastPinch = false;
    cancelAnimationFrame(bridgeRafId);
    bridgeRafId = requestAnimationFrame(bridgeTick);
    if(typeof toast==='function') toast("🕸️ Web Hero — pince = tir de toile, index tendu = avancer, paume ouverte = piloter/sauter");
  };

  window.closeWebHero = function(){
    cancelAnimationFrame(bridgeRafId);
    bridgeRafId = null;
    prevPos = null;
    const hud = document.getElementById('webhero-hud');
    if(hud) hud.classList.remove('active');
    const frame = getFrame();
    if(frame) frame.removeAttribute('src'); // stoppe le moteur du jeu à la fermeture
    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.opacity='';
    });
  };

  /* Le jeu signale qu'il est prêt (voir js/handTracking.js du jeu) : on lui
     envoie tout de suite une 1ère trame pour réduire la latence initiale. */
  window.addEventListener('message', function(ev){
    const d = ev.data;
    if(d && d.type === 'webhero-ready'){
      const frame = getFrame();
      if(frame && frame.contentWindow === ev.source) sendState();
    }
  });
})();

/* ------------ Boot ------------ */
$('firstTap').addEventListener('click', firstTap);
renderHUD();
requestAnimationFrame(tickCam);
requestAnimationFrame(gazeTick);

