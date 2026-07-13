/* ============================================================
   ⚠️ DÉPRÉCIÉ — NON CHARGÉ (retiré de index.html).
   Remplacé par js/vr-interactions/webview-browser.js : un vrai
   navigateur 3D world-locked, rendu dans les deux yeux via
   WebView-to-Texture (voir native/ios/WebViewTexturePlugin.swift),
   au lieu de cette bulle 2D "corps-verrouillée" qui suivait la tête.
   Conservé ici pour référence/historique uniquement.
   ============================================================
   VR BROWSER — Mini-navigateur flottant "corps-verrouillé"
   ============================================================
   But : une fenêtre navigateur (iframe) qui peut être ouverte dans
   n'importe quel jeu (taxi3d, webhero, ...) juste en incluant ce
   fichier. Elle N'EST PAS ancrée dans le monde 3D (world-locked) et
   N'EST PAS non plus rivée à la tête comme un HUD classique
   (head-locked rigide) : elle suit la tête avec de l'inertie/un
   temps de retard, et se "recentre" doucement devant vous quand vous
   arrêtez de bouger — comme les panneaux du dashboard Quest.

   Suivi de tête : on utilise `deviceorientation` (alpha/beta), qui
   est LE signal universel dans ce projet (téléphone posé dans un
   casque Cardboard/Horizon-like) — aucune dépendance à la caméra
   Three.js interne de chaque jeu, donc ça marche pareil dans les
   deux jeux sans les modifier en profondeur.

   Mode stéréo (webhero, écran splitté gauche/droite) : on affiche
   DEUX exemplaires synchronisés du panneau, un par moitié d'écran,
   avec la même logique que le système de fenêtres du portail
   principal (appWindowCenterL / appWindowCenterR).

   Configuration (optionnelle), à définir AVANT ce script :
     <script>window.VR_BROWSER_CONFIG = { stereo: true };</script>

   Pont "app native" (préparation pour la conversion en app) :
   window.VRBrowserBridge expose getState()/navigate()/open()/close()
   et diffuse un CustomEvent 'vrbrowser:statechange' sur window à
   chaque changement. Le jour où le projet tourne dans un vrai
   WKWebView natif (au lieu d'un <iframe> web), il suffira de cacher
   le <iframe> et de faire suivre un WKWebView natif sur les mêmes
   coordonnées (mêmes offsets X/Y, même largeur/hauteur) en écoutant
   cet event depuis le code natif (bridge JS <-> Swift) — l'URL et
   l'historique restent gérés ici, côté JS, dans les deux cas.
   ============================================================ */
