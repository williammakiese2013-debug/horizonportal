/* ============================================================
   DEVICE STORAGE — Dossier pour les médias, avec palier iOS
   ------------------------------------------------------------
   Au tout premier lancement, propose UNE FOIS le meilleur mode de
   stockage disponible SUR CET APPAREIL PRÉCIS, dans cet ordre :

   1) "folder"   — API File System Access (showDirectoryPicker).
                   L'utilisateur choisit un vrai dossier visible.
                   Disponible sur : Chrome/Edge desktop, Chrome Android.
                   PAS disponible sur iOS (aucun navigateur iOS ne
                   l'implémente, Apple l'interdit sur WebKit).

   2) "opfs"     — Origin Private File System (navigator.storage.
                   getDirectory()). C'est un vrai système de fichiers,
                   avec de vrais fichiers/dossiers, mais RANGÉ DANS UN
                   COFFRE PRIVÉ non visible dans l'app Fichiers — c'est
                   une limite volontaire d'Apple/du web, pas un bug ici.
                   Avantages énormes par rapport à IndexedDB : beaucoup
                   plus robuste, bien moins souvent vidé par le système,
                   et bien plus rapide pour de gros fichiers (vidéos).
                   Disponible sur : iOS/iPadOS Safari 16.4+, Chrome,
                   Firefox, et donc aussi les PWA installées sur iPhone.
                   ⇒ C'EST LE MODE UTILISÉ SUR IPHONE/IPAD.

   3) "internal" — IndexedDB (l'ancien système), utilisé seulement si
                   ni 1) ni 2) ne fonctionnent (très vieux navigateur).

   En plus, sur iOS spécifiquement, on ajoute un vrai bouton "Enregistrer
   sur mon iPhone" qui utilise le Web Share API (navigator.share) —
   c'est la SEULE façon qu'Apple autorise pour qu'un site propose à
   l'utilisateur d'enregistrer un fichier dans l'app Fichiers/Photos :
   ça ouvre la feuille de partage native avec "Enregistrer dans Fichiers"
   ou "Enregistrer l'image". C'est donc un export manuel, fichier par
   fichier, en plus du stockage automatique OPFS.

   API exposée pour le reste du site :
     await HorizonStorage.saveMedia(categorie, nomFichier, blobOuDataURL)
       -> retourne une "référence" à stocker dans l'état de l'appli
     await HorizonStorage.loadMedia(reference)
       -> retourne un File/Blob (à transformer en URL avec URL.createObjectURL)
     await HorizonStorage.exportToDevice(reference)
       -> ouvre le partage natif iOS/Android pour sauvegarder le fichier
          dans l'app Fichiers / Photos / autre appli
   ============================================================ */
