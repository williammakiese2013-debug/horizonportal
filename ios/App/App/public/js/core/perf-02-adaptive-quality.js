/* ============================================================
   PERF 02 — Qualité adaptative selon les FPS réels
   ------------------------------------------------------------
   Mesure les FPS en continu. Si ça rame, on baisse automatiquement
   la résolution de rendu (pixelRatio) et on coupe les effets
   visuels non-essentiels (classe .ai-perf-mode déjà gérée par
   css/performance.css : transitions et animations coupées).
   Si les FPS remontent, on réactive tout progressivement.
   Objectif : ne JAMAIS rester bloqué en dessous de ~30fps,
   sans jamais réduire la qualité si le téléphone/PC encaisse.
   ============================================================ */
(function(){
  'use strict';

  const LOW_FPS_THRESHOLD  = 33;  // en dessous : on dégrade
  const HIGH_FPS_THRESHOLD = 50;  // au dessus, on remonte la qualité
  const SAMPLE_WINDOW_MS   = 2000; // on juge sur une moyenne de 2s (évite les faux positifs d'un seul frame lourd)

  let frames = 0;
  let windowStart = performance.now();
  let qualityLevel = 3; // 3 = max, 0 = min
  const MIN_LEVEL = 0, MAX_LEVEL = 3;

  function currentDPR(level){
    const base = (window.HorizonPerf && window.HorizonPerf.targetDPR) || Math.min(window.devicePixelRatio || 1, 2);
    // Chaque niveau en moins réduit la résolution de rendu d'un cran
    const steps = [base, base * 0.85, base * 0.7, base * 0.55];
    return Math.max(0.5, steps[MAX_LEVEL - level] || base);
  }

  function applyLevel(level){
    qualityLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    const dpr = currentDPR(qualityLevel);

    document.querySelectorAll('a-scene').forEach(sceneEl=>{
      const renderer = sceneEl.renderer;
      if(renderer) renderer.setPixelRatio(dpr);
    });

    // En dessous du niveau max : on coupe transitions/animations CSS
    // coûteuses (classe déjà prévue dans css/performance.css).
    document.body.classList.toggle('ai-perf-mode', qualityLevel < MAX_LEVEL);

    // Niveau critique (0) : on prévient les autres scripts qu'il faut
    // réduire encore plus (ex: baisser la fréquence de mise à jour du
    // hand-tracking, arrêter des particules, etc.) via un évènement custom.
    document.dispatchEvent(new CustomEvent('horizon:quality-change', { detail:{ level:qualityLevel, dpr } }));
  }

  function tick(){
    frames++;
    const now = performance.now();
    const elapsed = now - windowStart;

    if(elapsed >= SAMPLE_WINDOW_MS){
      const fps = (frames * 1000) / elapsed;
      frames = 0;
      windowStart = now;

      if(fps < LOW_FPS_THRESHOLD && qualityLevel > MIN_LEVEL){
        applyLevel(qualityLevel - 1);
      } else if(fps > HIGH_FPS_THRESHOLD && qualityLevel < MAX_LEVEL){
        applyLevel(qualityLevel + 1);
      }

      window.HorizonPerf = window.HorizonPerf || {};
      window.HorizonPerf.lastFPS = Math.round(fps);
      window.HorizonPerf.qualityLevel = qualityLevel;
    }

    // On coupe la boucle si l'onglet/l'appli est en arrière-plan
    // (voir perf-03) pour ne pas gaspiller batterie/CPU pour rien.
    if(!document.hidden){
      requestAnimationFrame(tick);
    } else {
      window.__horizonPerfLoopPaused = true;
    }
  }

  requestAnimationFrame(tick);

  // Relance la mesure quand on revient au premier plan.
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && window.__horizonPerfLoopPaused){
      window.__horizonPerfLoopPaused = false;
      frames = 0;
      windowStart = performance.now();
      requestAnimationFrame(tick);
    }
  });
})();