(function(){
  'use strict';

  const CFG = Object.assign({ stereo: false, startUrl: '' }, window.VR_BROWSER_CONFIG || {});
  const HOME_URL = 'about:home';

  /* ---------------- Styles ---------------- */
  const style = document.createElement('style');
  style.textContent = `
  .vrbr-pane{position:fixed;top:0;height:100%;z-index:9999;pointer-events:none}
  .vrbr-pane[data-side="mono"]{left:0;width:100%}
  .vrbr-pane[data-side="L"]{left:0;width:50%;overflow:hidden}
  .vrbr-pane[data-side="R"]{left:50%;width:50%;overflow:hidden}
  .vrbr-toggle{
    position:absolute;left:50%;bottom:22px;transform:translateX(-50%);
    width:56px;height:56px;border-radius:50%;pointer-events:auto;
    background:rgba(20,22,30,.55);border:2px solid rgba(255,255,255,.4);
    color:#f4f4f4;font-size:24px;display:flex;align-items:center;justify-content:center;
    cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
    box-shadow:0 4px 14px rgba(0,0,0,.35);transition:background .15s,transform .15s;
  }
  .vrbr-toggle:active{transform:translateX(-50%) scale(.92)}
  .vrbr-toggle.is-open{background:rgba(90,170,255,.55)}
  .vrbr-anchor{
    position:absolute;left:50%;top:50%;
    transform:translate(calc(-50% + var(--vrbr-x,0px)), calc(-50% + var(--vrbr-y,0px)));
    pointer-events:none;
  }
  .vrbr-panel{
    pointer-events:auto;
    width:min(420px, 88vw);
    height:min(320px, 60vh);
    background:rgba(16,18,24,.92);
    border:1px solid rgba(255,255,255,.18);
    border-radius:16px;overflow:hidden;
    box-shadow:0 12px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03);
    display:flex;flex-direction:column;
    backdrop-filter:blur(6px);
    font-family:system-ui,-apple-system,sans-serif;
  }
  .vrbr-pane[data-side="L"] .vrbr-panel,
  .vrbr-pane[data-side="R"] .vrbr-panel{ width:min(340px, 82vw); height:min(260px, 56vh); }
  .vrbr-panel[hidden]{display:none}
  .vrbr-titlebar{
    display:flex;align-items:center;gap:6px;padding:8px 8px;
    background:rgba(255,255,255,.06);cursor:grab;touch-action:none;
    border-bottom:1px solid rgba(255,255,255,.08);
  }
  .vrbr-titlebar:active{cursor:grabbing}
  .vrbr-dots{color:rgba(255,255,255,.4);font-size:13px;letter-spacing:2px;padding:0 2px}
  .vrbr-nav{display:flex;gap:4px;flex:1}
  .vrbr-titlebar button{
    background:rgba(255,255,255,.08);border:none;color:#eee;
    width:28px;height:28px;border-radius:8px;font-size:14px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  }
  .vrbr-titlebar button:active{background:rgba(255,255,255,.2)}
  .vrbr-urlbar{display:flex;gap:6px;padding:6px 8px;background:rgba(0,0,0,.2)}
  .vrbr-urlbar input{
    flex:1;min-width:0;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
    color:#fff;font-size:12px;padding:7px 10px;border-radius:8px;outline:none;
  }
  .vrbr-urlbar button{
    background:rgba(90,170,255,.55);border:none;color:#fff;font-size:12px;
    padding:0 12px;border-radius:8px;cursor:pointer;
  }
  .vrbr-viewport{flex:1;position:relative;background:#0c0d11}
  .vrbr-viewport iframe{width:100%;height:100%;border:0;background:#fff}
  .vrbr-home{
    position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:10px;color:#cfd3dc;padding:16px;text-align:center;
  }
  .vrbr-home .vrbr-quick{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .vrbr-home .vrbr-quick button{
    background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#fff;
    padding:8px 12px;border-radius:10px;font-size:12px;cursor:pointer;
  }
  .vrbr-home small{opacity:.55;font-size:10.5px;line-height:1.4}
  .vrbr-blocked{
    position:absolute;inset:0;display:none;flex-direction:column;gap:10px;
    align-items:center;justify-content:center;color:#dfe3ea;background:rgba(12,13,17,.96);
    text-align:center;padding:18px;font-size:12.5px;line-height:1.5;
  }
  .vrbr-blocked.show{display:flex}
  .vrbr-blocked button{
    background:rgba(90,170,255,.6);border:none;color:#fff;padding:8px 14px;
    border-radius:9px;font-size:12px;cursor:pointer;
  }
  .vrbr-resize{
    position:absolute;right:2px;bottom:2px;width:20px;height:20px;cursor:nwse-resize;
    touch-action:none;opacity:.5;
  }
  .vrbr-resize::before{
    content:'';position:absolute;right:4px;bottom:4px;width:10px;height:10px;
    border-right:2px solid #fff;border-bottom:2px solid #fff;border-radius:2px;
  }
  @media (min-width:900px){
    .vrbr-pane[data-side="mono"] .vrbr-panel{ width:min(560px,44vw); height:min(420px,64vh) }
  }
  `;
  document.head.appendChild(style);

  /* ---------------- État partagé (logique, indépendant du rendu L/R) --------------- */
  const state = {
    open: false,
    url: '',
    history: [],
    histIndex: -1,
    w: null, h: null,       // taille custom (px) si redimensionné manuellement
    manualX: null, manualY: null, // offset choisi manuellement par drag (px), null = auto-follow
  };

  function normalizeUrl(raw){
    let v = (raw || '').trim();
    if(!v) return '';
    if(v === HOME_URL) return v;
    if(/^https?:\/\//i.test(v)) return v;
    // Ressemble à un domaine (contient un point, pas d'espace) → on tente en URL directe
    if(/^[^\s]+\.[a-z]{2,}([/?#].*)?$/i.test(v) && !v.includes(' ')){
      return 'https://' + v;
    }
    return 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(v);
  }

  function pushHistory(url){
    state.history = state.history.slice(0, state.histIndex + 1);
    state.history.push(url);
    state.histIndex = state.history.length - 1;
  }

  /* ---------------- Pont natif WKWebView ----------------
     Quand l'app tourne dans le shell natif iOS (Capacitor/Cordova/UIKit
     custom), le shell natif enregistre un WKScriptMessageHandler nommé
     "vrNativeBrowser" (voir native/ios/VRNativeBrowser.swift fourni à côté).
     Dans ce cas, on N'AFFICHE JAMAIS l'iframe web : on pilote une vraie
     WKWebView native, superposée pile sur le rectangle `.vrbr-viewport`
     (celui-ci sert juste de "trou" transparent qui donne ses coordonnées
     écran). Tout le reste (barre d'adresse, boutons, drag, resize, suivi
     de tête) reste 100% géré ici en JS, exactement comme avant — seul le
     rendu du contenu web change de moteur.
     Si aucun shell natif n'est détecté (test dans un navigateur normal),
     on retombe automatiquement sur l'iframe classique. */
  const NATIVE = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.vrNativeBrowser);
  function nativePost(msg){
    if(!NATIVE) return;
    try{ window.webkit.messageHandlers.vrNativeBrowser.postMessage(msg); }catch(e){}
  }

  /* ---------------- Pont "future app native" ---------------- */
  function broadcastState(){
    window.dispatchEvent(new CustomEvent('vrbrowser:statechange', { detail: getPublicState() }));
  }
  function getPublicState(){
    return {
      open: state.open,
      url: state.url,
      canGoBack: state.histIndex > 0,
      canGoForward: state.histIndex < state.history.length - 1,
      width: state.w, height: state.h,
      offsetX: state.manualX, offsetY: state.manualY,
    };
  }
  window.VRBrowserBridge = {
    getState: getPublicState,
    navigate(url){ go(url); },
    open(){ setOpen(true); },
    close(){ setOpen(false); },
    onStateChange(cb){ window.addEventListener('vrbrowser:statechange', e => cb(e.detail)); },
  };

  /* ---------------- Construction DOM ---------------- */
  const sides = CFG.stereo ? ['L','R'] : ['mono'];
  const panes = {};   // side -> { root, toggle, panel, iframe, urlInput, homeEl, blockedEl }

  const rootWrap = document.createElement('div');
  rootWrap.className = 'vrbr-root';

  sides.forEach(side => {
    const pane = document.createElement('div');
    pane.className = 'vrbr-pane';
    pane.dataset.side = side;
    pane.innerHTML = `
      <div class="vrbr-anchor">
        <div class="vrbr-panel" hidden>
          <div class="vrbr-titlebar" data-drag>
            <span class="vrbr-dots">⠿</span>
            <div class="vrbr-nav">
              <button data-act="home" title="Accueil">⌂</button>
              <button data-act="back" title="Précédent">◀</button>
              <button data-act="fwd" title="Suivant">▶</button>
              <button data-act="reload" title="Recharger">⟳</button>
            </div>
            <button data-act="external" title="Ouvrir dans un onglet">↗</button>
            <button data-act="close" title="Fermer">✕</button>
          </div>
          <form class="vrbr-urlbar">
            <input type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Rechercher ou entrer une adresse…" />
            <button type="submit">Aller</button>
          </form>
          <div class="vrbr-viewport">
            <div class="vrbr-home">
              <div style="font-size:30px">🌐</div>
              <div style="font-weight:600">Nouvel onglet</div>
              <div class="vrbr-quick">
                <button data-go="https://lite.duckduckgo.com/lite/">DuckDuckGo</button>
                <button data-go="https://fr.m.wikipedia.org/wiki/Accueil">Wikipédia</button>
                <button data-go="https://www.bing.com/">Bing</button>
              </div>
              <small>Certains sites (Google, Instagram, X…) refusent d'être affichés dans une fenêtre intégrée — utilise ↗ pour les ouvrir dans un vrai onglet.</small>
            </div>
            <iframe hidden sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
            <div class="vrbr-blocked">
              <div style="font-size:26px">🚫</div>
              <div>Ce site refuse d'être affiché ici.</div>
              <button data-act="external2">Ouvrir dans un onglet ↗</button>
            </div>
          </div>
          <div class="vrbr-resize" data-resize title="Redimensionner"></div>
        </div>
        <button class="vrbr-toggle" title="Navigateur">🌐</button>
      </div>
    `;
    rootWrap.appendChild(pane);
    panes[side] = {
      root: pane,
      toggle: pane.querySelector('.vrbr-toggle'),
      panel: pane.querySelector('.vrbr-panel'),
      iframe: pane.querySelector('iframe'),
      homeEl: pane.querySelector('.vrbr-home'),
      blockedEl: pane.querySelector('.vrbr-blocked'),
      urlForm: pane.querySelector('.vrbr-urlbar'),
      urlInput: pane.querySelector('.vrbr-urlbar input'),
      titlebar: pane.querySelector('.vrbr-titlebar'),
      resizeHandle: pane.querySelector('.vrbr-resize'),
    };
  });

  function mountWhenReady(){
    if(document.body) document.body.appendChild(rootWrap);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(rootWrap));
  }
  mountWhenReady();
  forEachPane((p, side) => nativePost({ action: 'setup', pane: side }));

  /* ---------------- Rendu / synchro des deux exemplaires (mono ou L+R) ---------------- */
  function forEachPane(fn){ sides.forEach(s => fn(panes[s], s)); }

  function render(){
    forEachPane((p, side) => {
      p.panel.hidden = !state.open;
      p.toggle.classList.toggle('is-open', state.open);
      if(state.w) p.panel.style.width = Math.min(state.w, side_maxW(p)) + 'px';
      if(state.h) p.panel.style.height = state.h + 'px';
      p.urlInput.value = (state.url && state.url !== HOME_URL) ? state.url : '';
      const showHome = !state.url || state.url === HOME_URL;
      p.homeEl.style.display = showHome ? 'flex' : 'none';

      if(NATIVE){
        // Le contenu réel est rendu par une vraie WKWebView native
        // superposée sur `.vrbr-viewport` — jamais d'iframe ici.
        p.iframe.hidden = true;
        if(!state.open || showHome){
          nativePost({ action: 'close', pane: side });
        } else {
          nativePost({ action: 'navigate', pane: side, url: state.url });
          nativePost({ action: 'open', pane: side });
        }
      } else {
        p.iframe.hidden = showHome;
        if(!showHome && p.iframe.src !== state.url) p.iframe.src = state.url;
      }
    });
    broadcastState();
  }

  function side_maxW(p){
    return p.root.getBoundingClientRect().width - 16;
  }

  function setOpen(v){
    state.open = v;
    if(v) requestOrientationPermissionOnce();
    render();
  }

  function go(rawUrl){
    const url = normalizeUrl(rawUrl);
    if(!url) return;
    state.url = url;
    pushHistory(url);
    render();
  }

  function goHome(){ go(HOME_URL); }

  /* ---------------- Actions (identiques sur chaque pane) ---------------- */
  forEachPane(p => {
    p.toggle.addEventListener('click', () => setOpen(!state.open));

    p.urlForm.addEventListener('submit', e => {
      e.preventDefault();
      go(p.urlInput.value);
    });

    p.panel.querySelectorAll('[data-go]').forEach(btn => {
      btn.addEventListener('click', () => go(btn.dataset.go));
    });

    p.panel.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if(act === 'home') goHome();
        else if(act === 'close') setOpen(false);
        else if(act === 'reload'){
          if(NATIVE) forEachPane((q, s) => nativePost({ action: 'reload', pane: s }));
          else forEachPane(q => { if(!q.iframe.hidden){ q.iframe.src = q.iframe.src; } });
        }
        else if(act === 'back'){ if(state.histIndex > 0){ state.histIndex--; state.url = state.history[state.histIndex]; render(); } }
        else if(act === 'fwd'){ if(state.histIndex < state.history.length - 1){ state.histIndex++; state.url = state.history[state.histIndex]; render(); } }
        else if(act === 'external' || act === 'external2'){
          if(state.url && state.url !== HOME_URL){
            if(NATIVE) forEachPane((q, s) => nativePost({ action: 'openExternal', pane: s, url: state.url }));
            else window.open(state.url, '_blank', 'noopener');
          }
        }
      });
    });
  });

  /* ---------------- Déplacement (drag) — met en pause le suivi auto ---------------- */
  let dragState = null;
  forEachPane(p => {
    p.titlebar.addEventListener('pointerdown', e => {
      p.titlebar.setPointerCapture(e.pointerId);
      dragState = {
        startX: e.clientX, startY: e.clientY,
        baseX: state.manualX != null ? state.manualX : offsetX,
        baseY: state.manualY != null ? state.manualY : offsetY,
      };
    });
    p.titlebar.addEventListener('pointermove', e => {
      if(!dragState) return;
      state.manualX = dragState.baseX + (e.clientX - dragState.startX);
      state.manualY = dragState.baseY + (e.clientY - dragState.startY);
      applyOffset(state.manualX, state.manualY);
    });
    const endDrag = () => {
      if(!dragState) return;
      dragState = null;
      // Recale la référence de tête pour repartir en douceur depuis ici,
      // au lieu de "sauter" vers la position auto-suivie.
      settledAlpha = lastAlpha; settledBeta = lastBeta;
      offsetX = state.manualX; offsetY = state.manualY;
      state.manualX = null; state.manualY = null;
    };
    p.titlebar.addEventListener('pointerup', endDrag);
    p.titlebar.addEventListener('pointercancel', endDrag);
  });

  /* ---------------- Redimensionnement ---------------- */
  let resizeState = null;
  forEachPane(p => {
    p.resizeHandle.addEventListener('pointerdown', e => {
      p.resizeHandle.setPointerCapture(e.pointerId);
      const r = p.panel.getBoundingClientRect();
      resizeState = { startX: e.clientX, startY: e.clientY, w: r.width, h: r.height, p };
    });
    p.resizeHandle.addEventListener('pointermove', e => {
      if(!resizeState || resizeState.p !== p) return;
      const dx = e.clientX - resizeState.startX;
      const dy = e.clientY - resizeState.startY;
      const minW = 260, minH = 190;
      const maxW = side_maxW(p), maxH = window.innerHeight - 60;
      state.w = Math.max(minW, Math.min(maxW, resizeState.w + dx));
      state.h = Math.max(minH, Math.min(maxH, resizeState.h + dy));
      render();
    });
    const endResize = () => { resizeState = null; };
    p.resizeHandle.addEventListener('pointerup', endResize);
    p.resizeHandle.addEventListener('pointercancel', endResize);
  });

  /* ---------------- Suivi de tête souple (corps-verrouillé, pas monde/pas rigide) ---------------- */
  let lastAlpha = 0, lastBeta = 0;
  let settledAlpha = null, settledBeta = null;
  let offsetX = 0, offsetY = 0; // valeur affichée actuelle (lissée)
  let orientationReady = false;

  const DEAD_ZONE_DEG = 10;     // petits mouvements de tête ignorés (pas de glue rigide)
  const RECENTER_DEG  = 28;     // au-delà, on recentre progressivement devant soi
  const PX_PER_DEG_X  = 9;
  const PX_PER_DEG_Y  = 7;
  const MAX_OFF_X     = 130;
  const MAX_OFF_Y     = 90;
  const FOLLOW_LERP   = 0.06;   // inertie de la fenêtre (plus petit = plus "en retard")
  const RECENTER_LERP = 0.015;  // vitesse de recentrage de la référence

  function angleDiff(a, b){
    let d = (a - b) % 360;
    if(d > 180) d -= 360;
    if(d < -180) d += 360;
    return d;
  }

  function onOrientation(e){
    if(e.alpha == null) return;
    orientationReady = true;
    lastAlpha = e.alpha;
    lastBeta = e.beta || 0;
    if(settledAlpha === null){ settledAlpha = lastAlpha; settledBeta = lastBeta; }
  }

  function applyOffset(x, y){
    forEachPane(p => {
      p.root.style.setProperty('--vrbr-x', x + 'px');
      p.root.style.setProperty('--vrbr-y', y + 'px');
    });
  }

  function tickFollow(){
    if(state.open && orientationReady && dragState === null && state.manualX === null){
      const dYaw = angleDiff(lastAlpha, settledAlpha);
      const dPitch = lastBeta - settledBeta;

      let targetX = 0, targetY = 0;
      if(Math.abs(dYaw) > DEAD_ZONE_DEG){
        targetX = Math.max(-MAX_OFF_X, Math.min(MAX_OFF_X, dYaw * PX_PER_DEG_X));
      }
      if(Math.abs(dPitch) > DEAD_ZONE_DEG){
        targetY = Math.max(-MAX_OFF_Y, Math.min(MAX_OFF_Y, -dPitch * PX_PER_DEG_Y));
      }

      // Recentrage progressif : si on a beaucoup tourné la tête, la
      // référence "settled" rattrape doucement l'orientation actuelle,
      // ce qui ramène la fenêtre devant soi sans à-coup — jamais figée
      // dans le monde, jamais collée à 100% au regard non plus.
      if(Math.abs(dYaw) > RECENTER_DEG){ settledAlpha += angleDiff(lastAlpha, settledAlpha) * RECENTER_LERP; }
      if(Math.abs(dPitch) > RECENTER_DEG){ settledBeta += (lastBeta - settledBeta) * RECENTER_LERP; }

      offsetX += (targetX - offsetX) * FOLLOW_LERP;
      offsetY += (targetY - offsetY) * FOLLOW_LERP;
      applyOffset(offsetX, offsetY);
    }
    requestAnimationFrame(tickFollow);
  }
  requestAnimationFrame(tickFollow);

  let orientationBound = false;
  function bindOrientation(){
    if(orientationBound) return;
    orientationBound = true;
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }
  function requestOrientationPermissionOnce(){
    if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      DeviceOrientationEvent.requestPermission().then(res => {
        if(res === 'granted') bindOrientation();
      }).catch(() => {});
    } else {
      bindOrientation();
    }
  }
  // Sur Android / desktop il n'y a pas de permission à demander : on écoute tout de suite.
  if(!(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')){
    bindOrientation();
  }

  /* ---------------- Synchro du cadre WKWebView natif ----------------
     Tant que le panneau est ouvert et affiche une vraie page (pas la
     page d'accueil), on renvoie en continu au natif le rectangle écran
     exact de `.vrbr-viewport` (position + taille), pour que la WKWebView
     native colle pile dessus — que ce déplacement vienne du drag manuel,
     du redimensionnement, ou du suivi de tête automatique ci-dessus. */
  const PANEL_RADIUS = 16;
  function tickNativeFrame(){
    if(NATIVE && state.open && state.url && state.url !== HOME_URL){
      forEachPane((p, side) => {
        const r = p.iframe.parentElement.getBoundingClientRect(); // .vrbr-viewport
        nativePost({
          action: 'frame', pane: side,
          x: Math.round(r.left), y: Math.round(r.top),
          width: Math.round(r.width), height: Math.round(r.height),
          cornerRadius: PANEL_RADIUS,
        });
      });
    }
    requestAnimationFrame(tickNativeFrame);
  }
  if(NATIVE) requestAnimationFrame(tickNativeFrame);

  render();
})();
