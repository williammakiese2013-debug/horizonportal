/* ============================================================
   Netflix — lecture Super 8 (IndexedDB, pas de blob expirable)
   ============================================================ */
function handleNetflixAction(action){
  if(action.startsWith('netflix:tab:')){
    state.netflixTab = action.split(':')[2];
    renderHUD();
    return;
  }
  if(action === 'netflix:play:super8'){
    nfLoadBlob().then(blob => {
      if(blob){
        const url = URL.createObjectURL(blob);
        const media = { id:'netflix-super8', name:'Super 8', kind:'video', url, type:'cinema' };
        showFlatScreen(media);
        state.panel = 'dock';
        state.activeApp = null;
        state.appMaximized = false;
        renderHUD();
        toast('📺 Super 8 — Mode Cinéma');
      } else {
        // Pas de vidéo sauvegardée → demander import
        state.netflixWaitingImport = true;
        toast('🎬 Touchez l\'écran pour importer Super 8');
        const handler = ()=>{
          state.netflixWaitingImport = false;
          document.removeEventListener('click', handler);
          const nfi = document.getElementById('netflixFileInput');
          if(nfi) nfi.click();
        };
        document.addEventListener('click', handler);
      }
    });
    return;
  }

  /* ---- Stranger Things : ouvrir picker ---- */
  if(action === 'netflix:open:strangerthings'){
    state.stPickerOpen = true;
    state.stPickerSeason = 1;
    renderHUD();
    return;
  }
  /* ---- Stranger Things : fermer picker ---- */
  if(action === 'netflix:st:close'){
    state.stPickerOpen = false;
    renderHUD();
    return;
  }
  /* ---- Stranger Things : changer saison ---- */
  if(action.startsWith('netflix:st:season:')){
    state.stPickerSeason = parseInt(action.split(':')[3]);
    renderHUD();
    return;
  }
  /* ---- Stranger Things : lancer épisode ---- */
  if(action.startsWith('netflix:st:play:')){
    const parts = action.split(':');
    const s = parseInt(parts[3]);
    const ep = parseInt(parts[4]);
    const key = `s${s}e${ep}`;
    const epData = ST_SEASONS[s].episodes.find(e=>e.ep===ep);
    const epName = epData ? `ST S${s} E${ep} — ${epData.title}` : `Stranger Things S${s}E${ep}`;

    stLoadBlob(key).then(blob=>{
      if(blob){
        const url = URL.createObjectURL(blob);
        const media = { id:`st-${key}`, name:epName, kind:'video', url, type:'cinema' };
        state.stPickerOpen = false;
        showFlatScreen(media);
        state.panel = 'dock';
        state.activeApp = null;
        state.appMaximized = false;
        renderHUD();
        toast(`📺 ${epName} — Mode Cinéma`);
      } else {
        /* Pas de fichier → demander import */
        state.stPendingKey = key;
        state.stPendingName = epName;
        toast(`🎬 Touchez l'écran pour importer ${epName}`);
        const handler = ()=>{
          document.removeEventListener('click', handler);
          const stfi = document.getElementById('stFileInput');
          if(stfi){ stfi.setAttribute('data-key', key); stfi.click(); }
        };
        document.addEventListener('click', handler);
      }
    });
    return;
  }

  /* ---- Series Picker : ouvrir popup ---- */
  if(action.startsWith('netflix:series:open:')){
    const key = action.split(':')[3];
    if(!seriesCatalog[key]) return;
    state.seriesPickerOpen = true;
    state.seriesPickerKey = key;
    state.seriesPickerSeason = parseInt(Object.keys(seriesCatalog[key].seasons)[0]) || 1;
    state.seriesPickerEpisode = null;
    renderHUD();
    checkSeriesSeasonLoaded(key, state.seriesPickerSeason);
    return;
  }
  /* ---- Series Picker : fermer popup ---- */
  if(action === 'netflix:series:close'){
    state.seriesPickerOpen = false;
    state.seriesPickerKey = null;
    state.seriesPickerEpisode = null;
    renderHUD();
    return;
  }
  /* ---- Series Picker : changer saison ---- */
  if(action.startsWith('netflix:series:season:')){
    const parts = action.split(':');
    const key = parts[3];
    const sn = parseInt(parts[4]);
    if(!seriesCatalog[key] || !seriesCatalog[key].seasons[sn]) return;
    state.seriesPickerSeason = sn;
    state.seriesPickerEpisode = null;
    renderHUD();
    checkSeriesSeasonLoaded(key, sn);
    return;
  }
  /* ---- Series Picker : lancer épisode ---- */
  if(action.startsWith('netflix:series:play:')){
    const parts = action.split(':');
    const key = parts[3];
    const sn = parseInt(parts[4]);
    const ep = parseInt(parts[5]);
    const a = seriesCatalog[key];
    if(!a) return;
    const dbKey = `series-${key}-s${sn}e${ep}`;
    const epName = `${a.name} S${sn} E${ep}`;

    seriesLoadBlob(dbKey).then(blob=>{
      if(blob){
        const url = URL.createObjectURL(blob);
        const media = { id:dbKey, name:epName, kind:'video', url, type:'cinema' };
        state.seriesPickerOpen = false;
        showFlatScreen(media);
        state.panel = 'dock';
        state.activeApp = null;
        state.appMaximized = false;
        renderHUD();
        toast(`📺 ${epName} — Mode Cinéma`);
      } else {
        toast(`🎬 Aucun fichier trouvé. Cliquez sur "Importer un fichier".`);
      }
    });
    return;
  }
  /* ---- Series Picker : import fichier ---- */
  if(action.startsWith('netflix:series:import:')){
    const parts = action.split(':');
    const key = parts[3];
    const sn = parseInt(parts[4]);
    const ep = parseInt(parts[5]);
    const a = seriesCatalog[key];
    if(!a) return;
    const dbKey = `series-${key}-s${sn}e${ep}`;
    const epName = `${a.name} S${sn} E${ep}`;
    state.seriesPickerPendingKey = dbKey;
    state.seriesPickerPendingName = epName;
    toast(`📁 Touchez l'écran pour importer ${epName}`);
    const handler = ()=>{
      document.removeEventListener('click', handler);
      const sfi = document.getElementById('seriesFileInput');
      if(sfi){ sfi.setAttribute('data-key', dbKey); sfi.click(); }
    };
    document.addEventListener('click', handler);
    return;
  }

  /* ---- Anime Hub : ouvrir popup ---- */
  if(action.startsWith('netflix:anime:open:')){
    const key = action.split(':')[3];
    if(!animeCatalog[key]) return;
    state.animePopupOpen = true;
    state.animePopupKey = key;
    state.animePopupSeason = 1;
    state.animePopupEpisode = null;
    renderHUD();
    return;
  }
  /* ---- Anime Hub : fermer popup ---- */
  if(action === 'netflix:anime:close'){
    state.animePopupOpen = false;
    state.animePopupKey = null;
    state.animePopupEpisode = null;
    renderHUD();
    return;
  }
  /* ---- Anime Hub : changer saison ---- */
  if(action.startsWith('netflix:anime:season:')){
    const parts = action.split(':');
    const key = parts[3];
    const sn = parseInt(parts[4]);
    if(!animeCatalog[key] || !animeCatalog[key].seasons[sn]) return;
    state.animePopupSeason = sn;
    state.animePopupEpisode = null;
    renderHUD();
    return;
  }
  /* ---- Anime Hub : sélectionner épisode ---- */
  if(action.startsWith('netflix:anime:episode:')){
    const parts = action.split(':');
    const ep = parseInt(parts[5]);
    state.animePopupEpisode = ep;
    renderHUD();
    return;
  }
  /* ---- Anime Hub : vérifier bibliothèque & lancer ---- */
  if(action.startsWith('netflix:anime:play:')){
    const parts = action.split(':');
    const key = parts[3];
    const sn = parseInt(parts[4]);
    const ep = parseInt(parts[5]);
    const a = animeCatalog[key];
    if(!a) return;
    const dbKey = `anime-${key}-s${sn}e${ep}`;
    const epName = `${a.name} S${sn} E${ep}`;

    animeLoadBlob(dbKey).then(blob=>{
      if(blob){
        const url = URL.createObjectURL(blob);
        const media = { id:dbKey, name:epName, kind:'video', url, type:'cinema' };
        state.animePopupOpen = false;
        showFlatScreen(media);
        state.panel = 'dock';
        state.activeApp = null;
        state.appMaximized = false;
        renderHUD();
        toast(`📺 ${epName} — Mode Cinéma`);
      } else {
        toast(`🎬 Aucun fichier trouvé. Choisissez "Choisir un fichier sur mon téléphone".`);
      }
    });
    return;
  }
  /* ---- Anime Hub : import fichier téléphone ---- */
  if(action.startsWith('netflix:anime:import:')){
    const parts = action.split(':');
    const key = parts[3];
    const sn = parseInt(parts[4]);
    const ep = parseInt(parts[5]);
    const a = animeCatalog[key];
    if(!a) return;
    const dbKey = `anime-${key}-s${sn}e${ep}`;
    const epName = `${a.name} S${sn} E${ep}`;
    state.animePendingKey = dbKey;
    state.animePendingName = epName;
    toast(`📁 Touchez l'écran pour importer ${epName}`);
    const handler = ()=>{
      document.removeEventListener('click', handler);
      const afi = document.getElementById('animeFileInput');
      if(afi){ afi.setAttribute('data-key', dbKey); afi.click(); }
    };
    document.addEventListener('click', handler);
    return;
  }

  /* ---- Creator Netflix : ouvrir menu ---- */
  if(action==='netflix:creator:menu' || action==='netflix:anime:creator:menu'){
    state.netflixCreatorOpen = true;
    state.netflixCreatorType = null;
    state.netflixCreatorForm = { name:'', story:'', seasons:1, episodesPerSeason:12, coverDataUrl:'' };
    renderHUD();
    return;
  }
  /* ---- Creator Netflix : fermer menu ---- */
  if(action==='netflix:creator:close' || action==='netflix:anime:creator:close'){
    state.netflixCreatorOpen = false;
    renderHUD();
    return;
  }
  /* ---- Creator Netflix : choisir type ---- */
  if(action==='netflix:creator:type:series' || action==='netflix:anime:creator:type:series'){
    state.netflixCreatorType = 'series';
    renderHUD();
    return;
  }
  if(action==='netflix:creator:type:movie' || action==='netflix:anime:creator:type:movie'){
    state.netflixCreatorType = 'movie';
    renderHUD();
    return;
  }
  /* ---- Creator Netflix : cover image ---- */
  if(action==='netflix:creator:cover' || action==='netflix:anime:creator:cover'){
    toast('📁 Touchez l\'écran pour choisir une image de couverture');
    const handler = ()=>{
      document.removeEventListener('click', handler);
      const ci = document.getElementById('creatorCoverInput');
      if(ci) ci.click();
    };
    document.addEventListener('click', handler);
    return;
  }
  /* ---- Creator Netflix : éditer champ texte ---- */
  if(action==='netflix:creator:edit:name' || action==='netflix:anime:creator:edit:name'){
    openVKB('name', state.netflixCreatorForm.name, t=>{ state.netflixCreatorForm.name = t; });
    return;
  }
  if(action==='netflix:creator:edit:story' || action==='netflix:anime:creator:edit:story'){
    openVKB('story', state.netflixCreatorForm.story, t=>{ state.netflixCreatorForm.story = t; });
    return;
  }
  /* ---- Creator Netflix : sauvegarder ---- */
  if(action==='netflix:creator:save' || action==='netflix:anime:creator:save'){
    const f = state.netflixCreatorForm;
    if(!f.name.trim()) return;
    const emojis = ['🎬','📺','🌟','🔥','💫','🎭','🎪','🎯','🏆','💎'];
    const id = Date.now();
    const uc = {
      id, type:state.netflixCreatorType || 'movie',
      name:f.name.trim(), story:f.story.trim(),
      seasons:f.seasons, episodesPerSeason:f.episodesPerSeason,
      coverDataUrl:f.coverDataUrl, createdAt:Date.now()
    };
    state.userContent = [uc, ...state.userContent];
    saveUserContent();
    state.netflixCreatorOpen = false;
    toast(`✅ "${uc.name}" créé${uc.type==='series'?'e':''} avec succès !`);
    renderHUD();
    return;
  }
  /* ---- Creator Netflix : jouer du contenu utilisateur ---- */
  if(action.startsWith('netflix:user:play:') || action.startsWith('netflix:anime:user:play:')){
    const parts = action.split(':');
    const isAnime = parts[1]==='anime';
    const idx = isAnime ? 4 : 3;
    const ucId = parseInt(parts[idx]);
    const uc = state.userContent.find(c=>c.id===ucId);
    if(!uc) return;
    toast(`📁 Touchez l'écran pour importer "${uc.name}"`);
    const handler = ()=>{
      document.removeEventListener('click', handler);
      const ufi = document.getElementById('userContentFileInput');
      if(ufi){ ufi.setAttribute('data-ucid', ucId); ufi.click(); }
    };
    document.addEventListener('click', handler);
    return;
  }
}

