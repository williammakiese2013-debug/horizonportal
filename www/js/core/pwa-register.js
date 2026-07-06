  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js')
        .then(function (registration) {
          console.log('[PWA] Service Worker enregistré, scope :', registration.scope);
        })
        .catch(function (error) {
          console.warn('[PWA] Échec de l\'enregistrement du Service Worker :', error);
        });
    });
  }
