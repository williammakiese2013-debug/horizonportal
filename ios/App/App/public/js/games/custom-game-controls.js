/* ============================================================
   custom-game-controls.js
   Clavier + souris virtuels pour les jeux HTML/JS custom importés
   en mode tablette (Library → Ajouter un jeu).

   Principe : l'iframe du jeu est servie depuis la MÊME origine
   (via IndexedDB + Blob URLs, voir cgBuildRuntimeUrls
   dans file-picker.js) donc, avec sandbox="allow-same-origin", on
   peut dispatcher de vrais KeyboardEvent/MouseEvent DANS le
   document de l'iframe. Les jeux qui écoutent keydown/keyup
   (WASD, flèches...) ou mousemove/mousedown (souris/pointer lock)
   les reçoivent donc exactement comme un vrai clavier/souris.
   ============================================================ */
(function(){
  function cgFrame(){
    return document.getElementById('cgFrame') || document.querySelector('.customgame-frame');
  }
  function cgWin(){
    const f = cgFrame();
    try{ return f && f.contentWindow; }catch(_){ return null; }
  }
  function cgDoc(){
    const f = cgFrame();
    try{ return f && f.contentDocument; }catch(_){ return null; }
  }
  function cgDispatchKey(type, key, code){
    const win = cgWin(), doc = cgDoc();
    if(!win || !doc) return;
    let ev;
    try{ ev = new win.KeyboardEvent(type, { key, code, bubbles:true, cancelable:true }); }
    catch(_){ try{ ev = new KeyboardEvent(type, { key, code, bubbles:true, cancelable:true }); }catch(__){ return; } }
    try{ (doc.activeElement || doc.body || doc).dispatchEvent(ev); }catch(_){}
    try{ win.dispatchEvent(ev); }catch(_){}
  }

  /* Position virtuelle du curseur, en coordonnées locales à l'iframe. */
  let cgMouseX = null, cgMouseY = null;
  function cgFrameSize(){
    const f = cgFrame();
    if(!f) return { w:300, h:300 };
    return { w: f.clientWidth || 300, h: f.clientHeight || 300 };
  }
  function cgEnsureMousePos(){
    if(cgMouseX === null){
      const { w, h } = cgFrameSize();
      cgMouseX = w/2; cgMouseY = h/2;
    }
  }
  function cgDispatchMouse(type, opts){
    const win = cgWin(), doc = cgDoc();
    if(!win || !doc) return;
    cgEnsureMousePos();
    const init = Object.assign({
      bubbles:true, cancelable:true, view: win,
      clientX: cgMouseX, clientY: cgMouseY,
      button: 0, buttons: 1,
    }, opts||{});
    let ev;
    try{ ev = new win.MouseEvent(type, init); }
    catch(_){ try{ ev = new MouseEvent(type, init); }catch(__){ return; } }
    let target = null;
    try{ target = doc.elementFromPoint(cgMouseX, cgMouseY); }catch(_){}
    try{ (target || doc.body || doc).dispatchEvent(ev); }catch(_){}
  }

  /* ------------ Clavier virtuel (appui maintenu = touche maintenue) ------------ */
  const activeKeys = new Set();
  function pressKey(el){
    const key = el.getAttribute('data-cg-key');
    const code = el.getAttribute('data-cg-code') || key;
    if(activeKeys.has(code)) return;
    activeKeys.add(code);
    el.classList.add('cg-key-active');
    cgDispatchKey('keydown', key, code);
  }
  function releaseKey(el){
    const key = el.getAttribute('data-cg-key');
    const code = el.getAttribute('data-cg-code') || key;
    if(!activeKeys.has(code)) return;
    activeKeys.delete(code);
    el.classList.remove('cg-key-active');
    cgDispatchKey('keyup', key, code);
  }
  document.addEventListener('pointerdown', e=>{
    const el = e.target.closest('.cg-key');
    if(!el) return;
    e.preventDefault(); e.stopPropagation();
    pressKey(el);
  }, {capture:true});
  ['pointerup','pointercancel','pointerleave'].forEach(evName=>{
    document.addEventListener(evName, e=>{
      const el = e.target && e.target.closest && e.target.closest('.cg-key');
      if(el) releaseKey(el);
    }, {capture:true});
  });
  // Filet de sécurité : si un doigt quitte le bouton sans event propre, on
  // relâche tout au prochain "pointerup" global pour éviter une touche bloquée.
  document.addEventListener('pointerup', ()=>{
    activeKeys.forEach(code=>{
      const el = document.querySelector('.cg-key[data-cg-code="'+code+'"]');
      if(el) releaseKey(el);
    });
  }, {capture:true});

  /* ------------ Trackpad (déplacement souris) ------------ */
  let dragging = false, lastX = 0, lastY = 0;
  document.addEventListener('pointerdown', e=>{
    const el = e.target.closest('#cgTrackpad');
    if(!el) return;
    e.preventDefault(); e.stopPropagation();
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    el.classList.add('cg-trackpad-active');
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
  }, {capture:true});
  document.addEventListener('pointermove', e=>{
    if(!dragging) return;
    e.preventDefault(); e.stopPropagation();
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    cgEnsureMousePos();
    const { w, h } = cgFrameSize();
    cgMouseX = Math.max(0, Math.min(w, cgMouseX + dx));
    cgMouseY = Math.max(0, Math.min(h, cgMouseY + dy));
    cgDispatchMouse('mousemove', { movementX: dx, movementY: dy });
  }, {capture:true});
  function endDrag(){
    if(!dragging) return;
    dragging = false;
    const el = document.getElementById('cgTrackpad');
    if(el) el.classList.remove('cg-trackpad-active');
  }
  document.addEventListener('pointerup', endDrag, {capture:true});
  document.addEventListener('pointercancel', endDrag, {capture:true});

  /* ------------ Boutons souris (clic gauche / droit) ------------ */
  function pressMouseBtn(el){
    if(el.classList.contains('cg-mouse-btn-active')) return;
    el.classList.add('cg-mouse-btn-active');
    const side = el.getAttribute('data-cg-mouse');
    const button = side === 'right' ? 2 : 0;
    cgDispatchMouse('mousedown', { button, buttons: button===2?2:1 });
  }
  function releaseMouseBtn(el){
    if(!el.classList.contains('cg-mouse-btn-active')) return;
    el.classList.remove('cg-mouse-btn-active');
    const side = el.getAttribute('data-cg-mouse');
    const button = side === 'right' ? 2 : 0;
    cgDispatchMouse('mouseup', { button });
    cgDispatchMouse('click', { button });
    if(side === 'right') cgDispatchMouse('contextmenu', { button });
  }
  document.addEventListener('pointerdown', e=>{
    const el = e.target.closest('.cg-mouse-btn');
    if(!el) return;
    e.preventDefault(); e.stopPropagation();
    pressMouseBtn(el);
  }, {capture:true});
  document.addEventListener('pointerup', e=>{
    const el = e.target.closest('.cg-mouse-btn');
    if(!el) return;
    e.preventDefault(); e.stopPropagation();
    releaseMouseBtn(el);
  }, {capture:true});

  /* ============================================================
     REGARD / MAIN — "viser = maintenir appuyé"
     ============================================================
     Sans souris ni écran tactile, un pointerdown/up réel n'existe pas :
     en VR, on ne peut que regarder ou pointer une touche. On ajoute donc
     ici une couche de survol qui reproduit un "appui maintenu" tant que
     le regard (réticule central) ou le curseur main (window.__handTrackAPI,
     quand il pointe) reste sur une touche — indispensable pour les jeux
     qui utilisent WASD/flèches en MAINTIEN (avancer en continu), ce que
     ne permettait pas un simple clic instantané.
     Un très court délai (HOVER_ARM_MS) avant l'appui absorbe les
     regards qui ne font que passer sur une touche en allant ailleurs.
     Le trackpad, lui, devient un "joystick" : plus on vise loin du
     centre du pavé, plus la souris virtuelle glisse vite dans cette
     direction — bien plus utilisable en VR qu'un vrai glisser-déposer.
     Cette couche est 100% additive : le clic/glisser tactile ou souris
     réel ci-dessus continue de fonctionner à l'identique. ============ */
  const HOVER_ARM_MS = 110;
  let hoverEl = null, hoverArmedAt = 0, hoverPressed = null;

  function currentAimPoint(){
    const handAPI = window.__handTrackAPI;
    if(handAPI && handAPI.isActive && handAPI.pointing && handAPI.screen){
      return { x: handAPI.screen.pageX, y: handAPI.screen.pageY };
    }
    if(typeof state !== 'undefined' && state && state.gazeEnabled && state.primed){
      const eye = document.getElementById('eyeLeft');
      if(eye){
        const bb = eye.getBoundingClientRect();
        return { x: bb.left + bb.width/2, y: bb.top + bb.height/2 };
      }
    }
    return null;
  }

  function releaseHoverPressed(){
    if(!hoverPressed) return;
    if(hoverPressed.classList.contains('cg-key')) releaseKey(hoverPressed);
    else if(hoverPressed.classList.contains('cg-mouse-btn')) releaseMouseBtn(hoverPressed);
    hoverPressed = null;
  }

  let padActive = false, padEl = null;
  function tickTrackpad(pad, pt){
    if(!pad){
      if(padActive && padEl){ padEl.classList.remove('cg-trackpad-active'); }
      padActive = false; padEl = null;
      return;
    }
    const r = pad.getBoundingClientRect();
    if(r.width < 4 || r.height < 4) return;
    let nx = ((pt.x - r.left)/r.width)*2 - 1;
    let ny = ((pt.y - r.top)/r.height)*2 - 1;
    nx = Math.max(-1, Math.min(1, nx));
    ny = Math.max(-1, Math.min(1, ny));
    const DEAD = 0.15, SPEED = 13;
    const shape = v => (Math.abs(v) > DEAD ? Math.sign(v) * (Math.abs(v)-DEAD)/(1-DEAD) : 0);
    const mx = shape(nx) * SPEED, my = shape(ny) * SPEED;
    if(!padActive){ pad.classList.add('cg-trackpad-active'); padActive = true; padEl = pad; }
    if(mx || my){
      cgEnsureMousePos();
      const { w, h } = cgFrameSize();
      cgMouseX = Math.max(0, Math.min(w, cgMouseX + mx));
      cgMouseY = Math.max(0, Math.min(h, cgMouseY + my));
      cgDispatchMouse('mousemove', { movementX: mx, movementY: my });
    }
  }

  function tickHover(){
    const cgActive = !!cgFrame();
    const pt = cgActive ? currentAimPoint() : null;

    if(!pt){
      if(hoverEl){ hoverEl = null; hoverArmedAt = 0; }
      releaseHoverPressed();
      tickTrackpad(null, null);
      requestAnimationFrame(tickHover);
      return;
    }

    const el = document.elementFromPoint(pt.x, pt.y);
    const target = el && (el.closest('.cg-key') || el.closest('.cg-mouse-btn'));

    if(target !== hoverEl){
      releaseHoverPressed();
      hoverEl = target || null;
      hoverArmedAt = target ? performance.now() : 0;
    } else if(target && !hoverPressed && (performance.now() - hoverArmedAt) >= HOVER_ARM_MS){
      if(target.classList.contains('cg-key')) pressKey(target);
      else pressMouseBtn(target);
      hoverPressed = target;
    }

    const pad = el && el.closest('#cgTrackpad');
    tickTrackpad(pad, pt);

    requestAnimationFrame(tickHover);
  }
  requestAnimationFrame(tickHover);

  /* ============================================================
     STYLET — "le prendre en main", fil vers l'écran, pincer pour cliquer
     ============================================================
     - On le prend/repose en cliquant sur l'icône ancrée à côté de la
       tablette (data-action="customgame:stylus:toggle", géré côté OS).
     - Une fois en main, sa pointe suit le curseur (main qui pointe, ou
       regard) et un fil pointillé le relie visuellement à l'écran de la
       tablette (pour ne jamais "le perdre" et bien voir qu'il agit sur
       CET écran-là).
     - Cliquer = rapprocher pouce et index (vrai pincement, déjà détecté
       par ailleurs pour d'autres usages) : front montant = mousedown,
       tenu = glisser en continu (utile pour déplacer un objet dans un
       jeu cosy), relâché = mouseup + click. Sans hand tracking, un
       petit dwell (regard maintenu) fait office de clic.
     ============================================================ */
  function ensureStylusEls(){
    if(document.getElementById('cgStylusTip')) return;
    const tip = document.createElement('div');
    tip.id = 'cgStylusTip';
    tip.textContent = '🖊️';
    document.body.appendChild(tip);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'cgStylusTether';
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(line);
    document.body.appendChild(svg);
  }

  let stylusDown = false;
  let stylusLastX = null, stylusLastY = null;
  let stylusDwellStart = 0;

  function stylusRelease(){
    if(!stylusDown) return;
    cgDispatchMouse('mouseup', { button: 0 });
    cgDispatchMouse('click', { button: 0 });
    stylusDown = false;
  }

  function tickStylus(){
    ensureStylusEls();
    const tip = document.getElementById('cgStylusTip');
    const tether = document.getElementById('cgStylusTether');
    const line = tether ? tether.querySelector('line') : null;

    const heldNow = typeof state !== 'undefined' && state && state.cgStylusHeld === true;
    const frame = heldNow ? cgFrame() : null;

    if(!heldNow || !frame){
      tip.style.display = 'none';
      if(tether) tether.style.display = 'none';
      stylusRelease();
      stylusLastX = stylusLastY = null;
      stylusDwellStart = 0;
      requestAnimationFrame(tickStylus);
      return;
    }

    const pt = currentAimPoint();
    if(!pt){
      tip.style.display = 'none';
      if(tether) tether.style.display = 'none';
      stylusRelease();
      requestAnimationFrame(tickStylus);
      return;
    }

    tip.style.display = 'block';
    tip.style.left = pt.x + 'px';
    tip.style.top = pt.y + 'px';

    if(tether && line){
      tether.style.display = 'block';
      const dock = document.getElementById('cgStylusDock');
      const anchorRect = (dock || frame).getBoundingClientRect();
      line.setAttribute('x1', anchorRect.left + anchorRect.width/2);
      line.setAttribute('y1', anchorRect.top + anchorRect.height/2);
      line.setAttribute('x2', pt.x);
      line.setAttribute('y2', pt.y);
    }

    // --- Détection du clic : vrai pincement en hand tracking, sinon dwell ---
    const handAPI = window.__handTrackAPI;
    let clicking;
    if(handAPI && handAPI.isActive){
      clicking = !!handAPI.pinching;
      stylusDwellStart = 0;
    } else {
      if(!stylusDwellStart) stylusDwellStart = performance.now();
      clicking = (performance.now() - stylusDwellStart) >= 420;
    }

    tip.classList.toggle('cg-stylus-clicking', clicking);

    const fr = frame.getBoundingClientRect();
    const withinFrame = pt.x >= fr.left && pt.x <= fr.right && pt.y >= fr.top && pt.y <= fr.bottom;
    const localX = Math.max(0, Math.min(fr.width, pt.x - fr.left));
    const localY = Math.max(0, Math.min(fr.height, pt.y - fr.top));

    if(clicking && !stylusDown){
      if(withinFrame){
        cgMouseX = localX; cgMouseY = localY;
        stylusLastX = localX; stylusLastY = localY;
        cgDispatchMouse('mousedown', { button: 0, buttons: 1 });
        stylusDown = true;
      }
    } else if(clicking && stylusDown){
      const dx = localX - (stylusLastX == null ? localX : stylusLastX);
      const dy = localY - (stylusLastY == null ? localY : stylusLastY);
      cgMouseX = localX; cgMouseY = localY;
      stylusLastX = localX; stylusLastY = localY;
      if(dx || dy) cgDispatchMouse('mousemove', { movementX: dx, movementY: dy, buttons: 1 });
    } else if(!clicking && stylusDown){
      stylusRelease();
      stylusDwellStart = 0;
    }

    requestAnimationFrame(tickStylus);
  }
  requestAnimationFrame(tickStylus);
})();
