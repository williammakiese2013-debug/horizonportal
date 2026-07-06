/* ============================================================
   GRAB & MOVE — Attraper et déplacer une fenêtre avec le pinch
   ============================================================
   Réutilise le pipeline d'affichage existant (state.dragGazeOffX/Y +
   uiDepthTransform), déjà utilisé par le drag "par regard". La seule
   différence : ici, le delta appliqué vient du déplacement de la MAIN
   (handScreen.pageX/pageY) et non de la rotation de la tête.
   Etat propre isolé dans `handGrab` pour ne jamais interférer avec :
   - le clic instantané par pinch (window.__handTrackPinchClick)
   - le drag par regard classique (state.dragGazeMode + drag:activate/confirm)
*/
const handGrab = {
  active: false,     // true tant que le pinch est maintenu sur une fenêtre
  startHandX: 0,      // position (page px) de la main au moment du grab
  startHandY: 0,
  startOffX: 0,        // offset de la fenêtre au moment du grab (= l'"offset"
  startOffY: 0          // fenêtre <-> main demandé, calculé une seule fois)
};
const handScroll = {
  active: false,
  el: null,
  startHandY: 0,
  startScrollTop: 0
};
const handDepth = {
  active: false,
  startHandY: 0,
  startDepthOffset: 0
};
function findScrollableParent(el, limit){
  while(el && el !== limit && el !== document.body && el !== document.documentElement){
    if(el.scrollHeight > el.clientHeight + 2){
      const style = window.getComputedStyle(el);
      if(style.overflowY==='auto'||style.overflowY==='scroll') return el;
    }
    el = el.parentElement;
  }
  return null;
}

/* Applique la transform CSS à la fenêtre à partir de state.dragGazeOffX/Y
   et state.depthGrabOffset (barre de profondeur).
   Factorisé pour être appelable aussi bien depuis detectLoop() (pendant le
   grab) que depuis tickDragGaze() (drag par regard classique). */
function applyWindowDragTransform(){
  const depthExtra = state.depthGrabOffset || 0;
  const appWindowTransform = state.appMaximized
    ? uiDepthTransform(420, 0.84, `translate(-50%,-50%) translateX(${state.dragGazeOffX}px) translateY(${state.dragGazeOffY}px)`, depthExtra)
    : uiDepthTransform(420, 0.78, `translate(-50%,-50%) translateX(${-640+state.dragGazeOffX}px) translateY(${state.dragGazeOffY}px)`, depthExtra);
  for(const side of ['L','R']){
    const wc = document.getElementById('appWindowCenter'+side);
    if(wc) wc.style.transform = appWindowTransform;
  }
}

/* Point d'entrée appelé depuis detectLoop() (voir plus bas) à chaque frame
   où une main est détectée. Gère les 3 phases : début / maintien / fin. */
function updateHandGrab(pinching, wasPinching, handScreen){
  if(!handScreen) return;

  /* --- 1. DÉBUT : le pinch démarre --- */
  if(pinching && !wasPinching){
    const stack = document.elementsFromPoint(handScreen.pageX, handScreen.pageY);
    // Zone attrapable : la poignée de drag dédiée, ou n'importe où sur la
    // fenêtre elle-même (title bar / corps de fenêtre).
    const grabTarget = stack.find(n => n instanceof HTMLElement &&
      (n.id === 'appWinDrag' || n.classList.contains('app-win-drag')));

    if(grabTarget){
      handGrab.active = true;
      handScroll.active = false;
      state.dragGazeMode = true;
      handGrab.startHandX = handScreen.pageX;
      handGrab.startHandY = handScreen.pageY;
      handGrab.startOffX = state.dragGazeOffX || 0;
      handGrab.startOffY = state.dragGazeOffY || 0;
      if(typeof playAppleHover === 'function') playAppleHover();
      return;
    }

    /* Barre de profondeur en bas de la fenêtre */
    const depthTarget = stack.find(n => n instanceof HTMLElement &&
      n.classList.contains('app-win-depth'));
    if(depthTarget){
      handDepth.active = true;
      handDepth.startHandY = handScreen.pageY;
      handDepth.startDepthOffset = state.depthGrabOffset || 0;
      if(typeof playAppleHover === 'function') playAppleHover();
      return;
    }

    /* Pas de cible de drag → on cherche une zone scrollable sous la main */
    const targetEl = stack.find(n => n instanceof HTMLElement && n !== document.body && n !== document.documentElement);
    const scrollEl = targetEl ? findScrollableParent(targetEl) : null;
    if(scrollEl){
      handScroll.active = true;
      handScroll.el = scrollEl;
      handScroll.startHandY = handScreen.pageY;
      handScroll.startScrollTop = scrollEl.scrollTop;
      if(typeof playAppleHover === 'function') playAppleHover();
      return;
    }
  }

  /* --- 2. MOUVEMENT EN TEMPS RÉEL --- */
  if(handGrab.active && pinching){
    const dx = handScreen.pageX - handGrab.startHandX;
    const dy = handScreen.pageY - handGrab.startHandY;
    state.dragGazeOffX = handGrab.startOffX + dx;
    state.dragGazeOffY = handGrab.startOffY + dy;
    applyWindowDragTransform();
    return;
  }
  if(handDepth.active && pinching){
    /* Tirer vers le bas = écran plus proche (depthOffset positif)
       Pousser vers le haut = écran plus loin (depthOffset négatif) */
    const dy = handScreen.pageY - handDepth.startHandY;
    state.depthGrabOffset = handDepth.startDepthOffset + dy * 0.5;
    state.depthGrabOffset = Math.max(-150, Math.min(250, state.depthGrabOffset));
    applyWindowDragTransform();
    return;
  }
  if(handScroll.active && pinching && handScroll.el){
    const dy = handScroll.startHandY - handScreen.pageY;
    handScroll.el.scrollTop = handScroll.startScrollTop + dy;
    return;
  }

  /* --- 3. RELÂCHEMENT --- */
  if(handGrab.active && !pinching){
    handGrab.active = false;
    state.dragGazeMode = false;
    if(typeof toast === 'function') toast('✅ Fenêtre déposée');
    return;
  }
  if(handDepth.active && !pinching){
    handDepth.active = false;
    return;
  }
  if(handScroll.active && !pinching){
    handScroll.active = false;
    handScroll.el = null;
    return;
  }
}

/* Sécurité : si la main disparaît totalement pendant un grab ou un scroll
   (perte de tracking), on relâche proprement au lieu de laisser un état
   bloqué. */
function cancelHandGrabIfActive(){
  if(handGrab.active){
    handGrab.active = false;
    state.dragGazeMode = false;
  }
}
function cancelHandDepthIfActive(){
  handDepth.active = false;
}
function cancelHandScrollIfActive(){
  if(handScroll.active){
    handScroll.active = false;
    handScroll.el = null;
  }
}

