/* ============================================================
   PERF 01 — Réglages renderer THREE.js (les deux a-scene, œil G/D)
   ------------------------------------------------------------
   Le site affiche l'app en DOUBLE : une <a-scene> par œil, donc
   DEUX renderers WebGL tournent en même temps en permanence.
   C'est la cause n°1 de lag / surchauffe / crash sur mobile.
   Ce fichier attend que chaque scène soit chargée puis applique
   des réglages qui réduisent la charge GPU sans changer le rendu
   visuel de façon perceptible.
   ============================================================ */
(function(){
  'use strict';

  const isMobile = /Android|iPhone|iPad|iPod|Quest|Oculus/i.test(navigator.userAgent);

  // Pixel ratio cible : sur mobile, afficher en 2x/3x la résolution
  // native ne sert à rien à l'œil mais double/triple le travail du GPU.
  // Sur un rendu stéréo (x2 scènes) on est encore plus strict.
  const TARGET_DPR = isMobile ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2);

  function tuneScene(sceneEl){
    if(!sceneEl) return;

    const apply = () => {
      const renderer = sceneEl.renderer;
      if(!renderer) return;

      // 1) Cap du pixel ratio (le gain perf est souvent x1.5 à x2)
      renderer.setPixelRatio(TARGET_DPR);

      // 2) On choisit explicitement le GPU performant sur les machines
      //    à double carte graphique (portables) — évite de tomber sur
      //    le GPU intégré faible par défaut.
      try{
        const ctx = renderer.getContext();
        if(ctx && ctx.getContextAttributes){
          const attrs = ctx.getContextAttributes();
          attrs.powerPreference = 'high-performance';
        }
      }catch(e){ /* ignore */ }

      // 3) Désactive le shadow map si jamais un composant l'a activé :
      //    sur ce type de scène (photos 360°/UI plate) les ombres ne
      //    servent à rien et coûtent cher.
      renderer.shadowMap.enabled = false;

      // 4) Limite l'anisotropie (netteté des textures en angle) :
      //    au-delà de 4 le gain visuel est imperceptible sur un fond
      //    360°, mais le coût mémoire/texture grimpe vite.
      try{
        const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
        renderer.__horizonMaxAniso = Math.min(maxAniso, 4);
      }catch(e){ renderer.__horizonMaxAniso = 4; }

      // 5) Précision shader : "highp" n'est utile que pour du calcul
      //    scientifique ; "mediump" suffit largement pour de l'affichage
      //    et est nettement plus rapide sur GPU mobile.
      if(renderer.getContext && renderer.getContext().getShaderPrecisionFormat){
        renderer.__horizonPrecisionHint = 'mediump';
      }
    };

    if(sceneEl.hasLoaded) apply();
    else sceneEl.addEventListener('loaded', apply, { once:true });
  }

  /* ------------------------------------------------------------
     Détection de la vraie carte graphique (GPU) de l'appareil,
     via l'extension WebGL debug_renderer_info. Utilisé par la
     page Réglages > Général > À propos pour afficher le vrai
     matériel de l'appareil (comme un vrai écran "À propos").
     ------------------------------------------------------------ */
  function detectGPU(){
    try{
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if(!gl){ try{ state.deviceGPU = 'Non détectée'; }catch(_){} return; }
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      state.deviceGPU = renderer || 'Non détectée';
      state.deviceGPUVendor = vendor || '';
      state.deviceWebGLVersion = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) ? 'WebGL 2.0' : 'WebGL 1.0';
    }catch(e){
      try{ state.deviceGPU = 'Non détectée'; }catch(_){}
    }
  }

  function init(){
    document.querySelectorAll('a-scene').forEach(tuneScene);
    detectGPU();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HorizonPerf = window.HorizonPerf || {};
  window.HorizonPerf.targetDPR = TARGET_DPR;
})();