(function(){
  'use strict';

  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS se déclare "Mac"

  const SUPPORTS_FS_API = 'showDirectoryPicker' in window;                       // desktop Chrome/Edge, Chrome Android
  const SUPPORTS_OPFS   = !!(navigator.storage && navigator.storage.getDirectory); // iOS 16.4+, Chrome, Firefox
  const SUPPORTS_SHARE_FILES = !!(navigator.canShare); // pour le bouton export manuel iOS

  const LS_FLAG = 'horizonFolderChoiceMade';   // l'utilisateur a déjà répondu au moins une fois
  const LS_MODE = 'horizonStorageMode';        // 'folder' | 'opfs' | 'internal'
  const HANDLE_DB = 'horizonHandles', HANDLE_STORE = 'handles', HANDLE_KEY = 'mediaDir';
  const FALLBACK_DB = 'horizonMediaFallback', FALLBACK_STORE = 'files';

  let dirHandle = null;   // FileSystemDirectoryHandle (mode "folder", hors iOS)
  let opfsRoot  = null;   // racine OPFS mise en cache une fois ouverte (mode "opfs")

  /* ---------- petit IndexedDB générique (handle + fallback) ---------- */
  function openDB(name, store){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(store);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbPut(dbName, store, key, value){
    const db = await openDB(dbName, store);
    return new Promise((res, rej)=>{
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGet(dbName, store, key){
    const db = await openDB(dbName, store);
    return new Promise((res, rej)=>{
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  }

  /* ---------- Styles + popup d'accueil (une seule fois) ---------- */
  function injectStyles(){
    if(document.getElementById('__horizonStorageStyles')) return;
    const style = document.createElement('style');
    style.id = '__horizonStorageStyles';
    style.textContent = `
      #__horizonStorageOverlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.75);
        backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;
        font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;}
      #__horizonStorageOverlay .box{background:rgba(255,255,255,0.09);backdrop-filter:blur(28px);
        border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:26px;max-width:340px;
        text-align:center;color:#fff;display:flex;flex-direction:column;gap:14px;}
      #__horizonStorageOverlay h3{margin:0;font-size:17px;font-weight:800;}
      #__horizonStorageOverlay p{margin:0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.75);}
      #__horizonStorageOverlay button{border:none;border-radius:14px;padding:12px 16px;font-size:14px;
        font-weight:700;cursor:pointer;}
      #__horizonStorageOverlay .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;}
      #__horizonStorageOverlay .btn-secondary{background:rgba(255,255,255,0.12);color:#fff;}
    `;
    document.head.appendChild(style);
  }

  function buildOverlay(title, text, primaryLabel, secondaryLabel){
    injectStyles();
    const overlay = document.createElement('div');
    overlay.id = '__horizonStorageOverlay';
    overlay.innerHTML = `
      <div class="box">
        <h3>${title}</h3>
        <p>${text}</p>
        <button class="btn-primary" id="__hsPrimary">${primaryLabel}</button>
        ${secondaryLabel ? `<button class="btn-secondary" id="__hsSecondary">${secondaryLabel}</button>` : ''}
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  // Cas 1 : Chrome/Edge desktop ou Chrome Android → vrai dossier visible.
  function showOnboardingFolder(){
    return new Promise((resolve)=>{
      const overlay = buildOverlay(
        '📁 Dossier pour tes médias',
        `Tu peux choisir un dossier sur ton appareil pour y enregistrer tes photos, vidéos et
         musiques ajoutées dans l'appli. C'est plus fiable que le stockage interne et ça évite
         de perdre tes fichiers.`,
        'Choisir un dossier', 'Non merci, stockage interne'
      );
      overlay.querySelector('#__hsPrimary').addEventListener('click', async ()=>{
        try{
          const handle = await window.showDirectoryPicker({ id:'horizon-vr-media', mode:'readwrite' });
          dirHandle = handle;
          await idbPut(HANDLE_DB, HANDLE_STORE, HANDLE_KEY, handle);
          localStorage.setItem(LS_MODE, 'folder');
        }catch(e){
          localStorage.setItem(LS_MODE, 'internal');
        }
        localStorage.setItem(LS_FLAG, '1');
        overlay.remove();
        resolve();
      });
      overlay.querySelector('#__hsSecondary').addEventListener('click', ()=>{
        localStorage.setItem(LS_MODE, 'internal');
        localStorage.setItem(LS_FLAG, '1');
        overlay.remove();
        resolve();
      });
    });
  }

  // Cas 2 : iOS / autres navigateurs sans sélecteur de dossier mais avec OPFS.
  // Pas de vrai choix de dossier possible (limite d'Apple), donc pas de bouton
  // "annuler" qui casserait le stockage : on active juste le meilleur mode dispo.
  function showOnboardingOPFS(){
    return new Promise((resolve)=>{
      const overlay = buildOverlay(
        '💾 Stockage renforcé activé',
        IS_IOS
          ? `iOS ne permet pas aux sites web de choisir un dossier visible dans l'app Fichiers
             (c'est une restriction d'Apple, pas de l'appli). En échange, Horizon VR va utiliser
             un espace de stockage privé beaucoup plus robuste que l'ancien système : tes médias
             seront bien mieux protégés contre les pertes. Tu pourras aussi les exporter vers
             Fichiers/Photos un par un depuis les réglages.`
          : `Ton navigateur ne permet pas de choisir un dossier visible, mais Horizon VR va
             utiliser un espace de stockage privé plus robuste que l'ancien système pour tes médias.`,
        'Activer (recommandé)', 'Non merci, stockage interne'
      );
      overlay.querySelector('#__hsPrimary').addEventListener('click', async ()=>{
        localStorage.setItem(LS_MODE, 'opfs');
        localStorage.setItem(LS_FLAG, '1');
        // Demande de stockage persistant : réduit le risque que le système
        // vide les données automatiquement en cas de manque de place.
        try{ if(navigator.storage && navigator.storage.persist) await navigator.storage.persist(); }catch(e){}
        overlay.remove();
        resolve();
      });
      overlay.querySelector('#__hsSecondary').addEventListener('click', ()=>{
        localStorage.setItem(LS_MODE, 'internal');
        localStorage.setItem(LS_FLAG, '1');
        overlay.remove();
        resolve();
      });
    });
  }

  /* ---------- Mode "folder" (hors iOS) : permission + handle ---------- */
  async function ensurePermission(handle){
    try{
      const opts = { mode:'readwrite' };
      if((await handle.queryPermission(opts)) === 'granted') return true;
      return (await handle.requestPermission(opts)) === 'granted';
    }catch(e){ return false; }
  }
  async function restoreHandle(){
    if(dirHandle) return dirHandle;
    try{
      const saved = await idbGet(HANDLE_DB, HANDLE_STORE, HANDLE_KEY);
      if(saved && await ensurePermission(saved)){
        dirHandle = saved;
        return dirHandle;
      }
    }catch(e){ /* pas de handle sauvegardé ou permission refusée */ }
    return null;
  }

  /* ---------- Mode "opfs" (iOS + autres) ---------- */
  async function getOPFSRoot(){
    if(opfsRoot) return opfsRoot;
    try{ opfsRoot = await navigator.storage.getDirectory(); return opfsRoot; }
    catch(e){ return null; }
  }

  async function writeOPFSFile(category, filename, blob){
    const root = await getOPFSRoot();
    if(!root) return false;
    const subDir = await root.getDirectoryHandle(category, { create:true });
    const fileHandle = await subDir.getFileHandle(filename, { create:true });

    // Chemin le plus courant (Safari 17.4+, Chrome, Firefox) : écriture directe
    // via un flux, exactement comme pour un vrai dossier choisi par l'utilisateur.
    if(typeof fileHandle.createWritable === 'function'){
      try{
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }catch(e){ /* on retente avec la méthode ci-dessous */ }
    }

    // Repli pour les versions de Safari qui ne proposent que l'accès
    // synchrone (createSyncAccessHandle), lequel doit tourner dans un
    // Web Worker séparé. On crée ce worker à la volée, une seule fois.
    if(typeof fileHandle.createSyncAccessHandle === 'function' || true){
      try{
        return await writeViaWorker(category, filename, blob);
      }catch(e){ return false; }
    }
    return false;
  }

  async function readOPFSFile(category, filename){
    const root = await getOPFSRoot();
    if(!root) return null;
    try{
      const subDir = await root.getDirectoryHandle(category, { create:false });
      const fileHandle = await subDir.getFileHandle(filename, { create:false });
      return await fileHandle.getFile(); // getFile() est lisible partout, y compris sans createWritable
    }catch(e){ return null; }
  }

  // Petit Worker dédié : certaines versions de Safari n'autorisent
  // l'écriture OPFS "synchrone" que depuis un Worker, pas depuis la page.
  let opfsWorker = null;
  function getOPFSWorker(){
    if(opfsWorker) return opfsWorker;
    const workerCode = `
      self.onmessage = async (e)=>{
        const { category, filename, buffer, reqId } = e.data;
        try{
          const root = await navigator.storage.getDirectory();
          const dir = await root.getDirectoryHandle(category, { create:true });
          const fileHandle = await dir.getFileHandle(filename, { create:true });
          const accessHandle = await fileHandle.createSyncAccessHandle();
          const view = new DataView(buffer);
          accessHandle.write(view, { at:0 });
          accessHandle.truncate(buffer.byteLength);
          accessHandle.flush();
          accessHandle.close();
          self.postMessage({ reqId, ok:true });
        }catch(err){
          self.postMessage({ reqId, ok:false, error:String(err) });
        }
      };
    `;
    const blob = new Blob([workerCode], { type:'application/javascript' });
    opfsWorker = new Worker(URL.createObjectURL(blob));
    return opfsWorker;
  }

  function writeViaWorker(category, filename, blob){
    return new Promise(async (resolve, reject)=>{
      try{
        const buffer = await blob.arrayBuffer();
        const worker = getOPFSWorker();
        const reqId = Math.random().toString(36).slice(2);
        const onMsg = (e)=>{
          if(e.data.reqId !== reqId) return;
          worker.removeEventListener('message', onMsg);
          if(e.data.ok) resolve(true); else reject(new Error(e.data.error));
        };
        worker.addEventListener('message', onMsg);
        worker.postMessage({ category, filename, buffer, reqId }, [buffer]);
      }catch(e){ reject(e); }
    });
  }

  /* ---------- API commune : sauvegarde / lecture ---------- */
  async function toBlob(data){
    if(data instanceof Blob) return data;
    if(typeof data === 'string' && data.startsWith('data:')){
      const res = await fetch(data);
      return res.blob();
    }
    throw new Error('Format de média non supporté par HorizonStorage');
  }

  async function saveMedia(category, filename, data){
    const blob = await toBlob(data);
    const mode = localStorage.getItem(LS_MODE) || 'internal';

    if(mode === 'folder' && SUPPORTS_FS_API){
      const handle = await restoreHandle();
      if(handle){
        try{
          const subDir = await handle.getDirectoryHandle(category, { create:true });
          const fileHandle = await subDir.getFileHandle(filename, { create:true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return { type:'folder', category, filename };
        }catch(e){
          console.warn('[HorizonStorage] Échec écriture dossier, repli sur stockage interne :', e);
        }
      }
    }

    if(mode === 'opfs' && SUPPORTS_OPFS){
      const ok = await writeOPFSFile(category, filename, blob);
      if(ok) return { type:'opfs', category, filename };
      console.warn('[HorizonStorage] Échec écriture OPFS, repli sur stockage interne.');
    }

    // Repli final : IndexedDB, toujours disponible sur tous les navigateurs.
    const key = category + '/' + filename;
    await idbPut(FALLBACK_DB, FALLBACK_STORE, key, blob);
    return { type:'internal', category, filename, key };
  }

  async function loadMedia(ref){
    if(!ref) return null;
    if(ref.type === 'folder'){
      const handle = await restoreHandle();
      if(!handle) return null;
      try{
        const subDir = await handle.getDirectoryHandle(ref.category, { create:false });
        const fileHandle = await subDir.getFileHandle(ref.filename, { create:false });
        return await fileHandle.getFile();
      }catch(e){ return null; }
    }
    if(ref.type === 'opfs') return readOPFSFile(ref.category, ref.filename);
    if(ref.type === 'internal') return idbGet(FALLBACK_DB, FALLBACK_STORE, ref.key);
    return null;
  }

  /* ---------- Export manuel vers l'app Fichiers / Photos (surtout utile sur iOS) ---------- */
  async function exportToDevice(ref){
    const file = await loadMedia(ref);
    if(!file) return false;
    const asFile = (file instanceof File) ? file : new File([file], ref.filename || 'media', { type: file.type });

    if(SUPPORTS_SHARE_FILES && navigator.canShare({ files:[asFile] })){
      try{
        await navigator.share({ files:[asFile], title: ref.filename || 'Média Horizon VR' });
        return true;
      }catch(e){ /* utilisateur a annulé le partage : pas une erreur */ return false; }
    }

    // Repli (Android/desktop) : lien de téléchargement classique.
    const url = URL.createObjectURL(asFile);
    const a = document.createElement('a');
    a.href = url; a.download = ref.filename || 'media';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    return true;
  }

  /* ---------- Init : un seul palier de popup, selon ce que le navigateur permet ---------- */
  async function init(){
    if(!localStorage.getItem(LS_FLAG)){
      await new Promise(r=>setTimeout(r, 600)); // laisse le premier écran de chargement s'afficher
      if(SUPPORTS_FS_API) await showOnboardingFolder();
      else if(SUPPORTS_OPFS) await showOnboardingOPFS();
      else localStorage.setItem(LS_MODE, 'internal'); // aucune option dispo : pas de popup inutile
    }

    const mode = localStorage.getItem(LS_MODE);
    if(mode === 'folder' && SUPPORTS_FS_API) await restoreHandle();
    if(mode === 'opfs' && SUPPORTS_OPFS) await getOPFSRoot();

    // Sur les modes robustes, on redemande le stockage persistant à chaque
    // lancement (ne coûte rien, améliore la fiabilité sur la durée).
    try{ if(navigator.storage && navigator.storage.persist) await navigator.storage.persist(); }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HorizonStorage = {
    supportsFolder: SUPPORTS_FS_API,
    supportsOPFS: SUPPORTS_OPFS,
    isIOS: IS_IOS,
    saveMedia,
    loadMedia,
    exportToDevice,
    getMode: () => localStorage.getItem(LS_MODE) || 'internal',
    // Pour un futur bouton "Changer de mode de stockage" dans les réglages.
    async reconfigure(){
      localStorage.removeItem(LS_FLAG);
      if(SUPPORTS_FS_API) await showOnboardingFolder();
      else if(SUPPORTS_OPFS) await showOnboardingOPFS();
    }
  };
})();
