/* ============================================================
   MEDIA PERMISSIONS — accès caméra unifié (web + app Capacitor)
   ============================================================
   `navigator.mediaDevices` peut être totalement `undefined` (pas
   juste `.getUserMedia`) pour deux raisons bien distinctes qu'il faut
   différencier pour donner le bon message à l'utilisateur :

   1) WEB (navigateur classique, testé en http:// ou file://) :
      l'API caméra n'existe que dans un "contexte sécurisé"
      (https:// ou http://localhost). Ouvert en http:// simple sur un
      téléphone → l'objet mediaDevices n'existe carrément pas.

   2) APP NATIVE (Capacitor iOS/Android, servie via
      capacitor://localhost ou https://localhost donc déjà "sécurisé") :
      si ça plante quand même, la cause n'est presque jamais le web —
      c'est la couche native qui masque l'API :
        • iOS : clé NSCameraUsageDescription absente du Info.plist
          (WKWebView masque alors complètement navigator.mediaDevices,
          au lieu de rejeter la promesse).
        • Android : permission <uses-permission android.permission.CAMERA />
          absente du AndroidManifest.xml, ou refusée dans les Réglages
          système de l'app.

   Ce module ne fait qu'UNE chose : remplacer les appels bruts à
   navigator.mediaDevices.getUserMedia(...) par un appel qui échoue
   proprement avec un message actionnable au lieu de planter avec
   "undefined is not an object (evaluating 'navigator.mediaDevices.…')".
*/
(function () {
  function isNativeApp() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }

  function platform() {
    if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
      return window.Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
    }
    return 'web';
  }

  function isSecureCtx() {
    if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
    return location.protocol === 'https:' || location.hostname === 'localhost';
  }

  /* Message clair et actionnable selon le contexte d'exécution réel */
  function unavailableMessage() {
    if (isNativeApp()) {
      const p = platform();
      if (p === 'ios') {
        return "Caméra bloquée par les autorisations de l'app — va dans Réglages iOS → [nom de l'app] → active Caméra (ou réinstalle si l'option n'apparaît pas : NSCameraUsageDescription manquante côté natif).";
      }
      if (p === 'android') {
        return "Caméra bloquée par les autorisations de l'app — va dans Paramètres Android → Apps → [nom de l'app] → Autorisations → active Caméra.";
      }
      return "Caméra bloquée par les autorisations de l'app — vérifie les autorisations Caméra dans les réglages système de l'app.";
    }
    if (!isSecureCtx()) {
      return "Caméra indisponible en HTTP — recharge en HTTPS (ou teste directement dans l'app) : le navigateur masque l'accès caméra hors connexion sécurisée.";
    }
    return "Caméra indisponible sur ce navigateur.";
  }

  /**
   * Demande un flux caméra en gérant proprement le cas où
   * navigator.mediaDevices (ou getUserMedia) est totalement absent,
   * au lieu de laisser planter avec une TypeError brute.
   * @param {MediaStreamConstraints} constraints
   * @returns {Promise<MediaStream>}
   */
  async function getCameraStream(constraints) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error(unavailableMessage());
      err.code = 'MEDIA_DEVICES_UNAVAILABLE';
      throw err;
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  window.HorizonMedia = { isNativeApp, platform, isSecureCtx, unavailableMessage, getCameraStream };
})();