/* Netflix file input — sauvegarde dans IndexedDB */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'netflixFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  toast('💾 Sauvegarde de Super 8 en cours…');
  await nfSaveBlob(f);                        // stocker le Blob réel (pas l'URL)
  state.netflixHasVideo = true;
  const url = URL.createObjectURL(f);
  const media = { id:'netflix-super8', name:'Super 8', kind:'video', url, type:'cinema' };
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast('📺 Super 8 — Mode Cinéma (sauvegardé)');
});

/* Stranger Things file input — sauvegarde dans IndexedDB ST */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'stFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const key = e.target.getAttribute('data-key') || state.stPendingKey || 's1e1';
  const epName = state.stPendingName || `Stranger Things ${key}`;
  toast(`💾 Sauvegarde de ${epName} en cours…`);
  await stSaveBlob(f, key);
  state.stLoadedKeys[key] = true;
  const url = URL.createObjectURL(f);
  const media = { id:`st-${key}`, name:epName, kind:'video', url, type:'cinema' };
  state.stPickerOpen = false;
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 ${epName} — Mode Cinéma (sauvegardé)`);
});

/* Series file input — sauvegarde dans IndexedDB Series */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'seriesFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const key = e.target.getAttribute('data-key') || state.seriesPickerPendingKey || 'series-unknown';
  const epName = state.seriesPickerPendingName || `Series ${key}`;
  toast(`💾 Sauvegarde de ${epName} en cours…`);
  await seriesSaveBlob(f, key);
  state.seriesLoadedKeys[key] = true;
  const url = URL.createObjectURL(f);
  const media = { id:key, name:epName, kind:'video', url, type:'cinema' };
  state.seriesPickerOpen = false;
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 ${epName} — Mode Cinéma (sauvegardé)`);
});

