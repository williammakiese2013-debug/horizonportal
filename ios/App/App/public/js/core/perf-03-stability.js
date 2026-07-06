/* ============================================================
   PERF 03 — Anti-crash & stabilité
   ------------------------------------------------------------
   - Coupe le son/vidéo et met les scènes "au repos" quand l'appli
     part en arrière-plan (évite surchauffe + économise la batterie,
     et évite que le navigateur tue l'onglet pour trop de conso).
   - Récupère proprement un contexte WebGL perdu ("Aw, Snap!")
     au lieu de planter tout le site.
   - Nettoie les URL objet (blob:) non utilisées pour éviter la
     fuite mémoire qui, à la longue, fait planter l'appli après
     un usage prolongé (ajout de plusieurs médias dans la session).
   ============================================================ */
(function(){
  'use strict';

  /* ---------- 1) Pause en arrière-plan ---------- */
  function pauseAllMedia(){
    document.querySelectorAll('video, audio').forEach(el=>{
      if(!el.paused){
        el.__wasPlayingBeforeHide = true;
        el.pause();
      }
    });
  }
  function resumeAllMedia(){
    document.querySelectorAll('video, audio').forEach(el=>{
      if(el.__wasPlayingBeforeHide){
        el.__wasPlayingBeforeHide = false;
        el.play().catch(()=>{ /* autoplay parfois bloqué, tant pis */ });
      }
    });
  }

  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){
      pauseAllMedia();
      document.querySelectorAll('a-scene').forEach(s=>{ if(s.renderer) s.renderer.setAnimationLoop(null); });
    } else {
      resumeAllMedia();
      document.querySelectorAll('a-scene').forEach(s=>{
        if(s.renderer && s.hasLoaded && typeof s.resume === 'function') s.resume();
      });
    }
  });

  // Sur mobile, "pagehide"/"blur" arrivent parfois sans "visibilitychange"
  // fiable (verrouillage écran, appel entrant...) → même traitement.
  window.addEventListener('pagehide', pauseAllMedia);
  window.addEventListener('blur', pauseAllMedia);

  /* ---------- 2) Contexte WebGL perdu ---------- */
  function watchContextLoss(sceneEl){
    if(!sceneEl.hasLoaded){
      sceneEl.addEventListener('loaded', ()=>watchContextLoss(sceneEl), { once:true });
      return;
    }
    const canvas = sceneEl.canvas;
    if(!canvas) return;

    canvas.addEventListener('webglcontextlost', (e)=>{
      e.preventDefault(); // empêche la perte définitive
      console.warn('[Horizon] Contexte WebGL perdu, tentative de restauration…');
    }, false);

    canvas.addEventListener('webglcontextrestored', ()=>{
      console.info('[Horizon] Contexte WebGL restauré.');
      // Forcer A-Frame à ré-uploader les textures/géométries
      if(sceneEl.renderer) sceneEl.renderer.forceContextRestore && sceneEl.renderer.forceContextRestore();
      document.dispatchEvent(new CustomEvent('horizon:webgl-restored', { detail:{ scene: sceneEl } }));
    }, false);
  }
  document.querySelectorAll('a-scene').forEach(watchContextLoss);

  /* ---------- 3) Nettoyage des URL objet (blob:) ---------- */
  // Petit registre global : tout le site peut enregistrer une URL créée
  // via URL.createObjectURL ici, et on la libère automatiquement quand
  // l'élément qui l'utilise est retiré du DOM ou remplacé.
  window.HorizonURLTracker = window.HorizonURLTracker || {
    _urls: new Set(),
    track(url){ this._urls.add(url); return url; },
    release(url){
      if(this._urls.has(url)){
        try{ URL.revokeObjectURL(url); }catch(e){}
        this._urls.delete(url);
      }
    },
    releaseAll(){
      this._urls.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} });
      this._urls.clear();
    }
  };

  // Filet de sécurité : à la fermeture/rechargement de la page on libère
  // tout pour ne pas laisser de mémoire "orpheline" pour la session suivante.
  window.addEventListener('pagehide', ()=> window.HorizonURLTracker.releaseAll());

  /* ---------- 4) Alerte mémoire (Chrome/Android seulement) ---------- */
  // performance.memory n'existe que sur Chromium ; si la mémoire JS
  // utilisée approche la limite, on force un passage en qualité basse
  // (voir perf-02) plutôt que d'attendre le crash.
  if(performance.memory){
    setInterval(()=>{
      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
      if(jsHeapSizeLimit && usedJSHeapSize / jsHeapSizeLimit > 0.85){
        document.dispatchEvent(new CustomEvent('horizon:quality-change', { detail:{ level:0, forced:true, reason:'memory' } }));
        document.body.classList.add('ai-perf-mode');
        console.warn('[Horizon] Mémoire JS proche de la limite, passage en mode économique forcé.');
      }
    }, 5000);
  }
})();
