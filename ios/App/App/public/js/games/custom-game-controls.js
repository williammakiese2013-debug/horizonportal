/* ============================================================
   custom-game-controls.js
   Clavier + souris virtuels pour les jeux HTML/JS custom importés
   en mode tablette (Library → Ajouter un jeu).

   Principe : l'iframe du jeu est servie depuis la MÊME origine
   (via le Service Worker / Cache Storage, voir customGameFileUrl
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
  document.addEventListener('pointerdown', e=>{
    const el = e.target.closest('.cg-mouse-btn');
    if(!el) return;
    e.preventDefault(); e.stopPropagation();
    const side = el.getAttribute('data-cg-mouse');
    const button = side === 'right' ? 2 : 0;
    el.classList.add('cg-mouse-btn-active');
    cgDispatchMouse('mousedown', { button, buttons: button===2?2:1 });
    if(side === 'right') cgDispatchMouse('contextmenu', { button });
  }, {capture:true});
  document.addEventListener('pointerup', e=>{
    const el = e.target.closest('.cg-mouse-btn');
    if(!el) return;
    e.preventDefault(); e.stopPropagation();
    const side = el.getAttribute('data-cg-mouse');
    const button = side === 'right' ? 2 : 0;
    el.classList.remove('cg-mouse-btn-active');
    cgDispatchMouse('mouseup', { button });
    cgDispatchMouse('click', { button });
  }, {capture:true});
})();