/* Anime Hub file input — sauvegarde dans IndexedDB Anime */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'animeFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const key = e.target.getAttribute('data-key') || state.animePendingKey || 'anime-unknown';
  const epName = state.animePendingName || `Anime ${key}`;
  toast(`💾 Sauvegarde de ${epName} en cours…`);
  await animeSaveBlob(f, key);
  const url = URL.createObjectURL(f);
  const media = { id:key, name:epName, kind:'video', url, type:'cinema' };
  state.animePopupOpen = false;
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 ${epName} — Mode Cinéma (sauvegardé)`);
});

/* Creator Netflix — cover image upload */
document.addEventListener('change', (e)=>{
  if(e.target.id !== 'creatorCoverInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  fileToResizedDataURL(f).then(dataUrl=>{
    state.netflixCreatorForm.coverDataUrl = dataUrl;
    renderHUD();
  });
});

/* Creator Netflix — user content play */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'userContentFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const ucId = parseInt(e.target.getAttribute('data-ucid') || '0');
  const uc = state.userContent.find(c=>c.id===ucId);
  if(!uc){ toast('❌ Contenu introuvable'); return; }
  const url = URL.createObjectURL(f);
  const media = { id:'user-'+ucId, name:uc.name, kind:'video', url, type:'cinema' };
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 "${uc.name}" — Mode Cinéma`);
});

