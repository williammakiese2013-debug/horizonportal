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
    startUrl: 'https://lite.duckduckgo.com/lite/',
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
    setPlanesVisible(true);
  }

  function closeBrowser() {
    shared.open = false;
    setPlanesVisible(false);
  }

  function toggleBrowser() {
    if (shared.open) closeBrowser(); else openBrowser();
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
