/* ============================================================
   DRONE SPATIAL — bruit de fond vaisseau / ordinateur futur
   Démarre au premier tap (politique autoplay navigateur)
   ============================================================ */
(function(){
  var _actx = null;
  var _started = false;

  function buildDrone(ctx){
    var masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 6); // fondu doux 6s
    masterGain.connect(ctx.destination);

    // --- Couche 1 : sous-fondamental très grave (40 Hz) ---
    var sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(40, ctx.currentTime);
    // légère dérive lente pour "respiration" mécanique
    sub.frequency.linearRampToValueAtTime(41.2, ctx.currentTime + 8);
    sub.frequency.linearRampToValueAtTime(39.5, ctx.currentTime + 16);
    sub.frequency.linearRampToValueAtTime(40.8, ctx.currentTime + 24);
    var subGain = ctx.createGain();
    subGain.gain.value = 0.55;
    sub.connect(subGain); subGain.connect(masterGain);
    sub.start();

    // --- Couche 2 : harmonique moteur (80 Hz) ---
    var eng = ctx.createOscillator();
    eng.type = 'sawtooth';
    eng.frequency.setValueAtTime(80, ctx.currentTime);
    eng.frequency.linearRampToValueAtTime(80.6, ctx.currentTime + 11);
    eng.frequency.linearRampToValueAtTime(79.8, ctx.currentTime + 22);
    var engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 200;
    engFilter.Q.value = 0.8;
    var engGain = ctx.createGain();
    engGain.gain.value = 0.18;
    eng.connect(engFilter); engFilter.connect(engGain); engGain.connect(masterGain);
    eng.start();

    // --- Couche 3 : bruit blanc filtré très grave (texture "air") ---
    var bufSize = ctx.sampleRate * 4;
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for(var i=0;i<bufSize;i++) data[i]=(Math.random()*2-1);
    var noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    var noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 60;
    noiseFilter.Q.value = 0.4;
    var noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.12;
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(masterGain);
    noise.start();

    // --- Couche 4 : pulsation LFO lente sur le sub (battement cosmique) ---
    var lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07; // 1 battement toutes ~14s
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain); lfoGain.connect(masterGain.gain);
    lfo.start();

    // --- Couche 5 : shimmer haute fréquence très discret (2 kHz) ---
    var shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1960, ctx.currentTime);
    shimmer.frequency.linearRampToValueAtTime(2020, ctx.currentTime + 13);
    shimmer.frequency.linearRampToValueAtTime(1980, ctx.currentTime + 26);
    var shimGain = ctx.createGain();
    shimGain.gain.value = 0.008;
    shimmer.connect(shimGain); shimGain.connect(masterGain);
    shimmer.start();
  }

  function startDrone(){
    if(_started) return;
    _started = true;
    try{
      _actx = new (window.AudioContext || window.webkitAudioContext)();
      if(_actx.state === 'suspended') _actx.resume();
      buildDrone(_actx);
    }catch(e){}
  }

  // Démarrer au premier tap utilisateur (requis par les navigateurs mobiles)
  document.addEventListener('click', startDrone, {once:true});
  document.addEventListener('touchstart', startDrone, {once:true});
})();

