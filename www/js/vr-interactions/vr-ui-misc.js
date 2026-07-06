/* ============================================================
   Menu de calibration VR (taille / écartement / arrondi)
   ============================================================ */
(function setupCalibration(){
  const root  = document.documentElement;
  const btn   = document.getElementById('calibBtn');
  const panel = document.getElementById('calibPanel');
  const reset = document.getElementById('calibReset');

  ['pointerdown','touchstart','mousedown','click'].forEach(ev=>{
    btn.addEventListener(ev, e=>e.stopPropagation());
    panel.addEventListener(ev, e=>e.stopPropagation());
  });

  btn.addEventListener('click', ()=> panel.classList.toggle('open'));
  document.addEventListener('click', e=>{
    if(panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn){
      panel.classList.remove('open');
    }
  });

  const defaults = { '--lens-spacing':-56, '--lens-size':85, '--lens-radius':40,
    screenWidth:2.4, screenHeight:1.35, screenDistance:3.5, uiDepth:0 };

  function bind(rangeId, varName, unit, labelId){
    const input = document.getElementById(rangeId);
    const label = document.getElementById(labelId);
    const apply = ()=>{
      const v = input.value + unit;
      root.style.setProperty(varName, v);
      if(label) label.textContent = v;
      try{ localStorage.setItem('calib:'+varName, input.value); }catch(_){}
    };
    try{
      const saved = localStorage.getItem('calib:'+varName);
      if(saved !== null) input.value = saved;
    }catch(_){}
    apply();
    input.addEventListener('input', apply);
    return { input, apply };
  }

  const ctrls = {
    '--lens-spacing': bind('rngSpacing', '--lens-spacing', 'px', 'valSpacing'),
    '--lens-size'   : bind('rngSize',    '--lens-size',    '%',  'valSize'),
    '--lens-radius' : bind('rngRadius',  '--lens-radius',  'px', 'valRadius'),
  };

  function bindScreen(rangeId, key, unit, labelId){
    const input = document.getElementById(rangeId);
    const label = document.getElementById(labelId);
    const apply = ()=>{
      const v = input.value + unit;
      if(label) label.textContent = v;
      try{ localStorage.setItem('calib:'+key, input.value); }catch(_){}
      if(state.cinemaMode && state.screenMedia){
        showFlatScreen(state.screenMedia);
        positionFlatScreen();
      }
    };
    try{
      const saved = localStorage.getItem('calib:'+key);
      if(saved !== null) input.value = saved;
    }catch(_){}
    apply();
    input.addEventListener('input', apply);
    ctrls[key] = { input, apply };
  }

  bindScreen('rngScreenWidth', 'screenWidth', 'm', 'valScreenWidth');
  bindScreen('rngScreenHeight', 'screenHeight', 'm', 'valScreenHeight');
  bindScreen('rngScreenDistance', 'screenDistance', 'm', 'valScreenDistance');

  /* --- Distance de l'interface (dock, fenêtres, launchpad, etc.) --- */
  (function bindUiDepth(){
    const input = document.getElementById('rngUiDepth');
    const label = document.getElementById('valUiDepth');
    const apply = (v)=>{
      if(v === undefined) v = parseInt(input.value, 10) || 0;
      state.uiDepthExtra = v;
      ['valUiDepth','settingsDepthVal'].forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.textContent = (v>=0?'+':'')+v+'px';
      });
      ['rngUiDepth','settingsRngDepth'].forEach(id=>{
        const el=document.getElementById(id);
        if(el && el.value !== undefined) el.value = v;
      });
      try{ localStorage.setItem('calib:uiDepth', String(v)); }catch(_){}
      renderHUD();
    };
    try{
      const saved = localStorage.getItem('calib:uiDepth');
      if(saved !== null) input.value = saved;
    }catch(_){}
    apply();
    input.addEventListener('input', ()=>apply());
    /* Écoute déléguée pour le slider #settingsRngDepth créé dynamiquement dans buildSettingsHTML */
    document.addEventListener('input', function(e){
      if(e.target.id === 'settingsRngDepth') apply(parseInt(e.target.value,10)||0);
    });
    ctrls.uiDepth = { input, apply };
  })();

  reset.addEventListener('click', ()=>{
    for(const [varName, def] of Object.entries(defaults)){
      const ctrl = ctrls[varName];
      if(ctrl){ ctrl.input.value = def; ctrl.apply(); }
    }
  });
})();

