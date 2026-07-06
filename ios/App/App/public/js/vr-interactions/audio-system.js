/* ============================================================
   Système Audio VR — Web Audio API (synthèse, aucun fichier externe)
   Style Apple Vision Pro : sons feutrés, ultra-subtils
   ============================================================ */
let _audioCtx = null;

function _getAudioCtx(){
  if(!_audioCtx){
    try{ _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(_){ return null; }
  }
  /* Reprendre si suspendu (politique autoplay navigateur) */
  if(_audioCtx.state === 'suspended') _audioCtx.resume().catch(()=>{});
  return _audioCtx;
}

/* Survol — léger "pousse" aigu : 800→600 Hz en 0.02s, volume 0.03 */
function playAppleHover(){
  const ctx = _getAudioCtx();
  if(!ctx) return;
  try{
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.02);
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.025);
    osc.start(t);
    osc.stop(t + 0.03);
  }catch(_){}
}

/* Clic / validation — "pop" feutré satisfaisant : 1200→400 Hz en 0.04s, volume 0.15 */
function playAppleClick(){
  const ctx = _getAudioCtx();
  if(!ctx) return;
  try{
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.055);
    osc.start(t);
    osc.stop(t + 0.06);
  }catch(_){}
}

/* ============================================================
   Son de navigation URL — "Tension / Fréquence radio"
   Déclenché à chaque chargement de page (browserNavigate)
   Effet : balayage FM + bruit blanc filtré + oscillation descendante
   ============================================================ */
function playNavSound(){
  const ctx = _getAudioCtx();
  if(!ctx) return;
  try{
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.4);
    master.connect(ctx.destination);

    // Couche 1 : balayage de fréquence "radio qui cherche" (2200→180 Hz)
    const sweep = ctx.createOscillator();
    sweep.type = 'sawtooth';
    const t = ctx.currentTime;
    sweep.frequency.setValueAtTime(2200, t);
    sweep.frequency.exponentialRampToValueAtTime(300, t + 0.35);
    sweep.frequency.exponentialRampToValueAtTime(900, t + 0.55);
    sweep.frequency.exponentialRampToValueAtTime(180, t + 1.1);
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 0.35;
    const sweepFilter = ctx.createBiquadFilter();
    sweepFilter.type = 'bandpass';
    sweepFilter.frequency.setValueAtTime(1200, t);
    sweepFilter.frequency.linearRampToValueAtTime(400, t + 0.8);
    sweepFilter.Q.value = 3;
    sweep.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(master);
    sweep.start(t);
    sweep.stop(t + 1.4);

    // Couche 2 : bruit blanc style "static radio"
    const bufSize = ctx.sampleRate * 1.4;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) data[i]=(Math.random()*2-1);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3000, t);
    noiseFilter.frequency.linearRampToValueAtTime(600, t + 0.9);
    noiseFilter.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, t);
    noiseGain.gain.linearRampToValueAtTime(0, t + 1.2);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(t);

    // Couche 3 : "whoosh" numérique (basse fréquence, pulse rapide)
    const pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.setValueAtTime(55, t);
    pulse.frequency.linearRampToValueAtTime(30, t + 0.6);
    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(0.12, t);
    pulseGain.gain.linearRampToValueAtTime(0, t + 0.5);
    pulse.connect(pulseGain);
    pulseGain.connect(master);
    pulse.start(t);
    pulse.stop(t + 0.6);
  }catch(_){}
}

/* ============================================================
   Son de clavier rétro-futuriste — machine à écrire de l'espace
   Déclenché à chaque touche du VKB
   Effet : clic mécanique + tonalité terminale courte
   ============================================================ */
function playKeySound(){
  const ctx = _getAudioCtx();
  if(!ctx) return;
  try{
    const t = ctx.currentTime;

    // Impact mécanique : bruit blanc très court (clac)
    const bufSize = Math.floor(ctx.sampleRate * 0.025);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) data[i]=(Math.random()*2-1)*Math.pow(1-(i/bufSize),2);
    const clac = ctx.createBufferSource();
    clac.buffer = buf;
    const clacFilter = ctx.createBiquadFilter();
    clacFilter.type = 'highpass';
    clacFilter.frequency.value = 2200;
    const clacGain = ctx.createGain();
    clacGain.gain.setValueAtTime(0.22, t);
    clacGain.gain.linearRampToValueAtTime(0, t + 0.025);
    clac.connect(clacFilter);
    clacFilter.connect(clacGain);
    clacGain.connect(ctx.destination);
    clac.start(t);

    // Tonalité terminal courte (bip) — varie légèrement à chaque frappe
    const freq = 680 + Math.random() * 240;
    const bip = ctx.createOscillator();
    bip.type = 'square';
    bip.frequency.setValueAtTime(freq, t);
    bip.frequency.linearRampToValueAtTime(freq * 0.7, t + 0.04);
    const bipFilter = ctx.createBiquadFilter();
    bipFilter.type = 'lowpass';
    bipFilter.frequency.value = 1800;
    const bipGain = ctx.createGain();
    bipGain.gain.setValueAtTime(0.04, t);
    bipGain.gain.linearRampToValueAtTime(0, t + 0.045);
    bip.connect(bipFilter);
    bipFilter.connect(bipGain);
    bipGain.connect(ctx.destination);
    bip.start(t);
    bip.stop(t + 0.05);
  }catch(_){}
}

