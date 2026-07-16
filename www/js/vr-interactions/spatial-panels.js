/* ============================================================
   SPATIAL PANELS — Launchpad + Fenêtre d'app ("Jeux" inclus)
   world-locked, façon Vision Pro
   ============================================================
   Même principe que js/vr-interactions/webview-browser.js, mais pour
   les panneaux DOM existants (#launchpadCenterL/R, #appWindowCenterL/R)
   au lieu d'une WKWebView native : on capture périodiquement leur
   contenu HTML réel (déjà généré par renderHUD(), buildLaunchpadHTML(),
   buildAppWindowHTML(), etc. — RIEN n'est changé côté génération du
   HUD) via html2canvas, on peint le résultat dans un <canvas> ->
   THREE.CanvasTexture, et on applique cette texture à un <a-plane> RÉEL,
   posé fixe dans la scène 3D (frère de camRigL/camRigR dans index.html,
   donc PAS enfant de la caméra : il ne bouge pas quand on tourne la
   tête).

   Les éléments DOM sources (#launchpadWrapL/R, #appWindowWrapL/R) sont
   rendus invisibles à l'écran par CSS (voir www/css/main.css,
   opacity:0), mais restent dans le flux normal du document (pas
   display:none) : ils gardent donc une vraie position/taille à l'écran,
   ce qui permet de router les clics en calculant les coordonnées écran
   réelles correspondant à un point UV du plan 3D, puis en laissant le
   pipeline DOM existant (handPointer.js -> elementFromPoint + clic
   simulé) faire le reste, exactement comme s'il s'agissait d'un vrai
   tap sur cette zone de l'écran.
   ============================================================ */
(function () {
  'use strict';

  var PANELS = [
    { key: 'launchpad', wrapId: 'launchpadWrap', centerId: 'launchpadCenter', planeId: 'launchpadPanel', isOpen: function () { return !!(window.state && state.launchpadOpen); } },
    { key: 'appwindow', wrapId: 'appWindowWrap', centerId: 'appWindowCenter', planeId: 'appWindowPanel', isOpen: function () { return !!(window.state && state.activeApp); } }
  ];

  var CAPTURE_INTERVAL_MS = 130; // ~7-8 fps, largement suffisant pour une UI
  var HAS_HTML2CANVAS = typeof window.html2canvas === 'function';

  /* surfaces[panelKey][eye] = { canvas, ctx, texture, planeEl, wrapEl, centerEl } */
  var surfaces = { launchpad: {}, appwindow: {} };

  function drawPlaceholder(ctx, w, h, text) {
    ctx.fillStyle = '#11131a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(127,233,255,.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    if (!text) return;
    ctx.fillStyle = '#cfd3dc';
    ctx.font = Math.round(h * 0.035) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  }

  AFRAME.registerComponent('dom-panel-surface', {
    schema: { panel: { type: 'string' }, eye: { type: 'string', default: 'L' } },

    init: function () {
      var panel = this.data.panel;
      var eye = this.data.eye;
      var cfg = PANELS.filter(function (p) { return p.key === panel; })[0];
      if (!cfg) return;

      var canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 768;
      var ctx = canvas.getContext('2d');
      drawPlaceholder(ctx, canvas.width, canvas.height, HAS_HTML2CANVAS ? '' : 'html2canvas manquant');

      var texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      surfaces[panel][eye] = {
        canvas: canvas, ctx: ctx, texture: texture,
        planeEl: this.el,
        wrapEl: document.getElementById(cfg.wrapId + eye),
        centerEl: document.getElementById(cfg.centerId + eye)
      };

      var applyTexture = function () {
        var mesh = this.el.getObject3D('mesh');
        if (!mesh || !mesh.material) return;
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }.bind(this);

      if (this.el.getObject3D('mesh')) applyTexture();
      else this.el.addEventListener('loaded', applyTexture, { once: true });
    }
  });

  /* ---------------- Boucle de capture ---------------- */
  function captureOne(panelKey, cfg) {
    var pair = surfaces[panelKey];
    var srcEye = pair.L || pair.R;
    if (!srcEye || !srcEye.centerEl) return;
    if (!HAS_HTML2CANVAS) return;

    var open = cfg.isOpen();
    setPanelVisible(panelKey, open);
    if (!open) return;

    var srcEl = srcEye.centerEl;
    if (!srcEl.offsetWidth || !srcEl.offsetHeight) return;

    window.html2canvas(srcEl, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: 1
    }).then(function (rendered) {
      ['L', 'R'].forEach(function (eye) {
        var s = pair[eye];
        if (!s) return;
        if (s.canvas.width !== rendered.width || s.canvas.height !== rendered.height) {
          s.canvas.width = rendered.width;
          s.canvas.height = rendered.height;
        }
        s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
        s.ctx.drawImage(rendered, 0, 0);
        s.texture.needsUpdate = true;
      });
    }).catch(function () { /* capture ratée : on garde la dernière image valide */ });
  }

  function setPanelVisible(panelKey, visible) {
    var pair = surfaces[panelKey];
    ['L', 'R'].forEach(function (eye) {
      var s = pair[eye];
      if (s && s.planeEl) s.planeEl.setAttribute('visible', visible);
    });
  }

  function tick() {
    PANELS.forEach(function (cfg) { captureOne(cfg.key, cfg); });
  }
  setInterval(tick, CAPTURE_INTERVAL_MS);

  /* ---------------- Raycast hit-test (utilisé par handPointer.js) ----------------
     Renvoie les coordonnées écran RÉELLES (celles du DOM, invisible mais
     toujours dans le flux) correspondant au point UV touché sur le plan
     3D, pour que handPointer.js puisse continuer avec son pipeline
     habituel (elementFromPoint + clic simulé / __handTrackPinchClick),
     sans dupliquer cette logique ici. */
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function hitTest(screenX, screenY) {
    var halfW = window.innerWidth / 2;
    var eye = screenX < halfW ? 'L' : 'R';

    for (var i = 0; i < PANELS.length; i++) {
      var cfg = PANELS[i];
      if (!cfg.isOpen()) continue;
      var s = surfaces[cfg.key][eye];
      if (!s || !s.planeEl || !s.wrapEl) continue;

      var sceneEl = document.querySelector(eye === 'L' ? '#eyeLeft a-scene' : '#eyeRight a-scene');
      if (!sceneEl || !sceneEl.hasLoaded) continue;
      var camera = sceneEl.camera;
      var mesh = s.planeEl.getObject3D('mesh');
      if (!camera || !mesh) continue;

      var canvasEl = sceneEl.canvas;
      var rect = canvasEl.getBoundingClientRect();
      var localX = eye === 'L' ? screenX : screenX - halfW;

      ndc.x = (localX / rect.width) * 2 - 1;
      ndc.y = -((screenY / rect.height) * 2 - 1);

      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObject(mesh, false);
      if (!hits.length || !hits[0].uv) continue;

      var uv = hits[0].uv;
      var wrapRect = s.wrapEl.getBoundingClientRect();
      return {
        x: wrapRect.left + uv.x * wrapRect.width,
        y: wrapRect.top + (1 - uv.y) * wrapRect.height
      };
    }
    return null;
  }

  window.__spatialPanelHitTest = hitTest;
})();
