/* ============================================================
   showFilePicker — popup style creator avec creator-cover-btn
   Le creator-cover-btn est un vrai bouton dans le DOM donc
   quand l'utilisateur le touche c'est un geste direct reconnu
   par le navigateur mobile pour ouvrir le sélecteur de fichiers.
   ============================================================ */
function showFilePicker(inputId, attrKey, attrVal, label){
  const inp = document.getElementById(inputId);
  if(!inp) return;
  inp.setAttribute(attrKey, attrVal);

  // Supprimer un éventuel overlay précédent
  const old = document.getElementById('__filePickerOverlay');
  if(old) old.remove();

  // Créer l'overlay + popup style creator
  const overlay = document.createElement('div');
  overlay.id = '__filePickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';

  const popup = document.createElement('div');
  popup.style.cssText = 'background:rgba(255,255,255,0.09);backdrop-filter:blur(28px);border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:24px;min-width:240px;text-align:center;color:#fff;display:flex;flex-direction:column;gap:14px;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:700;';
  title.textContent = label;

  // Le vrai creator-cover-btn : un label[for=inputId] stylé comme dans le creator
  const lbl = document.createElement('label');
  lbl.htmlFor = inputId;
  lbl.className = 'creator-cover-btn';
  lbl.style.cssText = 'display:block;cursor:pointer;';
  lbl.textContent = '📁 Choisir une image';

  const cancel = document.createElement('div');
  cancel.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.45);cursor:pointer;';
  cancel.textContent = 'Annuler';

  popup.appendChild(title);
  popup.appendChild(lbl);
  popup.appendChild(cancel);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  lbl.addEventListener('click', ()=> setTimeout(()=>{ overlay.remove(); }, 500));
  cancel.addEventListener('click', ()=> overlay.remove());
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.remove(); });
}

