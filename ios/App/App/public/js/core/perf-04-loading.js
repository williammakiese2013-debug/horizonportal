/* ============================================================
   PERF 04 — Chargement & événements
   ------------------------------------------------------------
   - Charge les images/miniatures seulement quand elles deviennent
     visibles (galeries Netflix/Disney/Anime avec beaucoup de
     couvertures) au lieu de tout charger d'un coup au démarrage.
   - Rend les listeners de scroll/touch "passifs" pour que le
     navigateur ne bloque pas le rendu en les attendant.
   - Limite (throttle) les calculs coûteux sur resize/orientation
     pour éviter les à-coups quand on tourne le téléphone.
   ============================================================ */
(function(){
  'use strict';

  /* ---------- Lazy-loading images ---------- */
  const lazyObserver = ('IntersectionObserver' in window) ? new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const img = entry.target;
        const src = img.getAttribute('data-lazy-src');
        if(src){ img.src = src; img.removeAttribute('data-lazy-src'); }
        lazyObserver.unobserve(img);
      }
    });
  }, { rootMargin: '200px' }) : null;

  // Observe automatiquement toute image marquée data-lazy-src, y compris
  // celles ajoutées dynamiquement plus tard (galeries générées en JS).
  window.HorizonLazyLoad = function(img){
    if(!img) return;
    if(!lazyObserver){ // navigateur trop ancien : chargement direct
      const src = img.getAttribute('data-lazy-src');
      if(src){ img.src = src; img.removeAttribute('data-lazy-src'); }
      return;
    }
    lazyObserver.observe(img);
  };

  function scanForLazyImages(root){
    (root || document).querySelectorAll('img[data-lazy-src]').forEach(window.HorizonLazyLoad);
  }
  scanForLazyImages();

  // Surveille les ajouts dynamiques (nouvelles cartes Netflix/Anime/etc.)
  const mo = new MutationObserver((mutations)=>{
    for(const m of mutations){
      m.addedNodes.forEach(node=>{
        if(node.nodeType !== 1) return;
        if(node.matches && node.matches('img[data-lazy-src]')) window.HorizonLazyLoad(node);
        if(node.querySelectorAll) scanForLazyImages(node);
      });
    }
  });
  mo.observe(document.body, { childList:true, subtree:true });

  /* ---------- Throttle générique ---------- */
  function throttle(fn, delay){
    let last = 0, timer = null;
    return function(...args){
      const now = Date.now();
      if(now - last >= delay){
        last = now;
        fn.apply(this, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(()=>{ last = Date.now(); fn.apply(this, args); }, delay - (now - last));
      }
    };
  }
  window.HorizonThrottle = throttle;

  /* ---------- Listeners passifs pour scroll/touch ---------- */
  // Beaucoup de composants du site écoutent touchmove/wheel pour le
  // scroll des galeries ou le regard (gaze). Par défaut ces listeners
  // bloquent le rendu tant qu'ils n'ont pas répondu ; en les passant en
  // "passive" on dit au navigateur qu'on ne fera pas preventDefault()
  // (ce qui est le cas pour de la simple lecture de position), donc il
  // peut continuer à faire défiler/rendre sans attendre.
  const passiveEvents = ['touchstart','touchmove','wheel'];
  const originalAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options){
    if(passiveEvents.includes(type)){
      if(options === undefined) options = { passive:true };
      else if(typeof options === 'boolean') options = { capture: options, passive:true };
      else if(typeof options === 'object' && options.passive === undefined) options = Object.assign({}, options, { passive:true });
    }
    return originalAdd.call(this, type, listener, options);
  };

  /* ---------- Throttle resize/orientation ---------- */
  // orientation-lock.js gère déjà le verrouillage visuel ; ici on
  // s'assure juste qu'aucun autre script ne recalcule des layouts
  // coûteux plusieurs dizaines de fois par seconde pendant la rotation.
  const dispatchThrottledResize = throttle(()=>{
    window.dispatchEvent(new CustomEvent('horizon:resize-settled'));
  }, 150);
  window.addEventListener('resize', dispatchThrottledResize, { passive:true });
  window.addEventListener('orientationchange', dispatchThrottledResize, { passive:true });
})();
