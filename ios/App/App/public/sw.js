/* ============================================================
   SERVICE WORKER — Horizon VR Portal
   Mise en cache des fichiers essentiels pour un fonctionnement
   hors-ligne fluide (stratégie "cache-first" avec repli réseau).
   ============================================================ */

const CACHE_NAME = 'horizon-vr-portal-v3';

/* Cache dédié aux jeux HTML/JS importés depuis un dossier par
   l'utilisateur (Library → Ajouter un jeu). Chaque fichier du
   dossier importé est stocké ici sous l'URL virtuelle
   "./customgame-files/<id>/<chemin-relatif>" afin que le jeu
   puisse charger ses propres <script src>, <link>, images, etc.
   comme s'il tournait sur un vrai petit serveur. Ce cache est
   volontairement séparé de CACHE_NAME pour ne jamais être purgé
   lors d'une mise à jour de la version de l'app (voir activate). */
const CUSTOM_GAMES_CACHE = 'horizon-customgames-v1';
const CUSTOM_GAMES_PATH = '/customgame-files/';

/* Liste des fichiers mis en cache lors de l'installation.
   ⚠️ Ajuste le nom "index.html" ci-dessous si tu gardes le nom
   original de ton fichier (ex: index_vr_final_4_3_mod_5_zoom_MediaPipeHands_2_5_2.html).
   Pour que le manifest.json (start_url: "./index.html") fonctionne
   tel quel, il est recommandé de renommer ton fichier principal
   en "index.html" au moment du déploiement. */
const URLS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'IMG_2704.jpeg',
  'IMG_2705.jpeg',
  'IMG_2706.jpeg',
  'IMG_2707.jpeg',
  'IMG_2708.jpeg',
  'IMG_2709.jpeg',
  'IMG_2710.jpeg',
  'IMG_2711.jpeg',
  'IMG_2712.jpeg',
  'IMG_2713.jpeg',
  'IMG_2714.jpeg',
  'IMG_2715.jpeg',
  'IMG_2716.jpeg',
  'IMG_2717.jpeg',
  'IMG_2718.jpeg',
  'IMG_2719.jpeg',
  'IMG_2720.jpeg',
  'IMG_2721.jpeg',
  'IMG_2723.jpeg',
  'IMG_2724.jpeg',
  'IMG_2725.jpeg',
  'IMG_2737.jpeg',
  'IMG_2738.jpeg',
  'IMG_2739.jpeg',
  'IMG_2740.jpeg',
  'IMG_2741.jpeg',
  'IMG_2742.jpeg',
  'IMG_2743.jpeg',
  'IMG_2744.jpeg',
  'IMG_2745.jpeg',
  'IMG_2747.jpeg',
  'IMG_2751.jpeg',
  'IMG_2752.jpeg',
  'IMG_2753.jpeg',
  'IMG_2754.jpeg',
  'IMG_2756.jpeg'
];

/* Installation : on précharge les fichiers essentiels dans le cache.
   IMPORTANT : on utilise cache.add() fichier par fichier (au lieu de
   cache.addAll()) et on "avale" chaque échec individuellement. Avec
   addAll(), UN SEUL fichier introuvable (mauvais nom, mauvaise casse,
   espace en trop...) fait échouer l'installation ENTIÈRE du Service
   Worker, et donc AUCUN fichier n'est mis en cache — c'est la cause la
   plus fréquente d'un "mode hors-ligne qui ne marche pas du tout". */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        URLS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Impossible de mettre en cache :', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* Activation : on supprime les anciennes versions du cache si le
   nom CACHE_NAME a changé (mise à jour de la PWA). */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== CUSTOM_GAMES_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

/* Interception des requêtes : cache-first, avec repli réseau si le
   fichier n'est pas (encore) en cache — puis mise à jour du cache. */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* Fichiers d'un jeu importé (dossier HTML/JS/CSS/assets) : ils ne
     vivent que dans CUSTOM_GAMES_CACHE, jamais sur un vrai serveur.
     On répond uniquement depuis ce cache — pas de repli réseau, qui
     échouerait de toute façon (404) et casserait le jeu. */
  if (url.pathname.includes(CUSTOM_GAMES_PATH)) {
    event.respondWith(
      caches.open(CUSTOM_GAMES_CACHE).then((cache) =>
        cache.match(event.request).then((res) =>
          res || new Response('Fichier introuvable dans le jeu importé : ' + url.pathname, {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          })
        )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Hors-ligne et pas en cache : on ne peut rien renvoyer de plus.
        return cachedResponse;
      });
    })
  );
});