/* ------------ Actions ------------ */
function handleAction(action){
  if(!action) return;

  /* === Scroll galerie par regard === */
  if(action.startsWith('gallery-scroll-')){
    const step = action.endsWith('2') ? 280 : 120;
    const dir  = action.includes('-down') ? 1 : -1;
    // Scroll both eyes (duplicate IDs — find via containers)
    for(const side of ['L','R']){
      const hc = $('hudCenter'+side);
      if(hc){
        const el = hc.querySelector('#galleryScroll,[id="galleryScroll"]');
        if(el) el.scrollBy({top: dir * step, behavior:'smooth'});
      }
    }
    return;
  }

  /* === Scroll Netflix par regard === */
  if(action === 'nf-scroll-up' || action === 'nf-scroll-down'){
    const dir = action === 'nf-scroll-down' ? 1 : -1;
    for(const side of ['L','R']){
      const wc = $('appWindowCenter'+side);
      if(wc){
        const el = wc.querySelector('#nfMainScroll') || wc.querySelector('.nf-main') || wc.querySelector('.nf-body') || wc.querySelector('.nf-grid4');
        if(el) el.scrollBy({top: dir * 140, behavior:'smooth'});
      }
    }
    return;
  }

  /* === Scroll Disney+ par regard === */
  if(action === 'disney-scroll-up' || action === 'disney-scroll-down'){
    const dir = action === 'disney-scroll-down' ? 1 : -1;
    for(const side of ['L','R']){
      const wc = $('appWindowCenter'+side);
      if(wc){
        const el = wc.querySelector('#disneyMainScroll') || wc.querySelector('.dp-main');
        if(el) el.scrollBy({top: dir * 140, behavior:'smooth'});
      }
    }
    return;
  }

  /* === Scroll Apple TV par regard === */
  if(action === 'atv-scroll-up' || action === 'atv-scroll-down'){
    const dir = action === 'atv-scroll-down' ? 1 : -1;
    for(const side of ['L','R']){
      const wc = $('appWindowCenter'+side);
      if(wc){
        const el = wc.querySelector('#atvMainScroll') || wc.querySelector('.at-main') || wc.querySelector('.at-grid');
        if(el) el.scrollBy({top: dir * 140, behavior:'smooth'});
      }
    }
    return;
  }

  if(action.startsWith('toast:')){
    toast(action.slice(6));
    return;
  }

  /* === VR Game === */
  if(action === 'vrg:launch'){ openVRGame(); return; }
  if(action === 'vrg:exit')  { closeVRGame(); return; }
  if(action === 'vrg:restart'){ restartVRGame(); return; }

  /* === Les Sims 3 VR === */
  if(action === 'sims3:launch'){ openSims3VR(); return; }
  if(action.startsWith('sims3:')){ handleSims3Action(action); return; }

  /* === Game Launcher === */
  if(action.startsWith('gl-')){ handleGameLauncherAction(action); return; }

  /* === Apple Music === */
  if(action.startsWith('am:')){ handleAppleMusicAction(action); return; }

  if(action.startsWith('app:')){
    const appId = action.slice(4);
    state.activeApp = appId;
    state.launchpadOpen = false;
    const calibPanel = document.getElementById('calibPanel');
    if(calibPanel) calibPanel.classList.remove('open');
    state.menuHidden = false;
    state.dragGazeMode = false;
    state.dragGazeOffX = 0;
    state.dragGazeOffY = 0;
    if(appId === 'jeux') state.gameState = { sub:null, score:0 };
    if(appId === 'safari'){
      // Initialiser le système d'onglets si absent
      if(!state.browserTabs || state.browserTabs.length === 0){
        state.browserTabs = [{ url: state.browserState?.currentUrl||'', title:'Onglet 1',
          state: state.browserState || null }];
        state.browserActiveTab = 0;
      }
      // Conserver l'historique, juste s'assurer que browserState existe
      state.browserState = state.browserState || { currentUrl:'', history:[], histIdx:-1, loading:false, error:null, proxyMode:true, proxyIdx:0 };
      // Sync le clavier du bas avec l'URL courante
      state.safariKbText = state.browserState.currentUrl || '';
    }
    renderHUD();
    toast('📱 ' + APPS.find(a=>a.id===appId)?.name || appId);
    return;
  }
  if(action==='openLaunchpad'){
    state.launchpadOpen = true;
    state.activeApp = null;
    state.menuHidden = false;
    renderHUD();
    toast('▦ Launchpad');
    return;
  }
  if(action.startsWith('launchpad:tab:')){
    state.launchpadTab = action.slice(14);
    renderHUD();
    return;
  }
  if(action==='closeLaunchpad'){
    state.launchpadOpen = false;
    renderHUD();
    return;
  }

  /* === Launchpad · onglet Library === */
  if(action.startsWith('library:filter:')){
    state.libraryFilter = action.slice(15);
    renderHUD();
    return;
  }
  if(action==='library:addgame:open'){
    state.addGameForm = { name:'', mode:'fullscreen', folderFiles:null, folderName:'', entryFile:'', htmlCandidates:[] };
    state.addGameModalOpen = true;
    state.addGameError = '';
    renderHUD();
    return;
  }
  if(action==='library:addgame:edit:name'){
    openVKB('addGameName', state.addGameForm.name || '', t=>{ state.addGameForm.name = t; });
    return;
  }
  if(action==='library:addgame:dismisserror'){
    state.addGameError = '';
    renderHUD();
    return;
  }
  if(action==='library:addgame:close'){
    state.addGameModalOpen = false;
    renderHUD();
    return;
  }
  if(action.startsWith('library:addgame:mode:')){
    state.addGameForm.mode = action.slice(21);
    renderHUD();
    return;
  }
  if(action.startsWith('library:addgame:entryfile:')){
    state.addGameForm.entryFile = decodeURIComponent(action.slice(27));
    renderHUD();
    return;
  }
  /* Ouvrir un <input type="file"> nécessite un vrai geste utilisateur
     (le navigateur bloque l'ouverture du sélecteur si elle vient d'un
     clic simulé par le regard/pincement). On suit donc le même schéma
     que "addFiles" : l'action gaze/pinch arme juste une écoute d'un
     VRAI clic/toucher suivant, qui déclenche alors le vrai input. */
  if(action==='library:addgame:pickfolder'){
    if(state.waitingTouchForImport) return;
    state.waitingTouchForImport = true;
    toast('👆 Touchez l\'écran pour choisir le dossier');
    const handler = () => {
      state.waitingTouchForImport = false;
      document.removeEventListener('click', handler);
      const fi = document.getElementById('addGameFolderInput');
      if(fi) fi.click();
    };
    document.addEventListener('click', handler);
    return;
  }
  if(action==='library:addgame:pickzip'){
    if(state.waitingTouchForImport) return;
    state.waitingTouchForImport = true;
    toast('👆 Touchez l\'écran pour choisir le fichier .zip');
    const handler = () => {
      state.waitingTouchForImport = false;
      document.removeEventListener('click', handler);
      const fi = document.getElementById('addGameZipInput');
      if(fi) fi.click();
    };
    document.addEventListener('click', handler);
    return;
  }
  if(action==='library:addgame:save'){
    const f = state.addGameForm || {};
    // Le nom n'est plus obligatoire : si vide, on retombe sur le nom du
    // dossier/zip importé, sinon un nom générique.
    const name = (f.name||'').trim() || (f.folderName||'').trim() || 'Jeu sans nom';
    const entries = f.folderFiles || [];
    state.addGameError = '';
    if(!entries.length){
      state.addGameError = 'Importe d\'abord un dossier ou un fichier .zip (aucun fichier détecté pour l\'instant).';
      renderHUD();
      return;
    }
    if(!f.entryFile){
      state.addGameError = 'Aucun fichier .html trouvé dans ce que tu as importé — vérifie qu\'il contient bien un index.html.';
      renderHUD();
      return;
    }
    const id = 'cg_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    toast('⏳ Enregistrement...');
    saveCustomGameFiles(id, entries).then(() => {
      const game = {
        id, name, mode: f.mode==='tablet' ? 'tablet' : 'fullscreen',
        entryFile: f.entryFile, fileCount: entries.length, createdAt: Date.now(),
      };
      if(!state.customGames) state.customGames = [];
      state.customGames.push(game);
      saveCustomGames();
      state.addGameModalOpen = false;
      state.addGameForm = { name:'', mode:'fullscreen', folderFiles:null, folderName:'', entryFile:'', htmlCandidates:[] };
      state.addGameError = '';
      state.libraryFilter = 'downloads';
      renderHUD();
      toast('✅ Jeu ajouté à la Library');
    }).catch(err => {
      console.error('[Library] Échec enregistrement du jeu :', err);
      // Message précis et PERSISTANT (affiché dans la modale elle-même,
      // pas juste un toast qui disparaît en 1.6s) pour pouvoir diagnostiquer.
      state.addGameError = 'Échec de l\'enregistrement : ' + (err && err.message ? err.message : String(err));
      renderHUD();
    });
    return;
  }
  if(action.startsWith('library:game:delete:')){
    const id = action.slice(20);
    state.customGames = (state.customGames||[]).filter(g => g.id !== id);
    saveCustomGames();
    deleteCustomGameFiles(id);
    renderHUD();
    toast('🗑 Jeu supprimé');
    return;
  }
  if(action.startsWith('library:game:launch:')){
    const id = action.slice(20);
    const game = (state.customGames||[]).find(g => g.id === id);
    if(!game){ toast('⚠️ Jeu introuvable'); return; }
    state.launchpadOpen = false;
    if(game.mode === 'tablet'){
      state.activeApp = 'customgame:' + id;
      renderHUD();
      toast('🖥️ ' + game.name + ' (tablette)');
    } else {
      openCustomGameFullscreen(game);
    }
    return;
  }
  if(action==='customgame:controls:toggle'){
    state.cgControlsOpen = state.cgControlsOpen === false ? true : false;
    renderHUD();
    return;
  }
  if(action==='customgame:fullscreen:close'){
    closeCustomGameFullscreen();
    return;
  }
  if(action==='menu:open'){
    state.menuHidden = false;
    renderHUD();
    toast('☰ Menu');
    return;
  }
  if(action==='depth:grab'){
    // Le geste est intercepté par updateHandGrab (classe .app-win-depth)
    // Ce handler existe seulement pour l'effet visuel gaze.
    return;
  }
  if(action==='closeApp'){
    state.activeApp = null;
    state.appMaximized = false;
    state.depthGrabOffset = 0;
    state.gameState = {};
    state.dragGazeMode = false;
    state.dragGazeOffX = 0;
    state.dragGazeOffY = 0;
    const calibPanel = document.getElementById('calibPanel');
    if(calibPanel) calibPanel.classList.remove('open');
    renderHUD(); return;
  }
  if(action==='toggleMaximize'){
    state.appMaximized = !state.appMaximized;
    renderHUD();
    toast(state.appMaximized ? '⤢ Fenêtre centrée' : '⤡ Fenêtre à gauche');
    return;
  }
  if(action==='resize:activate'){
    const wc = document.getElementById('appWindowCenterL');
    const el = wc ? wc.querySelector('#appWinEl') : null;
    if(!el){ toast('⚠️ Pas de fenêtre'); return; }
    state.resizeGazeMode = true;
    const o3d = camL.object3D;
    state.resizeGazeYawStart   = o3d ? o3d.rotation.y : 0;
    state.resizeGazePitchStart = o3d ? o3d.rotation.x : 0;
    state.resizeGazeStartW = el.offsetWidth;
    state.resizeGazeStartH = el.offsetHeight;
    toast('↔↕ Tournez la tête · regardez ✓ pour valider');
    renderHUD();
    return;
  }
  if(action==='resize:deactivate'){
    state.resizeGazeMode = false;
    toast('⇲ Redimensionnement désarmé');
    renderHUD();
    return;
  }
  if(action==='resize:confirm'){
    state.resizeGazeMode = false;
    toast('✅ Taille validée');
    renderHUD();
    return;
  }
  if(action==='resize:cancel'){
    // Restaurer taille d'origine
    const applySize = (w, h) => {
      for(const side of ['L','R']){
        const wc = document.getElementById('appWindowCenter'+side);
        if(!wc) continue;
        const el = wc.querySelector('#appWinEl') || wc.querySelector('.app-window,.netflix-win');
        if(el){ el.style.width = w+'px'; el.style.height = h+'px'; }
      }
    };
    applySize(state.resizeGazeStartW, state.resizeGazeStartH);
    state.resizeGazeMode = false;
    toast('↩️ Taille restaurée');
    renderHUD();
    return;
  }

  /* === Drag fenêtre par regard === */
  if(action==='drag:activate'){
    state.dragGazeMode = true;
    const o3d = camL.object3D;
    state.dragGazeYawStart   = o3d ? o3d.rotation.y : 0;
    state.dragGazePitchStart = o3d ? o3d.rotation.x : 0;
    state.dragGazeStartOffX = state.dragGazeOffX;
    state.dragGazeStartOffY = state.dragGazeOffY;
    toast('✥ Tournez la tête pour déplacer · ✓ pour valider');
    renderHUD();
    return;
  }
  if(action==='drag:deactivate'){
    state.dragGazeMode = false;
    toast('✥ Déplacement désarmé');
    renderHUD();
    return;
  }
  if(action==='drag:confirm'){
    state.dragGazeMode = false;
    toast('✅ Position confirmée');
    renderHUD();
    return;
  }
  if(action==='drag:cancel'){
    state.dragGazeMode = false;
    state.dragGazeOffX = state.dragGazeStartOffX;
    state.dragGazeOffY = state.dragGazeStartOffY;
    toast('↩️ Position restaurée');
    renderHUD();
    return;
  }

  /* === Multitâche === */
  if(action==='toggleMultitask'){
    state.multiTaskMode = !state.multiTaskMode;
    if(state.multiTaskMode){
      // Ancrer les fenêtres dans la direction où regarde l'utilisateur maintenant
      state.multiTaskAnchorYaw = (camL.object3D ? camL.object3D.rotation.y : 0) + (state.initYaw || 0);
      state.multiTaskPickerOpen = true;
      toast('⊞ Mode Multitâche activé — choisissez vos apps');
    } else {
      state.multiTaskPickerOpen = false;
      state.multiTaskSlots = [];
      toast('⊟ Mode Multitâche désactivé');
    }
    renderHUD();
    return;
  }
  if(action==='closeMultitaskPicker'){
    state.multiTaskPickerOpen = false;
    renderHUD();
    return;
  }
  if(action.startsWith('multitask:add:')){
    const appId = action.slice(14);
    if(state.multiTaskSlots.length < 5 && !state.multiTaskSlots.find(s=>s.appId===appId)){
      state.multiTaskSlots.push({appId, offX:0, offY:0});
      const app = APPS.find(a=>a.id===appId);
      toast(`⊞ ${app?.name||appId} ajouté`);
    }
    renderHUD();
    return;
  }
  if(action.startsWith('multitask:close:')){
    const idx = parseInt(action.slice(16));
    state.multiTaskSlots.splice(idx, 1);
    if(state.multiTaskSlots.length===0){
      state.multiTaskMode = false;
      state.multiTaskPickerOpen = false;
      toast('⊟ Toutes les fenêtres fermées');
    } else {
      toast('✕ Fenêtre fermée');
    }
    renderHUD();
    return;
  }
  if(action==='multitask:closeAll'){
    state.multiTaskSlots = [];
    state.multiTaskMode = false;
    state.multiTaskPickerOpen = false;
    toast('⊟ Toutes les fenêtres fermées');
    renderHUD();
    return;
  }
  if(action.startsWith('netflix:')){
    handleNetflixAction(action); return;
  }
  if(action==='browser:editurl'){
    openVKB('browserUrl', state.browserUrl || '', t => {
      state.browserUrl = t;
    });
    return;
  }
  if(action==='browser:urlconfirm'){
    let url = state.vkbText.trim();
    if(!url) return;
    // Si c'est une recherche (pas d'URL valide) → Google
    if(!url.includes('.') || url.includes(' ')){
      url = 'https://www.google.com/search?q=' + encodeURIComponent(url) + '&hl=fr';
    } else if(!url.startsWith('http')){
      url = 'https://' + url;
    }
    browserNavigate(url);
    closeVKB();
    return;
  }
  if(action.startsWith('browse:')){
    browserNavigate(action.slice(7));
    return;
  }

  /* === Clavier universel dock (bouton ⌨️) === */
  if(action === 'toggleDockKb'){
    state.dockKbOpen = !state.dockKbOpen;
    if(state.dockKbOpen){
      state.dockKbText = state.dockKbText || '';
      toast('⌨️ Clavier ouvert');
    } else {
      toast('⌨️ Clavier fermé');
    }
    renderHUD(); return;
  }
  if(action.startsWith('dock-kb:')){
    const k = action.slice(8);
    if(!state.dockKbText) state.dockKbText = '';
    if(k === 'clear'){
      state.dockKbText = '';
      renderHUD(); return;
    }
    if(k === 'paste'){
      navigator.clipboard.readText().then(t=>{
        state.dockKbText += t;
        renderHUD(); toast('📋 Collé !');
      }).catch(()=>toast('❌ Accès refusé — autorisez le presse-papiers'));
      return;
    }
    if(k === 'action'){
      // Action contextuelle selon l'app active
      if(state.activeApp === 'safari'){
        let url = state.dockKbText.trim();
        if(url){
          if(!url.includes('.') || url.includes(' ')){
            url = 'https://www.google.com/search?q=' + encodeURIComponent(url) + '&hl=fr';
          } else if(!url.startsWith('http')){
            url = 'https://' + url;
          }
          browserNavigate(url);
          state.safariKbText = url;
          state.dockKbText = url;
        }
      } else if(state.activeApp === 'notes'){
        state.notesText = (state.notesText || '') + state.dockKbText;
        try{ localStorage.setItem('horizonNotes', state.notesText); }catch(_){}
        toast('📝 Inséré dans les notes');
        state.dockKbText = '';
      } else {
        // Mode générique : copier dans le presse-papier
        navigator.clipboard.writeText(state.dockKbText).then(()=>{
          toast('📋 Texte copié dans le presse-papiers !');
        }).catch(()=>{
          toast('📝 Texte : ' + state.dockKbText.slice(0,40));
        });
      }
      renderHUD(); return;
    }
    if(k.startsWith('key:')){
      const letter = k.slice(4);
      playKeySound();
      if(letter === '⌫'){
        state.dockKbText = state.dockKbText.slice(0,-1);
      } else if(letter === 'space'){
        state.dockKbText += ' ';
      } else {
        state.dockKbText += letter.toLowerCase();
      }
      renderHUD(); return;
    }
    return;
  }

  /* === Clavier Safari permanent (barre du bas) === */
  if(action.startsWith('safari-kb:')){
    const k = action.slice(10);
    // Initialiser le texte si besoin
    if(state.safariKbText === undefined) state.safariKbText = state.browserState?.currentUrl || '';
    if(k === 'clear'){
      state.safariKbText = '';
      renderHUD(); return;
    }
    if(k === 'go'){
      let url = (state.safariKbText || '').trim();
      if(url){
        if(!url.includes('.') || url.includes(' ')){
          url = 'https://www.google.com/search?q=' + encodeURIComponent(url) + '&hl=fr';
        } else if(!url.startsWith('http')){
          url = 'https://' + url;
        }
        browserNavigate(url);
        state.safariKbText = url;
      }
      renderHUD(); return;
    }
    if(k === 'paste'){
      navigator.clipboard.readText().then(t=>{
        state.safariKbText = (state.safariKbText||'') + t;
        renderHUD();
        toast('📋 Collé !');
      }).catch(()=>toast('❌ Accès refusé — autorisez le presse-papiers'));
      return;
    }
    if(k.startsWith('shortcut:')){
      const txt = decodeURIComponent(k.slice(9));
      state.safariKbText = (state.safariKbText||'') + txt;
      playKeySound();
      renderHUD(); return;
    }
    if(k.startsWith('key:')){
      const letter = k.slice(4);
      playKeySound();
      if(letter === '⌫'){
        state.safariKbText = (state.safariKbText||'').slice(0,-1);
      } else if(letter === 'space'){
        state.safariKbText = (state.safariKbText||'') + ' ';
      } else {
        state.safariKbText = (state.safariKbText||'') + letter.toLowerCase();
      }
      renderHUD(); return;
    }
    return;
  }
  if(action==='browser:back'){
    const bs = state.browserState;
    if(!bs || bs.histIdx <= 0) return;
    bs.histIdx--;
    bs.currentUrl = bs.history[bs.histIdx];
    bs.loading = true; bs.error = null;
    state.browserUrl = bs.currentUrl;
    state.safariKbText = bs.currentUrl;
    playNavSound();
    renderHUD();
    clearTimeout(bs._loadTimer);
    bs._loadTimer = setTimeout(()=>{ bs.loading=false; renderHUD(); }, 4000);
    return;
  }
  if(action==='browser:fwd'){
    const bs = state.browserState;
    if(!bs || bs.histIdx >= (bs.history||[]).length-1) return;
    bs.histIdx++;
    bs.currentUrl = bs.history[bs.histIdx];
    bs.loading = true; bs.error = null;
    state.browserUrl = bs.currentUrl;
    renderHUD();
    clearTimeout(bs._loadTimer);
    bs._loadTimer = setTimeout(()=>{ bs.loading=false; renderHUD(); }, 4000);
    return;
  }
  if(action==='browser:refresh'){
    const bs = state.browserState || {};
    if(bs.currentUrl){
      bs.loading = true; bs.error = null;
      renderHUD();
      clearTimeout(bs._loadTimer);
      bs._loadTimer = setTimeout(()=>{ bs.loading=false; renderHUD(); }, 4000);
    } else {
      renderHUD();
    }
    return;
  }
  if(action==='browser:home'){
    state.browserState = state.browserState || {};
    state.browserState.currentUrl = '';
    state.browserState.loading = false;
    state.browserState.error = null;
    state.browserUrl = '';
    renderHUD();
    return;
  }
  if(action==='browser:retry'){
    const bs = state.browserState;
    if(!bs || !bs.currentUrl) return;
    bs.loading = true; bs.error = null;
    renderHUD();
    clearTimeout(bs._loadTimer);
    bs._loadTimer = setTimeout(()=>{ bs.loading=false; renderHUD(); }, 10000);
    return;
  }
  if(action==='browser:nextproxy'){
    const bs = state.browserState = state.browserState || {};
    if(!bs.currentUrl) return;
    bs.proxyIdx = ((bs.proxyIdx||0) + 1) % 6;
    const names = ['allorigins','thingproxy','yacdn','corsproxy','codetabs','direct'];
    toast('🔀 Proxy : ' + names[bs.proxyIdx]);
    bs.loading = true; bs.error = null;
    renderHUD();
    clearTimeout(bs._loadTimer);
    bs._loadTimer = setTimeout(()=>{ bs.loading=false; renderHUD(); }, 10000);
    return;
  }
  if(action.startsWith('browser:setproxy:')){
    const idx = parseInt(action.slice(17));
    const bs = state.browserState = state.browserState || {};
    bs.proxyIdx = idx;
    bs.proxyMode = idx < 5; // direct (5) = proxyMode false
    const names = ['allorigins','thingproxy','yacdn','corsproxy','codetabs','direct'];
    toast('🔀 ' + names[idx]);
    if(bs.currentUrl){ bs.loading=true; bs.error=null; renderHUD();
      clearTimeout(bs._loadTimer);
      bs._loadTimer = setTimeout(()=>{ bs.loading=false; renderHUD(); }, 10000); }
    else renderHUD();
    return;
  }
  if(action==='browser:direct'){
    const bs = state.browserState = state.browserState || {};
    bs.proxyMode = false; bs.proxyIdx = 5;
    toast('⚡ Accès direct (sans proxy)');
    if(bs.currentUrl){ bs.loading=true; bs.error=null; renderHUD();
      clearTimeout(bs._loadTimer);
      bs._loadTimer = setTimeout(()=>{ bs.loading=false; renderHUD(); }, 10000); }
    else renderHUD();
    return;
  }
  if(action==='browser:newtab'){
    if(!state.browserTabs) state.browserTabs = [{ url:'', title:'Onglet' }];
    state.browserTabs.push({ url:'', title:'Nouvel onglet' });
    state.browserActiveTab = state.browserTabs.length - 1;
    state.browserState = { currentUrl:'', history:[], histIdx:-1, loading:false, error:null, proxyMode:true, proxyIdx:0 };
    state.safariKbText = '';
    renderHUD();
    return;
  }
  if(action.startsWith('browser:tab:')){
    const idx = parseInt(action.slice(12));
    const tabs = state.browserTabs || [];
    if(idx >= 0 && idx < tabs.length){
      state.browserActiveTab = idx;
      // Restaurer l'état de cet onglet
      const t = tabs[idx];
      state.browserState = t.state || { currentUrl: t.url||'', history:[], histIdx:-1, loading:false, error:null, proxyMode:true, proxyIdx:0 };
      state.safariKbText = state.browserState.currentUrl || '';
    }
    renderHUD();
    return;
  }
  if(action.startsWith('browser:closetab:')){
    const idx = parseInt(action.slice(17));
    const tabs = state.browserTabs || [];
    if(tabs.length > 1){ tabs.splice(idx, 1);
      state.browserActiveTab = Math.min(state.browserActiveTab||0, tabs.length-1);
      const t = tabs[state.browserActiveTab];
      state.browserState = t.state || { currentUrl: t.url||'', history:[], histIdx:-1, loading:false, error:null, proxyMode:true, proxyIdx:0 };
    }
    renderHUD();
    return;
  }
  if(action==='browser:openexternal'){
    const bs = state.browserState;
    if(bs && bs.currentUrl) window.open(bs.currentUrl, '_blank');
    return;
  }
  if(action==='browser:toggleproxy'){
    const bs = state.browserState = state.browserState || {};
    bs.proxyMode = !(bs.proxyMode !== false);
    toast(bs.proxyMode ? '🔀 Proxy activé' : '🌐 Proxy désactivé');
    renderHUD();
    return;
  }
  if(action.startsWith('game:')){
    handleGameAction(action); return;
  }
  if(action.startsWith('scene:')){
    const id = action.slice(6);
    const sc = state.userMedia.find(m=>m.id===id) || SCENES.find(s=>s.id===id);
    if(sc){ hideFlatScreen(); setScene(sc); state.panel='dock'; renderHUD(); }
    return;
  }
  if(action.startsWith('cinema-media:')){
    const id = action.slice(13);
    const sc = state.userMedia.find(m=>m.id===id);
    if(sc){ showFlatScreen(sc); state.panel='dock'; renderHUD(); }
    return;
  }
  if(action.startsWith('panel:')){
    state.panel = action.slice(6);
    renderHUD(); return;
  }
  if(action.startsWith('vhTab:')){
    state.vhHomeTab = action.slice(6);
    renderHUD(); return;
  }
  if(action==='toggleLock'){
    state.locked=!state.locked;
    _prevLocked = null; // force re-évaluation propre dans tickCam
    renderHUD();
    toast(state.locked?'🔒 Menu figé — ne bougera plus':'🔓 Menu libre');
    return;
  }

  /* === Écran de verrouillage === */
  if(action==='lockscreen:show'){
    openLockScreen();
    return;
  }
  if(action==='lockscreen:passcode'){
    ['L','R'].forEach(s=>{
      const p = document.getElementById('ls-pc-panel-'+s);
      if(p) p.style.display='flex';
    });
    return;
  }

  /* === Réglages === */
  if(action.startsWith('settings:')){
    const sub = action.slice(9);
    if(sub.startsWith('nav:')){
      state.settingsSection = sub.slice(4);
      renderHUD(); return;
    }
    if(sub === 'lockscreen:activate'){
      openLockScreen();
      state.activeApp = null;
      renderHUD(); return;
    }
    if(sub === 'lockscreen:wallpaper'){
      // Ouvrir un sélecteur de fichier pour le fond d'écran
      const inp = document.createElement('input');
      inp.type='file'; inp.accept='image/*';
      inp.onchange = e => {
        const f = e.target.files[0]; if(!f) return;
        const r = new FileReader();
        r.onload = ev => {
          state.lockscreenWallpaper = ev.target.result;
          updateLockscreenBg();
          toast('🖼 Fond d\'écran mis à jour !');
          renderHUD();
        };
        r.readAsDataURL(f);
      };
      inp.click(); return;
    }
    if(sub === 'lockscreen:changecode'){
      state.lockscreenChangingCode = true;
      state.lockscreenNewCode = '';
      state.lockscreenInput = '';
      state.lockscreenCodeStep = 0;
      renderHUD(); return;
    }
    if(sub.startsWith('code:')){
      const k = sub.slice(5);
      if(k === 'cancel'){
        state.lockscreenChangingCode = false;
        state.lockscreenNewCode = '';
        state.lockscreenInput = '';
        state.lockscreenCodeStep = 0;
        renderHUD(); return;
      }
      if(k === '⌫'){
        if(state.lockscreenCodeStep === 0){
          state.lockscreenNewCode = state.lockscreenNewCode.slice(0,-1);
        } else {
          state.lockscreenInput = state.lockscreenInput.slice(0,-1);
        }
        renderHUD(); return;
      }
      if(state.lockscreenCodeStep === 0){
        state.lockscreenNewCode = (state.lockscreenNewCode || '') + k;
        if(state.lockscreenNewCode.length >= 6){
          state.lockscreenCodeStep = 1;
          state.lockscreenInput = '';
          renderHUD();
        } else { renderHUD(); }
      } else {
        state.lockscreenInput = (state.lockscreenInput || '') + k;
        if(state.lockscreenInput.length >= 6){
          if(state.lockscreenInput === state.lockscreenNewCode){
            state.lockscreenPasscode = state.lockscreenNewCode;
            try{ localStorage.setItem('horizonPasscode', state.lockscreenPasscode); }catch(_){}
            state.lockscreenChangingCode = false;
            state.lockscreenNewCode = '';
            state.lockscreenInput = '';
            state.lockscreenCodeStep = 0;
            toast('✅ Nouveau code enregistré !');
          } else {
            state.lockscreenInput = '';
            state.lockscreenCodeStep = 0;
            state.lockscreenNewCode = '';
            toast('❌ Les codes ne correspondent pas, recommencez');
          }
          renderHUD();
        } else { renderHUD(); }
      }
      return;
    }
    if(sub.startsWith('toggle:')){
      const key = sub.slice(7);
      state[key+'Enabled'] = !state[key+'Enabled'];
      renderHUD(); return;
    }
    if(sub === 'vr:opencalib'){
      const panel = document.getElementById('calibPanel');
      if(panel) panel.classList.add('open');
      return;
    }
    if(sub === 'vr:recenter'){
      const btn = document.getElementById('recenterBtn');
      if(btn) btn.click();
      return;
    }
    renderHUD(); return;
  }
  if(action==='closeCalibPanel'){
    const panel = document.getElementById('calibPanel');
    if(panel) panel.classList.remove('open');
    return;
  }
  if(action.startsWith('depthStep:')){
    const step = parseInt(action.slice(10)) || 0;
    state.depthGrabOffset = 0;
    state.uiDepthExtra = Math.max(-200, Math.min(400, (state.uiDepthExtra||0) + step));
    const valLabel = document.getElementById('valUiDepth');
    if(valLabel) valLabel.textContent = (state.uiDepthExtra>=0?'+':'')+state.uiDepthExtra+'px';
    const rng = document.getElementById('rngUiDepth');
    if(rng) rng.value = state.uiDepthExtra;
    const sv = document.getElementById('settingsDepthVal');
    if(sv) sv.textContent = (state.uiDepthExtra>=0?'+':'')+state.uiDepthExtra+'px';
    const sr = document.getElementById('settingsRngDepth');
    if(sr) sr.value = state.uiDepthExtra;
    try{ localStorage.setItem('calib:uiDepth', String(state.uiDepthExtra)); }catch(_){}
    renderHUD(); return;
  }
  if(action==='toggleGaze'){ state.gazeEnabled=!state.gazeEnabled; renderHUD(); return; }
  if(action==='toggleHide'){
    state.menuHidden = !state.menuHidden;
    if(state.menuHidden) state.launchpadOpen = false;
    renderHUD();
    toast(state.menuHidden?'Menu masqué — regardez le ❌ au sol':'Menu réaffiché');
    return;
  }
  if(action==='showMenu'){
    state.menuHidden = false;
    renderHUD();
    toast('Menu réaffiché');
    return;
  }
  if(action==='cinema:playpause'){
    const v = $('userVid');
    if(v){
      if(v.paused){
        state.showMenuInCinema = false;
        v.play().catch(()=>{});
      } else {
        v.pause();
        state.showMenuInCinema = true;
        state.panel = 'dock';
      }
    }
    renderHUD();
    return;
  }
  if(action==='cinema:scrub:activate'){
    const v = $('userVid');
    if(!v || !v.duration){ toast('⚠️ Pas de vidéo'); return; }
    if(v.paused === false) v.pause();
    state.scrubMode = true;
    state.scrubYawStart = camL.object3D ? camL.object3D.rotation.y : null;
    state.scrubPctStart = v.duration ? (v.currentTime / v.duration) : 0;
    toast('↔️ Tournez la tête · regardez le point 2s pour valider');
    renderHUD();
    return;
  }
  if(action==='cinema:scrub:confirm'){
    const v = $('userVid');
    if(v && v.duration && state.scrubMode){
      const pct = (state._scrubCurrentPct !== undefined) ? state._scrubCurrentPct : state.scrubPctStart;
      v.currentTime = pct * v.duration;
    }
    state.scrubMode = false;
    state.scrubYawStart = null;
    state._scrubCurrentPct = undefined;
    toast('✅ Position confirmée');
    renderHUD();
    return;
  }
  if(action==='cinema:scrub:cancel'){
    const v = $('userVid');
    if(v && v.duration && state.scrubMode){
      v.currentTime = state.scrubPctStart * v.duration;
    }
    state.scrubMode = false;
    state.scrubYawStart = null;
    state._scrubCurrentPct = undefined;
    toast('↩️ Annulé');
    renderHUD();
    return;
  }
  if(action==='cinema:skipback'){
    const v = $('userVid');
    if(v){ v.currentTime = Math.max(0, v.currentTime - 15); }
    return;
  }
  if(action==='cinema:skipfwd'){
    const v = $('userVid');
    if(v){ v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 15); }
    return;
  }
  if(action==='appletv:options'){
    toast('⚙️ Compte · Notifications · Sous-titres · Aide');
    return;
  }
  if(action.startsWith('appletv:open:')){
    const id = action.slice(13);
    const it = ATV_ITEMS.find(x=>x.id===id);
    // Ouvrir popup d'import
    state.atvImportItem = it || { id, title: id, big:'📺' };
    state.atvImportPopupOpen = true;
    renderHUD();
    return;
  }
  if(action==='appletv:import:cancel'){
    state.atvImportPopupOpen = false;
    state.atvImportItem = null;
    renderHUD();
    return;
  }
  if(action.startsWith('appletv:import:confirm:')){
    const id = action.slice(23);
    const it = state.atvImportItem;
    const key = 'atv-'+id;
    state.atvPendingKey = key;
    state.atvPendingName = it ? it.title : id;
    state.atvImportPopupOpen = false;
    state.atvImportItem = null;
    renderHUD();
    toast('📁 Touchez l\'écran pour importer '+state.atvPendingName);
    const handler = ()=>{
      document.removeEventListener('click', handler);
      const fi = document.getElementById('atvFileInput');
      if(fi){ fi.setAttribute('data-key', key); fi.setAttribute('data-name', state.atvPendingName); fi.click(); }
    };
    document.addEventListener('click', handler);
    return;
  }
  /* Apple TV creator */
  if(action==='appletv:creator:menu'){
    state.atvCreatorOpen = true;
    state.atvCreatorType = null;
    state.atvCreatorForm = { name:'', story:'', seasons:1, episodesPerSeason:12, coverDataUrl:'' };
    renderHUD(); return;
  }
  if(action==='appletv:creator:close'){
    state.atvCreatorOpen = false; renderHUD(); return;
  }
  if(action==='appletv:creator:type:series'){ state.atvCreatorType='series'; renderHUD(); return; }
  if(action==='appletv:creator:type:movie'){ state.atvCreatorType='movie'; renderHUD(); return; }
  if(action==='appletv:creator:cover'){
    toast('📁 Touchez l\'écran pour choisir une image');
    const handler=()=>{ document.removeEventListener('click',handler); const ci=document.getElementById('atvCoverInput'); if(ci) ci.click(); };
    document.addEventListener('click', handler); return;
  }
  if(action==='appletv:creator:edit:name'){
    openVKB('name', state.atvCreatorForm.name, t=>{ state.atvCreatorForm.name=t; }); return;
  }
  if(action==='appletv:creator:edit:story'){
    openVKB('story', state.atvCreatorForm.story, t=>{ state.atvCreatorForm.story=t; }); return;
  }
  if(action==='appletv:creator:save'){
    const f = state.atvCreatorForm;
    if(!f.name.trim()) return;
    const uc = { id:Date.now(), type:state.atvCreatorType||'movie', name:f.name.trim(), story:f.story.trim(), seasons:f.seasons, episodesPerSeason:f.episodesPerSeason, coverDataUrl:f.coverDataUrl, createdAt:Date.now() };
    state.atvUserContent = [uc, ...state.atvUserContent];
    saveATVUserContent();
    state.atvCreatorOpen = false;
    toast(`✅ "${uc.name}" créé avec succès !`);
    renderHUD(); return;
  }
  if(action.startsWith('appletv:user:play:')){
    const ucId = parseInt(action.slice(18));
    const uc = state.atvUserContent.find(c=>c.id===ucId);
    if(!uc) return;
    toast(`📁 Touchez l'écran pour importer "${uc.name}"`);
    const handler=()=>{ document.removeEventListener('click',handler); const fi=document.getElementById('atvUserContentFileInput'); if(fi){ fi.setAttribute('data-ucid',ucId); fi.click(); } };
    document.addEventListener('click', handler); return;
  }
  /* Disney+ actions */
  if(action.startsWith('disney:open:')){
    const id = action.slice(12);
    const disneyItems = [
      { id:'lightyear', title:'Lightyear', big:'🚀' },
      { id:'lovethunder', title:'Love Thunder', big:'⚡' },
      { id:'wakanda', title:'Wakanda Forever', big:'🐾' },
      { id:'themenu', title:'The Menu', big:'🍽' },
      { id:'thor', title:'Thor', big:'🔨' },
    ];
    const it = disneyItems.find(x=>x.id===id) || { id, title:id, big:'🎬' };
    state.disneyImportItem = it;
    state.disneyImportPopupOpen = true;
    renderHUD(); return;
  }
  if(action==='disney:import:cancel'){
    state.disneyImportPopupOpen = false;
    state.disneyImportItem = null;
    renderHUD(); return;
  }
  if(action.startsWith('disney:import:confirm:')){
    const id = action.slice(22);
    const it = state.disneyImportItem;
    const key = 'disney-'+id;
    state.disneyPendingKey = key;
    state.disneyPendingName = it ? it.title : id;
    state.disneyImportPopupOpen = false;
    state.disneyImportItem = null;
    renderHUD();
    toast('📁 Touchez l\'écran pour importer '+state.disneyPendingName);
    const handler=()=>{ document.removeEventListener('click',handler); const fi=document.getElementById('disneyFileInput'); if(fi){ fi.setAttribute('data-key',key); fi.setAttribute('data-name',state.disneyPendingName); fi.click(); } };
    document.addEventListener('click', handler); return;
  }
  if(action==='disney:creator:menu'){
    state.disneyCreatorOpen = true;
    state.disneyCreatorType = null;
    state.disneyCreatorForm = { name:'', story:'', seasons:1, episodesPerSeason:12, coverDataUrl:'' };
    renderHUD(); return;
  }
  if(action==='disney:creator:close'){ state.disneyCreatorOpen=false; renderHUD(); return; }
  if(action==='disney:creator:type:series'){ state.disneyCreatorType='series'; renderHUD(); return; }
  if(action==='disney:creator:type:movie'){ state.disneyCreatorType='movie'; renderHUD(); return; }
  if(action==='disney:creator:cover'){
    toast('📁 Touchez l\'écran pour choisir une image');
    const handler=()=>{ document.removeEventListener('click',handler); const ci=document.getElementById('disneyCoverInput'); if(ci) ci.click(); };
    document.addEventListener('click', handler); return;
  }
  if(action==='disney:creator:edit:name'){
    openVKB('name', state.disneyCreatorForm.name, t=>{ state.disneyCreatorForm.name=t; }); return;
  }
  if(action==='disney:creator:edit:story'){
    openVKB('story', state.disneyCreatorForm.story, t=>{ state.disneyCreatorForm.story=t; }); return;
  }
  if(action==='disney:creator:save'){
    const f = state.disneyCreatorForm;
    if(!f.name.trim()) return;
    const uc = { id:Date.now(), type:state.disneyCreatorType||'movie', name:f.name.trim(), story:f.story.trim(), seasons:f.seasons, episodesPerSeason:f.episodesPerSeason, coverDataUrl:f.coverDataUrl, createdAt:Date.now() };
    state.disneyUserContent = [uc, ...state.disneyUserContent];
    saveDisneyUserContent();
    state.disneyCreatorOpen = false;
    toast(`✅ "${uc.name}" créé avec succès !`);
    renderHUD(); return;
  }
  if(action.startsWith('disney:user:play:')){
    const ucId = parseInt(action.slice(17));
    const uc = state.disneyUserContent.find(c=>c.id===ucId);
    if(!uc) return;
    toast(`📁 Touchez l'écran pour importer "${uc.name}"`);
    const handler=()=>{ document.removeEventListener('click',handler); const fi=document.getElementById('disneyUserContentFileInput'); if(fi){ fi.setAttribute('data-ucid',ucId); fi.click(); } };
    document.addEventListener('click', handler); return;
  }
  if(action.startsWith('deleteMedia:')){
    const id = action.slice(12);
    deleteUserMedia(id);
    return;
  }
  if(action==='addFiles'){
    if(state.waitingTouchForImport) return;
    state.waitingTouchForImport = true;
    toast('⚠️ Touchez l\'écran pour ouvrir vos fichiers');
    const handler = () => {
      state.waitingTouchForImport = false;
      document.removeEventListener('click', handler);
      $('fileInput').click();
    };
    document.addEventListener('click', handler);
    return;
  }
  if(action==='import-as-screen'){
    const media = state.importPendingMedia;
    if(media){
      media.type = 'cinema';
      const existing = state.userMedia.find(m => m.id === media.id);
      if(existing) existing.type = 'cinema';
      saveUserMedia();
      showFlatScreen(media); state.panel='dock'; renderHUD();
    }
    return;
  }
  if(action==='import-as-sky'){
    const media = state.importPendingMedia;
    if(media){
      media.type = '360';
      const existing = state.userMedia.find(m => m.id === media.id);
      if(existing) existing.type = '360';
      saveUserMedia();
      hideFlatScreen(); setScene(media); state.panel='dock'; renderHUD();
    }
    return;
  }
  if(action.startsWith('maison:')){
    handleMaisonAction(action); return;
  }
  if(action.startsWith('notes:key:')){
    const k = action.slice(10);
    handleNotesKey(k);
    return;
  }
  if(action === 'notes:edittext'){
    const now = Date.now();
    if(now - state.vkbLastTap < 400){
      openNativeKB(state.notesText, t=>{ state.notesText=t||''; try{localStorage.setItem('horizonNotes',state.notesText);}catch(_){} renderHUD(); });
    } else {
      state.vkbLastTap = now;
      openVKB('notes', state.notesText, t=>{ state.notesText=t; try{localStorage.setItem('horizonNotes',t);}catch(_){} });
    }
    return;
  }
  if(action === 'notes:clear'){ state.notesText = ''; try{localStorage.removeItem('horizonNotes');}catch(_){} renderHUD(); return; }
  if(action === 'notes:save'){
    try{ localStorage.setItem('horizonNotes', state.notesText); }catch(_){}
    toast('💾 Note sauvegardée !'); return;
  }
  if(action==='fullscreen'){ document.documentElement.requestFullscreen?.(); return; }
  if(action==='info'){ toast('Regardez un bouton 3 secondes pour le sélectionner'); return; }

  /* ---- Clavier virtuel universel (vkb:) ---- */
  if(action.startsWith('vkb:')){
    const k = action.slice(4);
    if(k === 'done'){ closeVKB(); return; }
    if(k.startsWith('shortcut:')){
      const txt = decodeURIComponent(k.slice(9));
      state.vkbText += txt;
      if(state.vkbCallback) state.vkbCallback(state.vkbText);
      renderHUD(); return;
    }
    if(k === 'paste'){
      toast('📋 Touchez l\'écran pour autoriser la copie');
      const handler = () => {
        document.removeEventListener('click', handler);
        navigator.clipboard.readText().then(t => {
          state.vkbText += t;
          if(state.vkbCallback) state.vkbCallback(state.vkbText);
          renderHUD();
          toast('📋 Collé !');
        }).catch(()=>toast('❌ Accès refusé — autorisez le presse-papiers dans les réglages'));
      };
      document.addEventListener('click', handler);
      return;
    }
    vkbType(k);
    return;
  }
  /* ---- Rétro-compat anciens keyboard: (creator) ---- */
  if(action.startsWith('keyboard:key:') || action==='keyboard:done' || action==='keyboard:paste'){
    const k = action.startsWith('keyboard:key:') ? action.slice(13) : (action==='keyboard:done'?'done':'paste');
    if(k==='paste'){
      toast('📋 Touchez l\'écran pour autoriser la copie');
      const handler = () => {
        document.removeEventListener('click', handler);
        navigator.clipboard.readText().then(t=>{
          state.vkbText+=t; if(state.vkbCallback) state.vkbCallback(state.vkbText); renderHUD(); toast('📋 Collé !');
        }).catch(()=>toast('❌ Accès refusé — autorisez le presse-papiers dans les réglages'));
      };
      document.addEventListener('click', handler);
      return;
    }
    if(k==='done'){ closeVKB(); return; }
    vkbType(k);
    return;
  }
}

