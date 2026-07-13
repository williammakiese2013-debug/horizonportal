/* ============================================================
   NATIVE MEDIA FOLDER — dossier "Fichiers" auto-créé (app Capacitor)
   ------------------------------------------------------------
   Idée : au lieu d'ouvrir le sélecteur de fichiers natif à chaque
   import, l'app crée (une fois, au premier lancement natif) un vrai
   dossier visible dans l'app Fichiers iOS/Android :

     Sur mon iPhone/iPad ▸ Horizon VR ▸ Films
                                       ▸ Séries
                                       ▸ Anime
                                       ▸ Musique
                                       ▸ Images

   L'utilisateur glisse ses fichiers dedans (AirDrop, Mac, câble,
   Google Drive → Fichiers, etc.) et l'app les propose directement
   dans une liste stylée, sans repasser par "Parcourir…" à chaque fois.
   Un bouton "📂 Parcourir manuellement" reste toujours disponible en
   secours (fichier hors dossier, ou mode web classique).

   ⚠️ NÉCESSITE côté projet natif (pas inclus dans ce zip, à faire
   une fois dans Xcode / Android Studio) :
     1) `npm install @capacitor/filesystem` puis `npx cap sync`
     2) iOS Info.plist : ajouter
          <key>UIFileSharingEnabled</key><true/>
          <key>LSSupportsOpeningDocumentsInPlace</key><true/>
        → sans ça, le dossier de l'app existe mais reste invisible
          dans l'app Fichiers.
     3) Android : aucune permission supplémentaire nécessaire pour le
        dossier interne à l'app (stockage scoped par défaut).

   Tant que @capacitor/filesystem n'est pas installé et syncé, ce
   module se met tout seul en veille : chaque écran d'import retombe
   simplement sur le sélecteur classique, sans rien casser.

   API exposée :
     NativeMediaFolder.ensureFolders()      -> à appeler une fois au démarrage
     NativeMediaFolder.openFor(inputEl)     -> remplace un inputEl.click()
   ============================================================ */