/* ============================================================
   Resize fenêtre app (drag le coin ⇲)
   ============================================================ */
(function setupResize(){
  let resizing = false, startX=0, startY=0, startW=0, startH=0;

  function getWinEl(){
    // Chercher dans appWindowCenterL en priorité
    const wc = document.getElementById('appWindowCenterL');
    return wc ? wc.querySelector('#appWinEl') : null;
  }

  function onStart(cx,cy){
    const el = getWinEl();
    if(!el) return;
    resizing = true;
    startX = cx; startY = cy;
    startW = el.offsetWidth;
    startH = el.offsetHeight;
    el.style.transition = 'none';
  }
  function onMove(cx,cy){
    if(!resizing) return;
    const el = getWinEl();
    if(!el) return;
    const dw = (cx - startX)*2;  // *2 car centré
    const dh = (cy - startY)*2;
    const nw = Math.max(320, startW + dw);
    const nh = Math.max(200, startH + dh);
    el.style.width = nw+'px';
    el.style.height = nh+'px';
    // Sync le nf-root à l'intérieur si Netflix
    const nr = el.querySelector('.nf-root');
    if(nr){ nr.style.width = nw+'px'; nr.style.height = (nh-44)+'px'; }
    // Sync right eye
    const wcR = document.getElementById('appWindowCenterR');
    if(wcR){
      const elR = wcR.querySelector('[id="appWinEl"]') || wcR.querySelector('.app-window,.netflix-win,.maison-root');
      if(elR){
        elR.style.width = nw+'px';
        elR.style.height = nh+'px';
        const nrR = elR.querySelector('.nf-root');
        if(nrR){ nrR.style.width = nw+'px'; nrR.style.height = (nh-44)+'px'; }
      }
    }
  }
  function onEnd(){
    resizing = false;
    const el = getWinEl();
    if(el) el.style.transition = '';
  }

  document.addEventListener('touchstart', e=>{
    if(e.target.closest('[data-resize]')){
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
      e.preventDefault();
    }
  },{passive:false});
  document.addEventListener('touchmove', e=>{
    if(!resizing) return;
    onMove(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  },{passive:false});
  document.addEventListener('touchend', ()=>onEnd());

  document.addEventListener('mousedown', e=>{
    if(e.target.closest('[data-resize]')) onStart(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e=>{
    if(resizing) onMove(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', ()=>onEnd());
})();

/* ============================================================
   Drag doigt pour scroller — faites glisser le doigt vers le
   bas pour descendre, vers le haut pour remonter, sur n'importe
   quelle zone à défilement (lanceur, Netflix, Disney+, etc.).
   ============================================================ */
(function(){
  let scrollState = null;
  let touchInProgress = false;
  function findScrollable(el, limit){
    while(el && el !== limit && el !== document.body && el !== document.documentElement){
      const style = window.getComputedStyle(el);
      if((style.overflowY==='auto'||style.overflowY==='scroll') && el.scrollHeight > el.clientHeight + 2)
        return el;
      el = el.parentElement;
    }
    return null;
  }
  function onPointerDown(e, clientY){
    // Les vrais contrôles de formulaire (label/input/button/select/textarea/lien)
    // ne doivent jamais se faire "voler" leur toucher par le scroll au doigt :
    // sinon preventDefault() ci-dessous supprime le clic natif qui suit
    // (ex : un <label for="..."> qui doit ouvrir le sélecteur de dossier).
    if(e.target.closest('[data-resize],.gaze-scroll-btn,.app-gaze-scroll-btn,.hide-cross,label,input,button,select,textarea,a,.cg-key,.cg-trackpad,.cg-mouse-btn'))
      return;
    const scrollEl = findScrollable(e.target);
    if(!scrollEl) return;
    scrollState = { el: scrollEl, startY: clientY, startScrollTop: scrollEl.scrollTop };
    if(e.cancelable) e.preventDefault();
  }
  function onPointerMove(clientY){
    if(!scrollState) return;
    const dy = scrollState.startY - clientY;
    scrollState.el.scrollTop = scrollState.startScrollTop + dy;
  }
  function onPointerEnd(){
    scrollState = null;
  }
  /* Tactile : le flag touchInProgress empêche les événements souris
     synthétiques (déclenchés 300ms après le toucher) d'interférer. */
  document.addEventListener('touchstart', e=>{
    touchInProgress = true;
    const t=e.touches[0];
    if(t) onPointerDown(e, t.clientY);
  }, {passive:false,capture:true});
  document.addEventListener('touchmove', e=>{
    if(!scrollState) return;
    const t=e.touches[0];
    if(t) onPointerMove(t.clientY);
    if(e.cancelable) e.preventDefault();
  }, {passive:false,capture:true});
  document.addEventListener('touchend', ()=>{ touchInProgress=false; onPointerEnd(); }, {passive:false,capture:true});
  document.addEventListener('touchcancel', ()=>{ touchInProgress=false; onPointerEnd(); }, {passive:false,capture:true});
  /* Souris : ignoré si un toucher est en cours */
  document.addEventListener('mousedown', e=>{ if(!touchInProgress) onPointerDown(e, e.clientY); }, {passive:false,capture:true});
  document.addEventListener('mousemove', e=>{ if(!touchInProgress) onPointerMove(e.clientY); }, {passive:false,capture:true});
  document.addEventListener('mouseup', ()=>{ if(!touchInProgress) onPointerEnd(); }, {passive:false,capture:true});
})();

/* ============================================================
   Son de clic sur interactions directes (souris / touch)
   Couvre tous les boutons, icônes Dock, Launchpad, listes, etc.
   ============================================================ */
document.addEventListener('click', (e)=>{
  if(!state.primed) return;
  /* Chercher si le clic touche un élément interactif du système */
  const target = e.target.closest(
    '[data-gaze],[data-action],[data-resize],.app-icon,.btn,.rail .btn,.gaze-scroll-btn,' +
    '.app-window-close,.cinema-ctrl button,.kb-key,.st-episode,.st-season-btn,' +
    '.nf-s-ico,.nf-tab,.nf-trailer-item,.browser-bookmark,.maison-tab'
  );
  if(target) playAppleClick();
}, { capture: true });

/* ============================================================
   Son de survol sur interactions directes (mouseenter)
   ============================================================ */
document.addEventListener('mouseenter', (e)=>{
  if(!state.primed) return;
  const target = e.target.closest(
    '[data-gaze],[data-action],.app-icon,.btn,.rail .btn,.gaze-scroll-btn,' +
    '.app-window-close,.cinema-ctrl button,.kb-key,.st-episode,.st-season-btn,' +
    '.nf-s-ico,.nf-tab,.browser-bookmark'
  );
  if(target) playAppleHover();
}, { capture: true });

/* ============================================================
   Barre de progression cinéma — clic/touch pour sauter
   ============================================================ */
(function setupProgressSeek(){
  let dragging = false;
  let activeWrap = null;

  function ratioFromEvent(e, wrap){
    const rect = wrap.getBoundingClientRect();
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX
                   : (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX
                   : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function applyVisual(pct){
    document.querySelectorAll('.progress-fill').forEach(f => f.style.width = pct + '%');
    document.querySelectorAll('.progress-thumb').forEach(t => t.style.left = pct + '%');
  }

  function seekTo(ratio){
    const v = document.getElementById('userVid');
    if(!v || !v.duration) return;
    v.currentTime = ratio * v.duration;
    applyVisual(ratio * 100);
  }

  function onStart(e){
    if(!state.cinemaMode) return;
    const wrap = e.target.closest('.progress-wrap');
    if(!wrap) return;
    const v = document.getElementById('userVid');
    if(!v || !v.duration) return;
    dragging = true;
    activeWrap = wrap;
    e.stopPropagation();
    e.preventDefault();
    seekTo(ratioFromEvent(e, wrap));
  }

  function onMove(e){
    if(!dragging || !activeWrap) return;
    e.stopPropagation();
    e.preventDefault();
    seekTo(ratioFromEvent(e, activeWrap));
  }

  function onEnd(e){
    if(!dragging) return;
    if(activeWrap){ e.stopPropagation(); e.preventDefault(); }
    dragging = false;
    activeWrap = null;
  }

  /* Mouse */
  document.addEventListener('mousedown', onStart, { capture: true });
  document.addEventListener('mousemove', onMove, { capture: true });
  document.addEventListener('mouseup', onEnd, { capture: true });
  /* Touch */
  document.addEventListener('touchstart', onStart, { capture: true, passive: false });
  document.addEventListener('touchmove', onMove, { capture: true, passive: false });
  document.addEventListener('touchend', onEnd, { capture: true, passive: false });
  document.addEventListener('touchcancel', onEnd, { capture: true, passive: false });
  /* Fallback: plain click (covers any pointer types that skip the above) */
  document.addEventListener('click', (e)=>{
    if(!state.cinemaMode) return;
    const wrap = e.target.closest('.progress-wrap');
    if(!wrap) return;
    e.stopPropagation();
    e.preventDefault();
    seekTo(ratioFromEvent(e, wrap));
  }, { capture: true });
})();

/* ============================================================
   Bouton Recentrer — 4 secondes pour regarder l'endroit voulu
   ============================================================ */
(function setupRecenter(){
  const btn = document.getElementById('recenterBtn');
  let counting = false;
  let overlayEl = null;
  let rafId = null;

  function removeOverlay(){
    if(overlayEl){ overlayEl.remove(); overlayEl = null; }
  }

  function startRecenter(){
    if(counting) return;
    counting = true;
    btn.classList.add('counting');

    /* Créer l'overlay */
    overlayEl = document.createElement('div');
    overlayEl.className = 'recenter-overlay';
    const r = 44;
    const circ = 2 * Math.PI * r;
    overlayEl.innerHTML = `
      <div class="recenter-overlay-inner">
        <svg class="recenter-ring" width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="${r}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="6"/>
          <circle id="recenterArc" cx="55" cy="55" r="${r}" fill="none" stroke-width="6"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ}" stroke-linecap="round"/>
        </svg>
        <div class="recenter-countdown" id="recenterNum">4</div>
        <div class="recenter-label">Regardez l'endroit<br>où centrer l'interface</div>
      </div>`;
    document.body.appendChild(overlayEl);

    const arc = document.getElementById('recenterArc');
    const num = document.getElementById('recenterNum');
    const DURATION = 4000;
    const startTime = performance.now();

    function tick(now){
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const remaining = Math.ceil((DURATION - elapsed) / 1000);

      /* Anneau de progression */
      if(arc) arc.setAttribute('stroke-dashoffset', circ * (1 - progress));
      if(num) num.textContent = Math.max(remaining, 1);

      if(progress < 1){
        rafId = requestAnimationFrame(tick);
      } else {
        /* Capturer le yaw actuel */
        if(camL && camL.object3D){
          state.initYaw = camL.object3D.rotation.y;
          state.initPitch = camL.object3D.rotation.x;
          positionFlatScreen();
          /* Regeler les onglets HUD sur la nouvelle direction */
          _prevLocked = null; // force re-freeze
          if(state.locked) setTimeout(freezeHUDNow, 30);
        }
        playAppleClick();
        finish();
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function finish(){
    counting = false;
    btn.classList.remove('counting');
    removeOverlay();
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
  }

  /* Annuler si on appuie à nouveau pendant le compte à rebours */
  btn.addEventListener('click', e=>{
    e.stopPropagation();
    if(counting){ finish(); return; }
    if(!state.primed) return;
    startRecenter();
  });

  /* Empêcher la propagation vers le gestionnaire global de clic */
  ['pointerdown','touchstart','mousedown'].forEach(ev=>{
    btn.addEventListener(ev, e=>e.stopPropagation());
  });
})();

/* ============================================================
   Tap direct sur le champ "Nom du jeu" (modale Ajouter un jeu,
   Library → Download) → ouverture IMMÉDIATE du clavier virtuel,
   sans attendre le regard (gaze/dwell 3s) ni le hand tracking.
   Un simple toucher/clic sur le champ suffit.
   ============================================================ */
(function setupAddGameNameTap(){
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action="library:addgame:edit:name"]');
    if(!el) return;
    e.stopImmediatePropagation();
    if(typeof handleAction === 'function') handleAction('library:addgame:edit:name');
  }, true);
})();

/* ============================================================
   Double-tap sur champs texte → clavier natif iOS
   ============================================================ */
(function setupDoubleTap(){
  // Quand l'utilisateur double-tape un champ text (creator name/story, notes, URL)
  const TEXT_FIELDS_SELECTOR = '[data-action="netflix:creator:edit:name"],[data-action="netflix:anime:creator:edit:name"],[data-action="netflix:creator:edit:story"],[data-action="netflix:anime:creator:edit:story"],[data-action="browser:editurl"],[data-kb],[data-action="app:notes"]';

  let lastTapEl = null, lastTapTime = 0;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-gaze]');
    if(!el) return;
    const action = el.getAttribute('data-action') || '';
    const isTextField = (
      action.includes(':edit:name') || action.includes(':edit:story') ||
      action === 'browser:editurl' || action === 'app:notes'
    );
    if(!isTextField) return;
    const now = Date.now();
    if(el === lastTapEl && now - lastTapTime < 400){
      // Double-tap !
      e.stopImmediatePropagation();
      if(action.includes(':edit:name')){
        openNativeKB(state.netflixCreatorForm.name, t=>{ state.netflixCreatorForm.name=t; renderHUD(); });
      } else if(action.includes(':edit:story')){
        openNativeKB(state.netflixCreatorForm.story, t=>{ state.netflixCreatorForm.story=t; renderHUD(); });
      } else if(action==='browser:editurl'){
        openNativeKB(state.browserUrl, t=>{
          if(!t) return;
          let url = t.trim();
          if(!url.includes('.') || url.includes(' ')){
            url = 'https://www.google.com/search?q=' + encodeURIComponent(url) + '&hl=fr';
          } else if(!url.startsWith('http')){
            url = 'https://' + url;
          }
          browserNavigate(url);
        });
      } else if(action==='app:notes'){
        openNativeKB(state.notesText, t=>{ state.notesText=t||''; try{localStorage.setItem('horizonNotes',state.notesText);}catch(_){} renderHUD(); });
      }
      lastTapEl = null; lastTapTime = 0;
    } else {
      lastTapEl = el; lastTapTime = now;
    }
  }, true);

  // Native KB input — confirm on blur ou Enter
  const nki = document.getElementById('_nativeKbInput');
  if(nki){
    const confirm = () => {
      const val = nki.value;
      if(nki._onDone) nki._onDone(val);
      nki._onDone = null;
      nki.style.pointerEvents = 'none';
    };
    nki.addEventListener('blur', confirm);
    nki.addEventListener('keydown', e => { if(e.key==='Enter'||e.key==='Go'||e.keyCode===13){ nki.blur(); } });
  }
})();

/* ── Iframe browser — callback de chargement ── */
window._browserIframeLoaded = function(){
  const bs = state.browserState;
  if(bs){ bs.loading = false; bs.error = null; }
  // Ne pas re-renderHUD pour éviter de rechager l'iframe
};
window._browserIframeError = function(){
  const bs = state.browserState;
  if(bs){ bs.loading = false; bs.error = 'Le site a refusé la connexion via proxy. Essayez de désactiver le proxy ou d\'ouvrir dans un nouvel onglet.'; renderHUD(); }
};

/* ── Lien "ouvrir dans nouvel onglet" depuis l'iframe ── */
window._browserOpenExternal = function(url){
  window.open(url, '_blank', 'noopener');
};


const _origVkbType = vkbType;
// (vkbType already handles this via callback)

/* ============================================================
   Clavier virtuel : si vkbField est 'browserUrl', afficher
   un bouton "Aller" au lieu de ↵ et valider l'URL
   ============================================================ */