$('fileInput').addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files||[]);
  if(files.length===0) return;
  // Les images (futurs fonds 360° / médias) sont redimensionnées AVANT de devenir
  // une texture ou d'être sauvegardées, pour éviter le crash mémoire sur mobile.
  const processedFiles = await Promise.all(files.map(f =>
    f.type.startsWith('image') ? resizeImageFileToBlob(f, 2048, 0.82) : f
  ));
  const items = files.map((f,i)=>({
    id:'user-'+Date.now()+'-'+i,
    name:f.name.replace(/\.[^.]+$/,''),
    kind:f.type.startsWith('video')?'video':'image',
    url:URL.createObjectURL(processedFiles[i]),
  }));
  // Sauvegarde chaque fichier (redimensionné pour les images) dans IndexedDB pour qu'il survive à la fermeture de l'app
  items.forEach((item, i) => { galSaveBlob(processedFiles[i], item.id); });
  state.importPendingMedia = items[0];
  state.userMedia = [...items, ...state.userMedia];
  saveUserMedia();
  state.panel = 'import-choice';
  renderHUD();
  e.target.value = '';
});

/* Apple Music — lecture directe (play sans blob préchargé) */
document.addEventListener('change', e=>{
  if(e.target.id !== 'amPlayFileInput') return;
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const id = e.target.getAttribute('data-trackid') || state.amPendingPlayTrackId;
  const track = state.amTracks.find(t=>t.id===id);
  if(track){
    track.audioBlob = f;
    amSaveLibrary();
    // Jouer DIRECTEMENT ici — on est dans un geste utilisateur (change event)
    const audio = _getAmAudio();
    audio.pause();
    if(audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(f);
    audio.volume = state.amVolume||0.8;
    audio.load();
    audio.play().catch(err=>{ toast('⚠️ ' + (err.message||err)); });
    state.amCurrentTrack = track;
    state.amPlaying = true;
    state.amProgress = 0;
    _amAudio = audio;
    audio.ontimeupdate = ()=>{ state.amProgress=audio.currentTime; state.amDuration=audio.duration||0; renderHUD(); };
    audio.onended = ()=>{ if(state.amRepeat){audio.currentTime=0;audio.play();return;} amNext(); };
    renderHUD();
    toast('🎵 ' + track.name);
  }
  e.target.value = '';
});

/* Apple Music — cover image input */
document.addEventListener('change', e=>{
  if(e.target.id !== 'amCoverFileInput') return;
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  fileToResizedDataURL(f, 400, 0.75).then(dataUrl=>{ state.amPendingCoverDataUrl = dataUrl; renderHUD(); toast('🖼 Couverture chargée !'); });
  e.target.value = '';
});

/* Apple Music — MP3 audio input */
document.addEventListener('change', e=>{
  if(e.target.id !== 'amMp3FileInput') return;
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  state.amPendingAudioBlob = f;
  if(!state.amNewTrackName) state.amNewTrackName = f.name.replace(/\.[^.]+$/, '');
  renderHUD();
  toast('🎵 Fichier audio chargé : ' + f.name);
  e.target.value = '';
});

/* ------------ Suppression média importé ------------ */
function deleteUserMedia(id){
  state.userMedia = state.userMedia.filter(m => m.id !== id);
  saveUserMedia();
  galDeleteBlob(id);
  renderHUD();
  toast('🗑 Média supprimé');
}


/* ============================================================
   Launchpad · Library — persistance des jeux HTML/JS custom
   ============================================================ */
function saveCustomGames(){
  try{ localStorage.setItem('horizonCustomGames', JSON.stringify(state.customGames||[])); }catch(_){}
}
function loadCustomGames(){
  try{
    const raw = localStorage.getItem('horizonCustomGames');
    if(raw) state.customGames = JSON.parse(raw);
  }catch(_){}
}
loadCustomGames();

/* ============================================================
   Launchpad · Library — import d'un DOSSIER complet (HTML/JS/CSS/
   assets) pour un jeu custom, servi ensuite par le Service Worker
   ============================================================ */

/* Appelé par l'<input type="file" webkitdirectory> du modal
   « Ajouter un jeu ». On ne fait ici QUE lire la liste + détecter
   le fichier d'entrée : l'écriture réelle dans le Cache Storage a
   lieu au moment d'« Enregistrer », via saveCustomGameFiles(). */
function handleAddGameFolderSelect(fileList){
  const files = Array.from(fileList || []);
  if(!files.length) return;
  if(!state.addGameForm) state.addGameForm = { name:'', mode:'fullscreen' };
  state.addGameError = '';

  const entries = files.map(file => {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    // On retire le nom du dossier racine sélectionné : seul le
    // chemin relatif À L'INTÉRIEUR du dossier nous intéresse.
    const relPath = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
    return { relPath, file };
  });

  const folderName = (files[0].webkitRelativePath || files[0].name || 'Dossier').split('/')[0];
  const htmlEntries = entries.filter(e => /\.html?$/i.test(e.relPath));

  let entryFile =
    htmlEntries.find(e => e.relPath.toLowerCase() === 'index.html') ||
    htmlEntries.find(e => !e.relPath.includes('/')) ||
    htmlEntries[0] ||
    null;

  state.addGameForm.folderFiles = entries;
  state.addGameForm.folderName = folderName;
  state.addGameForm.entryFile = entryFile ? entryFile.relPath : '';
  state.addGameForm.htmlCandidates = htmlEntries.map(e => e.relPath);

  state.addGameForm.sourceType = 'folder';
  if(!htmlEntries.length){
    state.addGameError = 'Aucun fichier .html trouvé dans ce dossier — vérifie qu\'il contient bien un index.html.';
    renderHUD();
  } else {
    renderHUD();
    toast('✅ ' + entries.length + ' fichier' + (entries.length>1?'s':'') + ' importés');
  }
}

/* Appelé par l'<input type="file" accept=".zip"> du modal
   « Ajouter un jeu » (même emplacement que l'import de dossier, en
   alternative). Dézippe le fichier entièrement dans le navigateur
   via JSZip, puis reconstruit exactement la même structure
   d'entrées { relPath, file } que handleAddGameFolderSelect, pour
   pouvoir réutiliser tel quel le pipeline d'enregistrement
   (saveCustomGameFiles → Cache Storage → Service Worker). */
async function handleAddGameZipSelect(fileList){
  const zipFile = (fileList || [])[0];
  if(!zipFile) return;
  if(!state.addGameForm) state.addGameForm = { name:'', mode:'fullscreen' };
  state.addGameError = '';

  if(typeof JSZip === 'undefined'){
    state.addGameError = 'Le dézippage n\'est pas disponible (bibliothèque JSZip non chargée — vérifie ta connexion internet puis réessaie).';
    renderHUD();
    return;
  }
  if(!/\.zip$/i.test(zipFile.name)){
    state.addGameError = 'Ce fichier n\'est pas un .zip (' + zipFile.name + ').';
    renderHUD();
    return;
  }

  toast('⏳ Extraction du zip...');
  try{
    const zip = await JSZip.loadAsync(zipFile);
    const rawEntries = [];
    zip.forEach((relativePath, zipEntry) => {
      // On ignore les fichiers parasites générés par macOS lors de la
      // création d'un zip (__MACOSX/, .DS_Store) : ils ne servent à
      // rien ici et peuvent fausser la détection du dossier racine.
      if(zipEntry.dir) return;
      if(/(^|\/)__MACOSX(\/|$)/.test(relativePath)) return;
      if(/(^|\/)\.DS_Store$/.test(relativePath)) return;
      rawEntries.push({ relativePath, zipEntry });
    });
    if(!rawEntries.length){
      state.addGameError = 'Ce zip est vide (ou ne contient que des fichiers système).';
      renderHUD();
      return;
    }

    // Si tous les fichiers du zip partagent un même dossier racine
    // (cas fréquent des exports type "MonJeu-main/..."), on retire
    // ce préfixe pour retrouver une structure de chemins propre.
    const firstParts = rawEntries[0].relativePath.split('/');
    let commonRoot = firstParts.length > 1 ? firstParts[0] : null;
    if(commonRoot && !rawEntries.every(e => e.relativePath.split('/')[0] === commonRoot)){
      commonRoot = null;
    }

    const entries = [];
    for(const { relativePath, zipEntry } of rawEntries){
      const relPath = commonRoot ? relativePath.slice(commonRoot.length + 1) : relativePath;
      if(!relPath) continue; // dossier racine lui-même, rien à écrire
      const blob = await zipEntry.async('blob');
      // On enveloppe le contenu dans un vrai File pour qu'il ait
      // .arrayBuffer() et un nom, comme les fichiers venant d'un
      // <input webkitdirectory>.
      const file = new File([blob], relPath.split('/').pop());
      entries.push({ relPath, file });
    }

    if(!entries.length){
      state.addGameError = 'Ce zip est vide (ou ne contient que des fichiers système).';
      renderHUD();
      return;
    }

    const folderName = commonRoot || zipFile.name.replace(/\.zip$/i, '');
    const htmlEntries = entries.filter(e => /\.html?$/i.test(e.relPath));
    let entryFile =
      htmlEntries.find(e => e.relPath.toLowerCase() === 'index.html') ||
      htmlEntries.find(e => !e.relPath.includes('/')) ||
      htmlEntries[0] ||
      null;

    state.addGameForm.folderFiles = entries;
    state.addGameForm.folderName = folderName;
    state.addGameForm.entryFile = entryFile ? entryFile.relPath : '';
    state.addGameForm.htmlCandidates = htmlEntries.map(e => e.relPath);
    state.addGameForm.sourceType = 'zip';

    if(!htmlEntries.length){
      state.addGameError = 'Aucun fichier .html trouvé dans ce zip — vérifie qu\'il contient bien un index.html.';
      renderHUD();
    } else {
      renderHUD();
      toast('✅ ' + entries.length + ' fichier' + (entries.length>1?'s':'') + ' dézippés');
    }
  }catch(err){
    console.error('[Library] Échec extraction zip :', err);
    state.addGameError = 'Zip invalide ou corrompu : ' + (err && err.message ? err.message : String(err));
    renderHUD();
  }
}
window.handleAddGameZipSelect = handleAddGameZipSelect;

/* Devine un Content-Type correct pour que le navigateur exécute /
   affiche chaque fichier normalement une fois servi par le SW. */
function guessCustomGameMime(relPath){
  const ext = (relPath.split('.').pop() || '').toLowerCase();
  const map = {
    html:'text/html; charset=utf-8', htm:'text/html; charset=utf-8',
    js:'application/javascript; charset=utf-8', mjs:'application/javascript; charset=utf-8',
    css:'text/css; charset=utf-8', json:'application/json; charset=utf-8',
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
    webp:'image/webp', svg:'image/svg+xml', ico:'image/x-icon',
    mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg',
    mp4:'video/mp4', webm:'video/webm',
    glb:'model/gltf-binary', gltf:'model/gltf+json',
    woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf',
    wasm:'application/wasm', txt:'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

/* Construit l'URL virtuelle sous laquelle un fichier d'un jeu
   importé est stocké / servi : ./customgame-files/<id>/<chemin> */
function customGameFileUrl(id, relPath){
  return new URL('./customgame-files/' + id + '/' + relPath, location.href).toString();
}

/* Écrit chaque fichier du dossier importé dans le cache dédié aux
   jeux custom (voir sw.js → CUSTOM_GAMES_CACHE). C'est le Service
   Worker qui, ensuite, répondra à ces URLs quand l'iframe du jeu
   les demandera (script src, css, images, etc.) — exactement comme
   un vrai petit serveur pour ce dossier. */
async function saveCustomGameFiles(id, entries){
  if(!('caches' in window)){
    throw new Error('Le stockage hors-ligne (Cache Storage) n\'est pas disponible sur ce navigateur/contexte.');
  }
  const cache = await caches.open('horizon-customgames-v1');
  for(const { relPath, file } of entries){
    try{
      const buf = await file.arrayBuffer();
      const resp = new Response(buf, { headers: { 'Content-Type': guessCustomGameMime(relPath) } });
      await cache.put(customGameFileUrl(id, relPath), resp);
    }catch(err){
      // On identifie le fichier fautif (utile pour un gros asset qui dépasse
      // le quota de stockage du navigateur, ou un fichier corrompu du zip).
      throw new Error('Fichier "' + relPath + '" : ' + (err && err.message ? err.message : String(err)));
    }
  }
}

/* Supprime tous les fichiers d'un jeu du cache quand il est retiré
   de la Library, pour ne pas accumuler des dossiers fantômes. */
async function deleteCustomGameFiles(id){
  try{
    if(!('caches' in window)) return;
    const cache = await caches.open('horizon-customgames-v1');
    const prefix = customGameFileUrl(id, '');
    const requests = await cache.keys();
    await Promise.all(
      requests.filter(req => req.url.startsWith(prefix)).map(req => cache.delete(req))
    );
  }catch(_){}
}

/* ============================================================
   Overlay plein-écran (stéréo + hand tracking) pour un jeu custom
   Ceci sort volontairement du système de rendu double-œil (HUD)
   pour couvrir tout le viewport une seule fois : le code du jeu
   peut alors gérer sa propre session WebXR (navigator.xr.requestSession)
   pour le rendu stéréo et le hand tracking natifs du casque.
   ============================================================ */
function openCustomGameFullscreen(game){
  closeCustomGameFullscreen();
  state.customGameFullscreenId = game.id;

  const overlay = document.createElement('div');
  overlay.id = '__customGameFullscreenOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#000;';

  const closeBtn = document.createElement('div');
  closeBtn.textContent = '✕ Quitter';
  closeBtn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:99999;'
    + 'background:rgba(20,20,20,0.75);backdrop-filter:blur(10px);color:#fff;'
    + 'font-size:13px;font-weight:600;padding:10px 16px;border-radius:999px;'
    + 'border:1px solid rgba(255,255,255,0.25);cursor:pointer;';
  closeBtn.addEventListener('click', closeCustomGameFullscreen);

  const iframe = document.createElement('iframe');
  iframe.className = 'customgame-frame';
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-popups');
  iframe.setAttribute('allow', 'xr-spatial-tracking; camera; microphone; autoplay; gamepad; fullscreen');
  // Le dossier importé est servi par le Service Worker depuis le
  // Cache Storage (voir saveCustomGameFiles / sw.js) : on charge donc
  // une vraie URL et non plus un srcdoc, ce qui permet aux fichiers
  // du jeu de se référencer entre eux normalement (script src, css, assets...).
  iframe.src = customGameFileUrl(game.id, game.entryFile || 'index.html');

  overlay.appendChild(iframe);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  toast('📺 ' + game.name + ' (plein écran)');
}
function closeCustomGameFullscreen(){
  const old = document.getElementById('__customGameFullscreenOverlay');
  if(old) old.remove();
  state.customGameFullscreenId = null;
}