/* ------------ First tap + WebXR Hand Tracking permission ------------ */
async function firstTap(){
  /* 0. AudioContext — DOIT être créé/réveillé en tout premier, de façon
     synchrone, avant tout `await`. Sur Safari iOS, le "geste utilisateur"
     qui autorise le son ne survit pas à un await (permission gyroscope,
     plein écran, etc.) : si on réveille l'audio après ces await, le
     contexte reste "suspended" pour de bon et TOUS les sons de l'appli
     (clic, survol, clavier…) restent silencieux. On le fait donc ici,
     immédiatement, avant quoi que ce soit d'asynchrone. */
  try{ _getAudioCtx(); }catch(_){}

  /* 1. Gyroscope iOS */
  try{
    const D = window.DeviceOrientationEvent;
    if(D && typeof D.requestPermission === 'function'){
      await D.requestPermission();
    }
  }catch(_){}

  /* 2. Plein écran */
  try{ await document.documentElement.requestFullscreen?.(); }catch(_){}

  /* 3. Orientation paysage */
  try{
    await screen.orientation?.lock?.('landscape');
    document.documentElement.dataset.orientationLocked = '1';
  }catch(_){}

  /* 4. Déverrouillage audio/vidéo */
  let unlockVid = document.getElementById('userVid');
  if(!unlockVid){
    unlockVid = document.createElement('video');
    unlockVid.id = 'userVid';
    unlockVid.setAttribute('playsinline','');
    unlockVid.setAttribute('webkit-playsinline','');
    unlockVid.muted = true;
    unlockVid.crossOrigin = 'anonymous';
    document.body.appendChild(unlockVid);
  }
  unlockVid.play().then(()=>{ unlockVid.pause(); unlockVid.currentTime = 0; }).catch(()=>{});

  /* 5. AudioContext (re-vérification : on s'assure qu'il est bien "running"
     après tous les await ci-dessus, au cas où le navigateur l'aurait
     re-suspendu entre-temps) */
  _getAudioCtx();

  /* 6. WebXR Hand Tracking — demande de permission camera/capteurs
     On ouvre puis ferme immédiatement une session immersive-vr avec hand-tracking.
     Le seul but est de déclencher le prompt de permission système (caméra, capteurs).
     A-Frame prendra ensuite le relais pour la session réelle. */
  /* 6. Permission caméra navigateur — requis pour activer le Hand Tracking WebXR
     getUserMedia() déclenche le prompt "Autoriser l'accès à la caméra" du navigateur.
     Sans ce prompt accepté, le hand tracking reste bloqué même si le casque le supporte. */
  (async function requestCameraPermission(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ return; }
    try{
      /* Demande l'accès caméra pour déclencher le prompt système */
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      /* Couper immédiatement les tracks : on n'a besoin que de la permission */
      stream.getTracks().forEach(t => t.stop());
      toast('✋ Caméra autorisée — Hand Tracking actif');
    } catch(err){
      console.warn('[HandTracking] Permission caméra refusée :', err.message || err);
      /* Pas bloquant : certains navigateurs XR n'ont pas besoin de ce prompt */
      toast('ℹ️ Caméra non autorisée — Hand Tracking peut être limité');
    }
  })();

  state.primed = true;
  setTimeout(() => {
    if(camL.object3D){ state.initYaw = camL.object3D.rotation.y; state.initPitch = camL.object3D.rotation.x; positionFlatScreen(); }
    /* Geler les onglets HUD à la position initiale */
    _prevLocked = null; // force re-freeze au prochain tick
    if(state.locked) setTimeout(freezeHUDNow, 50);
  }, 300);
  $('firstTap').remove();
}

/* ------------ Live clock ------------ */
setInterval(()=>{ if(state.panel==='dock') renderHUD(); }, 30000);