/* Disney+ — video import */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'disneyFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const key = e.target.getAttribute('data-key') || state.disneyPendingKey || 'disney-unknown';
  const name = e.target.getAttribute('data-name') || state.disneyPendingName || 'Disney+';
  toast(`💾 Sauvegarde de ${name} en cours…`);
  await disneySaveBlob(f, key);
  const url = URL.createObjectURL(f);
  const media = { id:key, name, kind:'video', url, type:'cinema' };
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 ${name} — Mode Cinéma (sauvegardé)`);
});

/* Disney+ — user content play */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'disneyUserContentFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const ucId = parseInt(e.target.getAttribute('data-ucid') || '0');
  const uc = state.disneyUserContent.find(c=>c.id===ucId);
  if(!uc){ toast('❌ Contenu introuvable'); return; }
  const url = URL.createObjectURL(f);
  const media = { id:'disney-user-'+ucId, name:uc.name, kind:'video', url, type:'cinema' };
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 "${uc.name}" — Mode Cinéma`);
});

/* Disney+ — cover image */
document.addEventListener('change', (e)=>{
  if(e.target.id !== 'disneyCoverInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  fileToResizedDataURL(files[0]).then(dataUrl=>{ state.disneyCreatorForm.coverDataUrl = dataUrl; renderHUD(); });
});

/* Apple TV — video import */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'atvFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const key = e.target.getAttribute('data-key') || state.atvPendingKey || 'atv-unknown';
  const name = e.target.getAttribute('data-name') || state.atvPendingName || 'Apple TV';
  toast(`💾 Sauvegarde de ${name} en cours…`);
  await atvSaveBlob(f, key);
  const url = URL.createObjectURL(f);
  const media = { id:key, name, kind:'video', url, type:'cinema' };
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 ${name} — Mode Cinéma (sauvegardé)`);
});

/* Apple TV — user content play */
document.addEventListener('change', async (e)=>{
  if(e.target.id !== 'atvUserContentFileInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const f = files[0];
  const ucId = parseInt(e.target.getAttribute('data-ucid') || '0');
  const uc = state.atvUserContent.find(c=>c.id===ucId);
  if(!uc){ toast('❌ Contenu introuvable'); return; }
  const url = URL.createObjectURL(f);
  const media = { id:'atv-user-'+ucId, name:uc.name, kind:'video', url, type:'cinema' };
  showFlatScreen(media);
  state.panel = 'dock';
  state.activeApp = null;
  state.appMaximized = false;
  renderHUD();
  toast(`📺 "${uc.name}" — Mode Cinéma`);
});

/* Apple TV — cover image */
document.addEventListener('change', (e)=>{
  if(e.target.id !== 'atvCoverInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  fileToResizedDataURL(files[0]).then(dataUrl=>{ state.atvCreatorForm.coverDataUrl = dataUrl; renderHUD(); });
});

/* === Game Launcher — edit game icon === */
document.addEventListener('change', (e)=>{
  if(e.target.id !== 'glGameIconInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const gameId = e.target.getAttribute('data-gameid');
  if(!gameId) return;
  fileToResizedDataURL(files[0], 256, 0.75).then(dataUrl=>{
    if(!state.glGameIcons) state.glGameIcons = {};
    state.glGameIcons[gameId] = dataUrl;
    try{ localStorage.setItem('horizonGLGameIcons', JSON.stringify(state.glGameIcons)); }catch(_){ toast('⚠️ Stockage plein — supprime de vieilles pochettes'); }
    toast('🎮 Icône mise à jour !');
    renderHUD();
  });
});

/* === Netflix — edit card cover === */
document.addEventListener('change', (e)=>{
  if(e.target.id !== 'nfCardCoverInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const cardId = e.target.getAttribute('data-cardid');
  if(!cardId) return;
  fileToResizedDataURL(files[0]).then(dataUrl=>{
    if(!state.nfCardCovers) state.nfCardCovers = {};
    state.nfCardCovers[cardId] = dataUrl;
    try{ localStorage.setItem('horizonNFCardCovers', JSON.stringify(state.nfCardCovers)); }catch(_){ toast('⚠️ Stockage plein — supprime de vieilles pochettes'); }
    toast('🎬 Couverture mise à jour !');
    renderHUD();
  });
});

/* === Disney+ — edit card cover === */
document.addEventListener('change', (e)=>{
  if(e.target.id !== 'disneyCardCoverInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const cardId = e.target.getAttribute('data-cardid');
  if(!cardId) return;
  fileToResizedDataURL(files[0]).then(dataUrl=>{
    if(!state.disneyCardCovers) state.disneyCardCovers = {};
    state.disneyCardCovers[cardId] = dataUrl;
    try{ localStorage.setItem('horizonDisneyCardCovers', JSON.stringify(state.disneyCardCovers)); }catch(_){ toast('⚠️ Stockage plein — supprime de vieilles pochettes'); }
    toast('🎬 Couverture mise à jour !');
    renderHUD();
  });
});

/* === Apple TV — edit card cover === */
document.addEventListener('change', (e)=>{
  if(e.target.id !== 'atvCardCoverInput') return;
  const files = Array.from(e.target.files||[]);
  if(!files.length) return;
  const cardId = e.target.getAttribute('data-cardid');
  if(!cardId) return;
  fileToResizedDataURL(files[0]).then(dataUrl=>{
    if(!state.atvCardCovers) state.atvCardCovers = {};
    state.atvCardCovers[cardId] = dataUrl;
    try{ localStorage.setItem('horizonATVCardCovers', JSON.stringify(state.atvCardCovers)); }catch(_){ toast('⚠️ Stockage plein — supprime de vieilles pochettes'); }
    toast('🎬 Couverture mise à jour !');
    renderHUD();
  });
});

/* ------------ Flat screen (Mode Écran) ------------ */
function setHUDVisible(visible){
  const v = visible ? '' : 'none';
  for(const id of ['hudWrapL','hudWrapR','railWrapL','railWrapR','appDockWrapL','appDockWrapR','appWindowWrapL','appWindowWrapR','launchpadWrapL','launchpadWrapR']){
    const el = $(id);
    if(el) el.style.display = v;
  }
}
function showFlatScreen(media){
  state.screenMedia = media;
  state.cinemaMode = true;
  state.showMenuInCinema = false;
  setHUDVisible(false);
  $('cinemaBar').style.display = 'flex';
  for(const side of ['L','R']){
    const el = document.getElementById('flatScreen'+side);
    if(!el) continue;
    const w = parseFloat(document.getElementById('rngScreenWidth').value);
    const h = parseFloat(document.getElementById('rngScreenHeight').value);
    el.setAttribute('geometry', {primitive:'plane', width:w, height:h});
    if(media.kind==='video'){
      let v = document.getElementById('userVid');
      if(!v){
        v = document.createElement('video');
        v.id = 'userVid';
        v.setAttribute('playsinline','');
        v.setAttribute('webkit-playsinline','');
        v.loop = true;
        v.muted = false;
        document.body.appendChild(v);
      }
      v.muted = false;
      v.src = media.url;
      v.load();
      v.play().catch(()=>{});
      el.setAttribute('material', {src:'#userVid', side:'double'});
    } else {
      el.setAttribute('material', {src:media.url, side:'double'});
    }
    el.setAttribute('visible','true');
  }
  renderHUD();
  toast('📺 Mode Écran : '+media.name);
}
function hideFlatScreen(){
  state.cinemaMode = false;
  state.showMenuInCinema = false;
  setHUDVisible(true);
  $('cinemaBar').style.display = 'none';
  for(const side of ['L','R']){
    const el = document.getElementById('flatScreen'+side);
    if(el) el.setAttribute('visible','false');
  }
  const v = document.getElementById('userVid');
  if(v){ v.pause(); v.src=''; v.load(); }
  state.screenMedia = null;
  renderHUD();
}
function positionFlatScreen(){
  const yaw = state.initYaw || 0;
  const pitch = state.initPitch || 0;
  const dist = parseFloat(document.getElementById('rngScreenDistance').value);
  const baseY = 1.8 + Math.sin(pitch) * dist;
  const baseZ = -Math.cos(pitch) * dist;
  const pos = new THREE.Vector3(0, baseY, baseZ);
  pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const s = pos.x+' '+pos.y+' '+pos.z;
  const pitchDeg = THREE.MathUtils.radToDeg(pitch);
  const rot = pitchDeg+' '+THREE.MathUtils.radToDeg(yaw)+' 0';
  for(const id of ['flatScreenL','flatScreenR']){
    const el = document.getElementById(id);
    if(el){ el.setAttribute('position',s); el.setAttribute('rotation',rot); }
  }
}
/* ------------ Touch bar pour réafficher le menu en mode cinéma ------------ */
$('cinemaBar').addEventListener('click', ()=>{
  if(!state.cinemaMode) return;
  const v = document.getElementById('userVid');
  if(v && !v.paused){
    v.pause();
    state.showMenuInCinema = true;
    $('cinemaBar').style.display = 'none';
    state.panel = 'dock';
    renderHUD();
    toast('👆 Menu réaffiché');
  }
});

/* ------------ World-lock (cache DOM refs) ------------ */
const centerEls = {L:{}, R:{}};
(function initCenters(){
  for(const s of ['L','R']){
    centerEls[s] = {
      hc:$('hudCenter'+s), rc:$('railCenter'+s), ac:$('appDockCenter'+s),
      wc:$('appWindowCenter'+s), lc:$('launchpadCenter'+s),
      xc:$('hideCrossCenter'+s), cc:$('cinemaCtrlCenter'+s)
    };
  }
})();

let _ew = window.innerWidth/2, _eh = window.innerHeight;
window.addEventListener('resize', ()=>{
  _ew = window.innerWidth/2; _eh = window.innerHeight;
});

function worldToScreen(worldPos, o3d){
  const local = worldPos.clone();
  o3d.worldToLocal(local);
  const z = -local.z;
  if(z > 0.01){
    const fov = THREE.MathUtils.degToRad(75);
    const tanH = Math.tan(fov/2);
    const aspect = _ew/_eh;
    return {
      px: _ew/2 + local.x/(z*tanH*aspect)*(_ew/2),
      py: _eh/2 - local.y/(z*tanH)*(_eh/2)
    };
  }
  return null;
}

function applyScreenPos(els, px, py){
  for(const e of els){
    if(e){ e.style.left=px+'px'; e.style.top=py+'px'; }
  }
}
function applyCenter(els){
  for(const e of els){
    if(e){ e.style.left='50%'; e.style.top='50%'; }
  }
}

/* ── Position figée des onglets HUD ─────────────────────────
   Une fois locked=true (ou après recalibrage), la position
   des centres HUD ne bouge PLUS du tout côté JS.
   Seul un recalibrage explicite (bouton) peut la modifier.
   ────────────────────────────────────────────────────────── */
let _hudFrozenPx = null, _hudFrozenPy = null;
let _prevLocked = null; // pour détecter le changement d'état

/* Appeler cette fonction pour forcer le gel aux coordonnées actuelles */
function freezeHUDNow(){
  const o3d = camL.object3D;
  if(!o3d) return;
  const yaw   = state.initYaw;
  const pitch = state.initPitch || 0;
  const dist3 = 3;
  const mainY = Math.sin(pitch) * dist3;
  const mainZ = -Math.cos(pitch) * dist3;
  const mainPos = new THREE.Vector3(0, mainY, mainZ);
  if(yaw !== null) mainPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const mainScreen = worldToScreen(mainPos, o3d);
  if(mainScreen){
    _hudFrozenPx = mainScreen.px;
    _hudFrozenPy = mainScreen.py;
    for(const s of ['L','R']){
      const e = centerEls[s];
      applyScreenPos([e.hc, e.rc, e.ac, e.wc, e.lc], _hudFrozenPx, _hudFrozenPy);
    }
  } else {
    _hudFrozenPx = null; _hudFrozenPy = null;
    for(const s of ['L','R']){
      const e = centerEls[s];
      applyCenter([e.hc, e.rc, e.ac, e.wc, e.lc]);
    }
  }
}
/* Exposer pour que le bouton de recalibrage puisse l'appeler */
window.freezeHUDNow = freezeHUDNow;

function tickCam(){
  const o3d = camL.object3D;
  if(!o3d){ requestAnimationFrame(tickCam); return; }

  camR.object3D.rotation.copy(o3d.rotation);

  const yaw = state.initYaw;
  const pitch = state.initPitch || 0;

  /* ── Gestion des onglets HUD ── */
  if(!state.locked){
    /* Mode libre : on suit la tête en temps réel */
    const dist3 = 3;
    const mainY = Math.sin(pitch) * dist3;
    const mainZ = -Math.cos(pitch) * dist3;
    const mainPos = new THREE.Vector3(0, mainY, mainZ);
    if(yaw !== null) mainPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const mainScreen = worldToScreen(mainPos, o3d);
    if(mainScreen){
      for(const s of ['L','R']){
        const e = centerEls[s];
        applyScreenPos([e.hc, e.rc, e.ac, e.wc, e.lc], mainScreen.px, mainScreen.py);
      }
    }
    _prevLocked = false;
  } else {
    /* Mode figé : on gèle la position UNE SEULE FOIS au moment du verrouillage */
    if(_prevLocked !== true){
      /* Transition vers locked → capturer la position actuelle */
      freezeHUDNow();
      _prevLocked = true;
    }
    /* Ne toucher à rien d'autre — les centres ne bougent plus */
  }

  const crossPitchY = Math.sin(pitch) * 2.5 + 0.3;
  const crossPitchZ = -Math.cos(pitch) * 2.5;
  const crossPos = new THREE.Vector3(0, crossPitchY, crossPitchZ);
  if(yaw !== null) crossPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const crossScreen = worldToScreen(crossPos, o3d);
  if(crossScreen && state.menuHidden){
    for(const s of ['L','R']){
      if(centerEls[s].xc) applyScreenPos([centerEls[s].xc], crossScreen.px, crossScreen.py);
    }
  } else {
    for(const s of ['L','R']){
      if(centerEls[s].xc) applyCenter([centerEls[s].xc]);
    }
  }

  if(state.cinemaMode){
    const dist = parseFloat($('rngScreenDistance')?.value) || 3.5;
    const ctrlPos = new THREE.Vector3(0, 0.5, -dist);
    if(yaw !== null) ctrlPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const ctrlScreen = worldToScreen(ctrlPos, o3d);
    if(ctrlScreen){
      for(const s of ['L','R']){
        if(centerEls[s].cc) applyScreenPos([centerEls[s].cc], ctrlScreen.px, ctrlScreen.py);
      }
    }
    const v = $('userVid');
    if(v && v.duration){
      if(state.scrubMode && o3d){
        /* Calcul de la position scrub via la rotation de la tête */
        const currentYaw = o3d.rotation.y;
        if(state.scrubYawStart === null) state.scrubYawStart = currentYaw;
        /* 60° de rotation = toute la durée de la vidéo */
        const YAW_RANGE = Math.PI / 3;
        const delta = (currentYaw - state.scrubYawStart) / YAW_RANGE;
        const newPct = Math.max(0, Math.min(1, state.scrubPctStart + delta));
        const pctDisp = (newPct * 100).toFixed(1);
        document.querySelectorAll('.progress-fill').forEach(f => f.style.width = pctDisp + '%');
        document.querySelectorAll('.progress-thumb').forEach(t => t.style.left = pctDisp + '%');
        /* Afficher le temps dans une petite bulle */
        const sec = Math.floor(newPct * v.duration);
        const mm = String(Math.floor(sec/60)).padStart(2,'0');
        const ss = String(sec%60).padStart(2,'0');
        document.querySelectorAll('.scrub-time-label').forEach(l => l.textContent = mm+':'+ss);
        if(!document.querySelector('.scrub-time-label')){
          document.querySelectorAll('.progress-thumb').forEach(t => {
            const lbl = document.createElement('div');
            lbl.className = 'scrub-time-label';
            lbl.textContent = mm+':'+ss;
            t.appendChild(lbl);
          });
        }
        /* Stocker la pct courante pour la confirmation gaze */
        state._scrubCurrentPct = newPct;
      } else {
        const pct = (v.currentTime / v.duration * 100);
        document.querySelectorAll('.progress-fill').forEach(f => f.style.width = pct + '%');
        document.querySelectorAll('.progress-thumb').forEach(t => t.style.left = pct + '%');
      }
    }
  } else {
    for(const s of ['L','R']){
      if(centerEls[s].cc) applyCenter([centerEls[s].cc]);
    }
  }

  requestAnimationFrame(tickCam);
}

