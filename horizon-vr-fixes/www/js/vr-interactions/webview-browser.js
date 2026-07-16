/* ============================================================
   WEBVIEW BROWSER — Navigateur 3D world-locked (WebView-to-Texture)
   ============================================================
   Remplace l'ancien vr-browser.js (bulle 2D "corps-verrouillée" +
   pont vers une WKWebView native superposée en 2D par-dessus l'écran,
   voir native/ios/VRNativeBrowser.swift, désormais obsolète).

   Ici, la page web n'est JAMAIS affichée en 2D par-dessus l'écran :
   une WKWebView native headless (native/ios/WebViewTexturePlugin.swift)
   restitue la page dans un buffer image, qu'on reçoit ici en JPEG/base64
   et qu'on peint dans un <canvas> -> THREE.CanvasTexture appliqué à un
   <a-plane> RÉEL dans la scène 3D (un par œil : #webviewBrowserL et
   #webviewBrowserR, tous deux insérés comme frères de camRigL/camRigR
   dans index.html — donc PAS enfants de la caméra : le plan ne bouge
   pas quand on tourne la tête, il est fixe dans le monde, et comme
   c'est un objet de scène normal il est rendu par les deux <a-scene>
   (œil gauche / œil droit) exactement pareil -> vraie stéréo.

   Entrée tactile : voir js/vr-interactions/handPointer.js, qui appelle
   window.__webviewBrowserHitTest(screenX, screenY) AVANT de faire un
   elementFromPoint DOM classique. Si le rayon touche un des deux plans,
   on convertit l'UV en pixel de la résolution virtuelle de la
   WKWebView cachée et on pilote tap()/scrollBy() du plugin natif au
   lieu de cliquer un élément DOM.

   Sans le plugin natif (test dans un navigateur normal, hors app iOS),
   le plan affiche un simple message d'attente — impossible de faire du
   vrai rendu WebView-to-texture en dehors du shell natif.
   ============================================================ */