(function () {
  'use strict';

  const APP_ROOT = 'HorizonVR';

  /* Quel sous-dossier + quel type de fichiers pour chaque <input id=""> de l'app */
  const CATEGORY_BY_ID = {
    fileInput:               { folders: ['Films', 'Images'], kinds: ['video', 'image'], multiple: true },
    netflixFileInput:        { folders: ['Films'],   kinds: ['video'] },
    userContentFileInput:    { folders: ['Films'],   kinds: ['video'] },
    disneyFileInput:         { folders: ['Films'],   kinds: ['video'] },
    disneyUserContentFileInput: { folders: ['Films'], kinds: ['video'] },
    atvFileInput:            { folders: ['Films'],   kinds: ['video'] },
    atvUserContentFileInput: { folders: ['Films'],   kinds: ['video'] },
    stFileInput:             { folders: ['Séries'],  kinds: ['video'] },
    seriesFileInput:         { folders: ['Séries'],  kinds: ['video'] },
    animeFileInput:          { folders: ['Anime'],   kinds: ['video'] },
    amMp3FileInput:          { folders: ['Musique'], kinds: ['audio'] },
    amPlayFileInput:         { folders: ['Musique'], kinds: ['audio'] },
    amCoverFileInput:        { folders: ['Images'],  kinds: ['image'] },
    creatorCoverInput:       { folders: ['Images'],  kinds: ['image'] },
    nfCardCoverInput:        { folders: ['Images'],  kinds: ['image'] },
    disneyCardCoverInput:    { folders: ['Images'],  kinds: ['image'] },
    atvCardCoverInput:       { folders: ['Images'],  kinds: ['image'] },
    disneyCoverInput:        { folders: ['Images'],  kinds: ['image'] },
    atvCoverInput:           { folders: ['Images'],  kinds: ['image'] },
    glGameIconInput:         { folders: ['Images'],  kinds: ['image'] },
  };

  const EXT_BY_KIND = {
    video: ['mp4','mov','m4v','webm','mkv'],
    image: ['jpg','jpeg','png','webp','gif','heic'],
    audio: ['mp3','m4a','wav','aac','flac'],
  };
  const MIME_BY_EXT = {
    mp4:'video/mp4', mov:'video/quicktime', m4v:'video/x-m4v', webm:'video/webm', mkv:'video/x-matroska',
    jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', heic:'image/heic',
    mp3:'audio/mpeg', m4a:'audio/mp4', wav:'audio/wav', aac:'audio/aac', flac:'audio/flac',
  };
  const ICON_BY_KIND = { video:'🎬', image:'🖼️', audio:'🎵' };

  function cap() { return window.Capacitor; }
  function isNative() { return !!(cap() && typeof cap().isNativePlatform === 'function' && cap().isNativePlatform()); }
  function fsPlugin() { return cap() && cap().Plugins && cap().Plugins.Filesystem; }
  function available() { return isNative() && !!fsPlugin(); }

  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }
  function kindOfExt(ext) {
    for (const k in EXT_BY_KIND) if (EXT_BY_KIND[k].includes(ext)) return k;
    return null;
  }

  /* ---------- Création des dossiers (une seule fois par install) ---------- */
  async function ensureFolders() {
    if (!available()) return;
    const FS = fsPlugin();
    const Directory = (cap().Directory || (cap().Plugins && cap().Plugins.Filesystem && {})) ;
    const DIR = 'DOCUMENTS';
    const allFolders = ['Films', 'Séries', 'Anime', 'Musique', 'Images'];
    try {
      await FS.mkdir({ path: APP_ROOT, directory: DIR, recursive: true }).catch(()=>{});
      for (const folder of allFolders) {
        const path = `${APP_ROOT}/${folder}`;
        await FS.mkdir({ path, directory: DIR, recursive: true }).catch(()=>{});
      }
      const flag = 'horizonNativeFoldersReady';
      if (!localStorage.getItem(flag)) {
        const readme = "Dépose ici tes fichiers (vidéos, images, musique) — ils apparaîtront directement dans Horizon VR, dossier par dossier, sans avoir à les rechercher à chaque fois.";
        for (const folder of allFolders) {
          await FS.writeFile({
            path: `${APP_ROOT}/${folder}/Lisez-moi.txt`,
            data: readme,
            directory: DIR,
            encoding: 'utf8',
          }).catch(()=>{});
        }
        localStorage.setItem(flag, '1');
      }
    } catch (e) {
      console.warn('[NativeMediaFolder] init impossible :', e);
    }
  }

  /* ---------- Lister les fichiers d'un sous-dossier ---------- */
  async function listFiles(folder, kinds) {
    if (!available()) return [];
    const FS = fsPlugin();
    const DIR = 'DOCUMENTS';
    const path = `${APP_ROOT}/${folder}`;
    try {
      const res = await FS.readdir({ path, directory: DIR });
      const entries = (res && res.files) || [];
      return entries
        .map(f => (typeof f === 'string' ? { name: f } : { name: f.name }))
        .filter(f => {
          const ext = extOf(f.name);
          const kind = kindOfExt(ext);
          return kind && (!kinds || kinds.includes(kind));
        })
        .map(f => ({ ...f, folder, ext: extOf(f.name), kind: kindOfExt(extOf(f.name)) }));
    } catch (e) {
      return []; // dossier pas encore créé / vide — pas grave
    }
  }

  /* ---------- Récupérer un fichier natif comme un vrai objet File ---------- */
  async function toFile(entry) {
    const FS = fsPlugin();
    const DIR = 'DOCUMENTS';
    const path = `${APP_ROOT}/${entry.folder}/${entry.name}`;
    const uriRes = await FS.getUri({ path, directory: DIR });
    const nativeUri = uriRes && uriRes.uri;
    const webSrc = cap().convertFileSrc ? cap().convertFileSrc(nativeUri) : nativeUri;
    const resp = await fetch(webSrc);
    const blob = await resp.blob();
    const mime = MIME_BY_EXT[entry.ext] || blob.type || 'application/octet-stream';
    return new File([blob], entry.name, { type: mime });
  }

  /* ---------- UI stylée (même esprit glass que le reste de l'app) ---------- */
  function injectStyles() {
    if (document.getElementById('__nativeMediaFolderStyles')) return;
    const style = document.createElement('style');
    style.id = '__nativeMediaFolderStyles';
    style.textContent = `
      #__nmfOverlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.75);
        backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;
        font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;}
      #__nmfOverlay .nmf-box{background:rgba(255,255,255,0.09);backdrop-filter:blur(28px);
        border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:22px;width:320px;
        max-height:70vh;display:flex;flex-direction:column;gap:12px;color:#fff;}
      #__nmfOverlay .nmf-path{font-size:11px;color:rgba(255,255,255,0.55);display:flex;
        align-items:center;gap:4px;flex-wrap:wrap;}
      #__nmfOverlay .nmf-title{font-size:15px;font-weight:800;}
      #__nmfOverlay .nmf-list{overflow-y:auto;display:flex;flex-direction:column;gap:8px;flex:1;}
      #__nmfOverlay .nmf-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.07);
        border-radius:14px;padding:10px 12px;cursor:pointer;text-align:left;}
      #__nmfOverlay .nmf-item:active{background:rgba(255,255,255,0.16);}
      #__nmfOverlay .nmf-item .nmf-icon{font-size:20px;}
      #__nmfOverlay .nmf-item .nmf-name{font-size:13px;font-weight:600;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;}
      #__nmfOverlay .nmf-empty{font-size:12px;color:rgba(255,255,255,0.5);text-align:center;
        padding:18px 6px;line-height:1.5;}
      #__nmfOverlay button{border:none;border-radius:14px;padding:12px 16px;font-size:13px;
        font-weight:700;cursor:pointer;}
      #__nmfOverlay .nmf-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;}
      #__nmfOverlay .nmf-secondary{background:rgba(255,255,255,0.12);color:#fff;}
    `;
    document.head.appendChild(style);
  }

  /* Construit la FileList synthétique et déclenche 'change' — TOUT le code
     existant (chaque écouteur addEventListener('change', …)) continue de
     fonctionner sans aucune modification. */
  function dispatchFiles(inputEl, files) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    inputEl.files = dt.files;
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function openPicker(inputEl, config) {
    injectStyles();
    const old = document.getElementById('__nmfOverlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = '__nmfOverlay';
    const box = document.createElement('div');
    box.className = 'nmf-box';

    const path = document.createElement('div');
    path.className = 'nmf-path';
    path.textContent = `📁 Sur mon iPhone/iPad ▸ Horizon VR ▸ ${config.folders.join(' / ')}`;

    const title = document.createElement('div');
    title.className = 'nmf-title';
    title.textContent = 'Choisir un fichier';

    const list = document.createElement('div');
    list.className = 'nmf-list';
    list.innerHTML = `<div class="nmf-empty">Recherche des fichiers…</div>`;

    const manual = document.createElement('button');
    manual.className = 'nmf-secondary';
    manual.textContent = '📂 Parcourir manuellement';
    manual.addEventListener('click', () => { overlay.remove(); inputEl.click(); });

    const cancel = document.createElement('button');
    cancel.className = 'nmf-secondary';
    cancel.style.background = 'transparent';
    cancel.style.color = 'rgba(255,255,255,0.5)';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', () => overlay.remove());

    box.appendChild(path);
    box.appendChild(title);
    box.appendChild(list);
    box.appendChild(manual);
    box.appendChild(cancel);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    let entries = [];
    for (const folder of config.folders) {
      entries = entries.concat(await listFiles(folder, config.kinds));
    }

    if (!entries.length) {
      list.innerHTML = `<div class="nmf-empty">Aucun fichier trouvé pour l'instant.<br>Dépose tes fichiers dans<br><b>Fichiers ▸ Sur mon iPhone/iPad ▸ Horizon VR ▸ ${config.folders.join('/')}</b><br>puis reviens ici.</div>`;
      return;
    }

    list.innerHTML = '';
    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'nmf-item';
      row.innerHTML = `<span class="nmf-icon">${ICON_BY_KIND[entry.kind] || '📄'}</span><span class="nmf-name">${entry.name}</span>`;
      row.addEventListener('click', async () => {
        row.style.opacity = '0.5';
        try {
          const file = await toFile(entry);
          overlay.remove();
          dispatchFiles(inputEl, [file]);
        } catch (e) {
          console.warn('[NativeMediaFolder] lecture impossible :', e);
          if (window.toast) toast('❌ Impossible de lire ce fichier — ' + (e.message || e));
          row.style.opacity = '1';
        }
      });
      list.appendChild(row);
    });
  }

  /* ---------- Point d'entrée unique : remplace un inputEl.click() ---------- */
  function openFor(inputEl) {
    if (!inputEl) return;
    if (!available()) { inputEl.click(); return; }
    const config = CATEGORY_BY_ID[inputEl.id];
    if (!config) { inputEl.click(); return; }
    openPicker(inputEl, config);
  }

  window.NativeMediaFolder = { ensureFolders, openFor, isNative, available };

  document.addEventListener('DOMContentLoaded', () => { ensureFolders(); });
})();
