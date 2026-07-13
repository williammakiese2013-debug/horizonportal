/* ============================================================
   PASSTHROUGH — Caméra réelle en fond (mode réalité mixte)
   ============================================================ */
(function setupPassthrough(){
  /* Vidéo cachée — on la dessine dans un canvas 2D par-dessus chaque oeil */
  const vid = document.createElement('video');
  vid.id = 'passthroughVideo';
  vid.setAttribute('playsinline','');
  vid.setAttribute('webkit-playsinline','');
  vid.muted = true;
  vid.autoplay = true;
  document.body.insertBefore(vid, document.body.firstChild);

  /* Bouton passthrough */
  const btn = document.createElement('button');
  btn.id = 'passthroughBtn';
  btn.className = 'passthrough-btn';
  btn.title = 'Mode Passthrough (caméra réelle)';
  btn.innerHTML = '📷';
  btn.setAttribute('aria-label','Activer le passthrough caméra');
  document.body.appendChild(btn);

  let stream = null;
  let active = false;
  let rafId = null;

  /* Un canvas par oeil, créé dynamiquement et inséré EN PREMIER dans chaque .eye */
  function makeEyeCanvas(eye){
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;border-radius:inherit;';
    eye.insertBefore(cv, eye.firstChild);
    return cv;
  }

  let cvL = null, cvR = null;

  function drawFrame(){
    if(!active){ rafId=null; return; }
    rafId = requestAnimationFrame(drawFrame);
    if(vid.readyState < 2) return;
    const vw = vid.videoWidth, vh = vid.videoHeight;
    if(!vw||!vh) return;
    [cvL, cvR].forEach(cv=>{
      if(!cv) return;
      const el = cv.parentElement;
      const w = el.offsetWidth, h = el.offsetHeight;
      if(!w||!h) return;
      if(cv.width!==w) cv.width=w;
      if(cv.height!==h) cv.height=h;
      const ctx = cv.getContext('2d');
      const scale = Math.max(w/vw, h/vh);
      const sw=w/scale, sh=h/scale, sx=(vw-sw)/2, sy=(vh-sh)/2;
      ctx.drawImage(vid, sx,sy,sw,sh, 0,0,w,h);
    });
  }

  async function enablePassthrough(){
    try{
      stream = await window.HorizonMedia.getCameraStream({
        video:{ facingMode:'environment', width:{ideal:1920}, height:{ideal:1080} }
      });
      vid.srcObject = stream;
      await vid.play();

      /* Créer les canvas par-dessus les yeux */
      cvL = makeEyeCanvas(document.getElementById('eyeLeft'));
      cvR = makeEyeCanvas(document.getElementById('eyeRight'));

      /* Cacher les skybox */
      ['skyL','skyR'].forEach(id=>{
        const s=document.getElementById(id);
        if(s) s.setAttribute('visible','false');
      });

      /* Sécurité : force le clear color du renderer WebGL à transparent total,
         pour garantir que le fond laisse passer le flux caméra sans aucun voile blanc */
      ['eyeLeft','eyeRight'].forEach(id=>{
        const sceneEl = document.querySelector('#'+id+' a-scene');
        if(sceneEl && sceneEl.renderer){
          sceneEl.renderer.setClearColor(0x000000, 0);
        } else if(sceneEl){
          sceneEl.addEventListener('renderstart', ()=>{
            sceneEl.renderer.setClearColor(0x000000, 0);
          }, { once:true });
        }
      });

      document.body.classList.add('passthrough-active');
      active = true;
      drawFrame();

      btn.classList.add('active');
      btn.innerHTML = '🌐';
      toast('📷 Passthrough activé');
    } catch(err){
      console.warn('[Passthrough]', err);
      toast('❌ Caméra inaccessible — '+(err.message||err));
    }
  }

  function disablePassthrough(){
    active = false;
    if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
    if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
    vid.srcObject = null;

    /* Supprimer les canvas */
    [cvL, cvR].forEach(cv=>{ if(cv&&cv.parentElement) cv.parentElement.removeChild(cv); });
    cvL=null; cvR=null;

    document.body.classList.remove('passthrough-active');

    /* Restaurer skyboxes */
    ['skyL','skyR'].forEach(id=>{
      const s=document.getElementById(id);
      if(s) s.setAttribute('visible','true');
    });

    btn.classList.remove('active');
    btn.innerHTML = '📷';
    toast('🌐 Passthrough désactivé');
  }

  btn.addEventListener('click', ()=>{ if(active) disablePassthrough(); else enablePassthrough(); });
  window.togglePassthrough = ()=>{ if(active) disablePassthrough(); else enablePassthrough(); };

  /* Exposé pour que le module Hand Tracking puisse réutiliser ce flux caméra
     (évite de demander l'accès caméra deux fois quand le passthrough est actif) */
  window.__passthroughAPI = {
    get active(){ return active; },
    get video(){ return vid; },
    get stream(){ return stream; }
  };
})();