(function () {
  'use strict';

  const CFG = Object.assign({
    startUrl: 'https://www.google.com',
    resW: 1024,
    resH: 672,
    fps: 8,
    quality: 0.6
  }, window.WEBVIEW_BROWSER_CONFIG || {});

  const NATIVE = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WebViewTexture);
  const Plugin = NATIVE ? window.Capacitor.Plugins.WebViewTexture : null;

  /* ---------------- État partagé entre les deux yeux ---------------- */
  const shared = {
    open: false,
    loaded: false,
    lastFrameImg: new Image(),
    surfaces: {}, // 'L' / 'R' -> { canvas, ctx, texture, el }
    currentUrl: CFG.startUrl,
    addressDraft: '', // texte en cours d'édition dans la barre d'adresse
    kbTarget: null,   // 'address' | 'page' | null (null = clavier fermé)
    kbHideTimer: null
  };

  shared.lastFrameImg.onload = function () {
    Object.keys(shared.surfaces).forEach(function (eye) {
      const s = shared.surfaces[eye];
      s.ctx.drawImage(shared.lastFrameImg, 0, 0, s.canvas.width, s.canvas.height);
      s.texture.needsUpdate = true;
    });
  };

  function drawPlaceholder(ctx, w, h, text) {
    ctx.fillStyle = '#11131a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(127,233,255,.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#cfd3dc';
    ctx.font = Math.round(h * 0.045) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, text, w / 2, h / 2, w * 0.8, h * 0.06);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxWidth && line !== '') {
        lines.push(line);
        line = words[i] + ' ';
      } else {
        line = test;
      }
    }
    lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach(function (l, i) { ctx.fillText(l.trim(), x, startY + i * lineHeight); });
  }

  /* ---------------- Composant A-Frame : une surface par œil ---------------- */
  AFRAME.registerComponent('webview-browser-surface', {
    schema: { eye: { type: 'string', default: 'L' } },

    init: function () {
      const eye = this.data.eye;
      const canvas = document.createElement('canvas');
      canvas.width = CFG.resW;
      canvas.height = CFG.resH;
      const ctx = canvas.getContext('2d');

      if (NATIVE) {
        drawPlaceholder(ctx, canvas.width, canvas.height, 'Chargement du navigateur…');
      } else {
        drawPlaceholder(ctx, canvas.width, canvas.height,
          'Navigateur 3D indisponible hors de l\'app native (WebViewTexture plugin absent).');
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      shared.surfaces[eye] = { canvas: canvas, ctx: ctx, texture: texture, el: this.el };

      const applyTexture = function () {
        const mesh = this.el.getObject3D('mesh');
        if (!mesh || !mesh.material) return;
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }.bind(this);

      if (this.el.getObject3D('mesh')) applyTexture();
      else this.el.addEventListener('loaded', applyTexture, { once: true });
    }
  });

  /* ---------------- Chargement / init du plugin natif (une seule fois) ---------------- */
  function ensureLoaded() {
    if (shared.loaded || !NATIVE) return;
    shared.loaded = true;
    Plugin.addListener('frameUpdate', function (evt) {
      shared.lastFrameImg.src = 'data:image/jpeg;base64,' + evt.image;
    });
    Plugin.addListener('loadFinished', function (evt) {
      if (evt && evt.url) {
        shared.currentUrl = evt.url;
        updateAddressBarDisplay();
      }
    });
    // La page elle-même signale qu'un champ (recherche Google, formulaire...)
    // vient de prendre ou perdre le focus -> on affiche/masque le clavier
    // virtuel tout seul, comme le ferait un vrai clavier iOS.
    Plugin.addListener('inputFocus', function (evt) {
      if (evt && evt.focused) {
        if (shared.kbHideTimer) { clearTimeout(shared.kbHideTimer); shared.kbHideTimer = null; }
        openKeyboard('page');
      } else {
        if (shared.kbHideTimer) clearTimeout(shared.kbHideTimer);
        shared.kbHideTimer = setTimeout(function () {
          if (shared.kbTarget === 'page') closeKeyboard();
        }, 220);
      }
    });
    Plugin.load({ url: CFG.startUrl, width: CFG.resW, height: CFG.resH, fps: CFG.fps, quality: CFG.quality });
  }

  function setPlanesVisible(v) {
    Object.keys(shared.surfaces).forEach(function (eye) {
      const el = shared.surfaces[eye].el;
      if (el) el.setAttribute('visible', v);
    });
  }

  function openBrowser() {
    shared.open = true;
    ensureLoaded();
    ensureBrowserUI();
    setPlanesVisible(true);
    const ui = document.getElementById('wvb-ui');
    if (ui) ui.classList.add('is-open');
    updateAddressBarDisplay();
  }

  function closeBrowser() {
    shared.open = false;
    setPlanesVisible(false);
    closeKeyboard();
    const ui = document.getElementById('wvb-ui');
    if (ui) ui.classList.remove('is-open');
  }

  function toggleBrowser() {
    if (shared.open) closeBrowser(); else openBrowser();
  }

  /* ---------------- Barre d'adresse + clavier virtuel ----------------
     Overlay 2D fixe par-dessus l'écran, dans le même esprit minimal que le
     bouton #wvb-toggle ci-dessous (pas un vrai objet stéréo 3D, juste un
     HUD 2D visible pendant que le navigateur est ouvert). Tout est regroupé
     sous #wvb-ui pour que hitTest() (plus bas) sache l'ignorer et laisser
     handPointer.js gérer ces éléments comme du DOM classique. */
  const KB_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['⇧', 'w', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
    ['.', '-', '_', '@', 'espace', '/', '.com', '↵']
  ];
  let kbShift = false;

  function ensureBrowserUI() {
    if (document.getElementById('wvb-ui')) return;

    const style = document.createElement('style');
    style.textContent = `
    #wvb-ui{ display:none; }
    #wvb-ui.is-open{ display:block; }
    #wvb-toolbar{
      position:fixed;top:16px;left:50%;transform:translateX(-50%);
      z-index:9999;display:flex;align-items:center;gap:8px;
      padding:8px 10px;border-radius:22px;max-width:min(720px,72vw);
      background:var(--glass-bg);backdrop-filter:blur(18px) saturate(140%);
      -webkit-backdrop-filter:blur(18px) saturate(140%);
      border:1px solid var(--glass-border);box-shadow:var(--shadow-vision);
    }
    .wvb-btn{
      width:34px;height:34px;flex:none;border-radius:50%;display:flex;
      align-items:center;justify-content:center;color:#f4f4f4;font-size:16px;
      background:rgba(255,255,255,.08);cursor:pointer;user-select:none;
      -webkit-tap-highlight-color:transparent;
    }
    .wvb-btn:active{ background:rgba(255,255,255,.22); }
    #wvb-url{
      flex:1;min-width:0;padding:7px 14px;border-radius:16px;color:#f4f4f4;
      font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.18);
      cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
    }
    #wvb-url.is-editing{ background:rgba(90,170,255,.22);border-color:rgba(90,170,255,.6);color:#fff; }
    #wvb-keyboard{
      position:fixed;left:50%;bottom:92px;transform:translateX(-50%);
      z-index:9999;display:none;flex-direction:column;gap:6px;
      padding:10px;border-radius:18px;
      background:var(--glass-bg-strong);backdrop-filter:blur(22px) saturate(150%);
      -webkit-backdrop-filter:blur(22px) saturate(150%);
      border:1px solid var(--glass-border);box-shadow:var(--shadow-vision);
    }
    #wvb-keyboard.is-open{ display:flex; }
    .wvb-kb-row{ display:flex; gap:5px; justify-content:center; }
    .wvb-key{
      min-width:30px;height:38px;padding:0 6px;border-radius:8px;
      background:rgba(255,255,255,.1);color:#f4f4f4;font-size:15px;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
    }
    .wvb-key:active{ background:rgba(255,255,255,.28); }
    .wvb-key.wvb-wide{ min-width:96px; }
    .wvb-key.wvb-space{ min-width:220px; }
    .wvb-key.wvb-active{ background:rgba(90,170,255,.45); }
    `;
    document.head.appendChild(style);

    const ui = document.createElement('div');
    ui.id = 'wvb-ui';
    ui.innerHTML = `
      <div id="wvb-toolbar">
        <div class="wvb-btn" data-wvb="back">←</div>
        <div class="wvb-btn" data-wvb="forward">→</div>
        <div class="wvb-btn" data-wvb="reload">⟳</div>
        <div id="wvb-url" data-wvb="editurl"></div>
      </div>
      <div id="wvb-keyboard"></div>
    `;
    document.body.appendChild(ui);

    const kb = ui.querySelector('#wvb-keyboard');
    KB_ROWS.forEach(function (row) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wvb-kb-row';
      row.forEach(function (key) {
        const k = document.createElement('div');
        k.className = 'wvb-key';
        k.dataset.key = key;
        if (key === 'espace') { k.classList.add('wvb-space'); k.textContent = ''; }
        else if (key === '.com' || key === '↵' || key === '⌫' || key === '⇧') { k.classList.add('wvb-wide'); k.textContent = key; }
        else { k.textContent = key; }
        rowEl.appendChild(k);
      });
      kb.appendChild(rowEl);
    });

    ui.addEventListener('click', function (ev) {
      const action = ev.target.closest('[data-wvb]');
      if (action) {
        const cmd = action.dataset.wvb;
        if (cmd === 'back') { Plugin && NATIVE && Plugin.goBack(); }
        else if (cmd === 'forward') { Plugin && NATIVE && Plugin.goForward(); }
        else if (cmd === 'reload') { Plugin && NATIVE && Plugin.reload(); }
        else if (cmd === 'editurl') { openAddressEditor(); }
        return;
      }
      const keyEl = ev.target.closest('.wvb-key');
      if (keyEl) handleKey(keyEl.dataset.key);
    });

    updateAddressBarDisplay();
  }

  function updateAddressBarDisplay() {
    const urlEl = document.getElementById('wvb-url');
    if (!urlEl || shared.kbTarget === 'address') return;
    urlEl.textContent = shared.currentUrl;
  }

  function openAddressEditor() {
    shared.addressDraft = shared.currentUrl;
    const urlEl = document.getElementById('wvb-url');
    if (urlEl) { urlEl.classList.add('is-editing'); urlEl.textContent = shared.addressDraft; }
    openKeyboard('address');
  }

  function commitAddressEditor() {
    const urlEl = document.getElementById('wvb-url');
    if (urlEl) urlEl.classList.remove('is-editing');
    const raw = (shared.addressDraft || '').trim();
    if (!raw) return;
    const looksLikeUrl = /^https?:\/\//i.test(raw) || (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw) && !raw.includes(' '));
    const target = looksLikeUrl
      ? (/^https?:\/\//i.test(raw) ? raw : 'https://' + raw)
      : 'https://www.google.com/search?q=' + encodeURIComponent(raw);
    window.HorizonWebBrowser.navigate(target);
  }

  function openKeyboard(target) {
    shared.kbTarget = target;
    const kb = document.getElementById('wvb-keyboard');
    if (kb) kb.classList.add('is-open');
  }

  function closeKeyboard() {
    const wasAddress = shared.kbTarget === 'address';
    shared.kbTarget = null;
    const kb = document.getElementById('wvb-keyboard');
    if (kb) kb.classList.remove('is-open');
    if (wasAddress) {
      const urlEl = document.getElementById('wvb-url');
      if (urlEl) urlEl.classList.remove('is-editing');
      updateAddressBarDisplay();
    }
  }

  function handleKey(key) {
    if (!shared.kbTarget) return;

    if (key === '⇧') {
      kbShift = !kbShift;
      document.querySelectorAll('#wvb-keyboard .wvb-key').forEach(function (k) {
        if (k.dataset.key === '⇧') k.classList.toggle('wvb-active', kbShift);
        else if (k.dataset.key.length === 1 && /[a-z]/i.test(k.dataset.key)) {
          k.textContent = kbShift ? k.dataset.key.toUpperCase() : k.dataset.key;
        }
      });
      return;
    }

    let insert = null;
    let action = null;
    if (key === '⌫') action = 'backspace';
    else if (key === '↵') action = 'enter';
    else if (key === 'espace') insert = ' ';
    else if (key === '.com') insert = '.com';
    else insert = kbShift ? key.toUpperCase() : key;

    if (shared.kbTarget === 'address') {
      if (action === 'backspace') shared.addressDraft = shared.addressDraft.slice(0, -1);
      else if (action === 'enter') { commitAddressEditor(); closeKeyboard(); return; }
      else if (insert != null) shared.addressDraft += insert;
      const urlEl = document.getElementById('wvb-url');
      if (urlEl) urlEl.textContent = shared.addressDraft;
    } else if (shared.kbTarget === 'page') {
      if (!NATIVE) return;
      if (action) Plugin.keyAction({ action: action });
      else if (insert != null) Plugin.typeText({ text: insert });
    }

    if (kbShift && insert != null && key !== '.com' && key !== ' ') {
      kbShift = false;
      document.querySelectorAll('#wvb-keyboard .wvb-key').forEach(function (k) {
        if (k.dataset.key === '⇧') k.classList.remove('wvb-active');
        else if (k.dataset.key.length === 1 && /[a-z]/i.test(k.dataset.key)) k.textContent = k.dataset.key;
      });
    }
  }

  /* ---------------- Bouton flottant minimal (ouvrir/fermer) ----------------
     Volontairement simple : un seul bouton rond, sans barre d'adresse
     flottante en 2D (c'est justement ce qu'on retire). Naviguer vers une
     autre URL se fait depuis l'intérieur de la page (comme un vrai
     navigateur), ou via window.HorizonWebBrowser.navigate(url) plus bas. */
  function ensureToggleButton() {
    if (document.getElementById('wvb-toggle')) return;
    const style = document.createElement('style');
    style.textContent = `
    #wvb-toggle{
      position:fixed;left:50%;bottom:22px;transform:translateX(-50%);
      width:56px;height:56px;border-radius:50%;z-index:9999;
      background:rgba(20,22,30,.55);border:2px solid rgba(255,255,255,.4);
      color:#f4f4f4;font-size:24px;display:flex;align-items:center;justify-content:center;
      cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
      box-shadow:0 4px 14px rgba(0,0,0,.35);transition:background .15s,transform .15s;
    }
    #wvb-toggle:active{transform:translateX(-50%) scale(.92)}
    #wvb-toggle.is-open{background:rgba(90,170,255,.55)}
    `;
    document.head.appendChild(style);
    const btn = document.createElement('div');
    btn.id = 'wvb-toggle';
    btn.innerHTML = '🌐';
    btn.addEventListener('click', function () {
      toggleBrowser();
      btn.classList.toggle('is-open', shared.open);
    });
    document.body.appendChild(btn);
  }

  /* ---------------- Raycast hit-test (utilisé par handPointer.js) ----------------
     screenX/screenY sont en coordonnées écran globales (fenêtre entière,
     les deux moitiés gauche/droite confondues, comme fournies par
     HorizonHandNav). On déduit l'œil concerné selon la moitié d'écran,
     on construit un rayon depuis la caméra de CET œil, et on teste
     l'intersection avec SON plan. Renvoie null si rien touché, sinon
     { uv } pour laisser handPointer.js router tap()/scrollBy(). */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function hitTest(screenX, screenY) {
    if (!NATIVE || !shared.open) return null;

    // La barre d'adresse et le clavier virtuel (#wvb-ui) sont du DOM 2D
    // classique par-dessus l'écran, PAS le plan 3D du navigateur. Comme le
    // raycast ci-dessous se base sur des coordonnées écran (il ignore
    // l'empilement DOM au-dessus du <canvas>), on doit explicitement
    // laisser passer ces taps vers le pipeline DOM normal de handPointer.js
    // au lieu de les router vers la page web headless.
    const domEl = document.elementFromPoint(screenX, screenY);
    if (domEl && domEl.closest && domEl.closest('#wvb-ui')) return null;

    const halfW = window.innerWidth / 2;
    const eye = screenX < halfW ? 'L' : 'R';
    const surface = shared.surfaces[eye];
    if (!surface) return null;

    const sceneEl = document.querySelector(eye === 'L' ? '#eyeLeft a-scene' : '#eyeRight a-scene');
    if (!sceneEl || !sceneEl.hasLoaded) return null;
    const camera = sceneEl.camera;
    const mesh = surface.el.getObject3D('mesh');
    if (!camera || !mesh) return null;

    const canvasEl = sceneEl.canvas;
    const rect = canvasEl.getBoundingClientRect();
    const localX = eye === 'L' ? screenX : screenX - halfW;

    ndc.x = (localX / rect.width) * 2 - 1;
    ndc.y = -((screenY / rect.height) * 2 - 1);

    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(mesh, false);
    if (!hits.length || !hits[0].uv) return null;

    return { uv: hits[0].uv };
  }
  window.__webviewBrowserHitTest = hitTest;

  function uvToPixel(uv) {
    return { x: uv.x * CFG.resW, y: (1 - uv.y) * CFG.resH };
  }

  /* Pont public, dans le même esprit que window.VRBrowserBridge avant. */
  window.HorizonWebBrowser = {
    open: openBrowser,
    close: closeBrowser,
    toggle: toggleBrowser,
    isOpen: function () { return shared.open; },
    navigate: function (url) {
      if (!NATIVE) return;
      ensureLoaded();
      Plugin.load({ url: url, width: CFG.resW, height: CFG.resH, fps: CFG.fps, quality: CFG.quality });
    },
    // Appelé par handPointer.js quand le hit-test ci-dessus a réussi.
    tap: function (uv) {
      if (!NATIVE) return;
      const px = uvToPixel(uv);
      Plugin.tap({ x: px.x, y: px.y });
    },
    // deltaY : delta écran (px) tel que fourni par HorizonHandNav, comme pour
    // un scroll DOM classique. On le remet à l'échelle de la résolution
    // virtuelle de la WKWebView cachée.
    scroll: function (deltaY) {
      if (!NATIVE) return;
      Plugin.scrollBy({ dx: 0, dy: deltaY * (CFG.resH / window.innerHeight) * 2 });
    }
  };

  document.addEventListener('DOMContentLoaded', ensureToggleButton);
  if (document.readyState !== 'loading') ensureToggleButton();
})();
