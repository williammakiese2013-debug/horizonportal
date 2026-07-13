/* ============================================================
   APPLE MUSIC — Logic & Actions
   ============================================================ */
let _amAudio = null; // singleton audio element

function _getAmAudio(){
  if(!_amAudio){
    _amAudio = document.getElementById('amAudioEl');
    if(!_amAudio){
      _amAudio = document.createElement('audio');
      _amAudio.id = 'amAudioEl';
      _amAudio.setAttribute('playsinline','');
      _amAudio.setAttribute('webkit-playsinline','');
      _amAudio.preload = 'auto';
      document.body.appendChild(_amAudio);
    }
  }
  return _amAudio;
}

/* ============================================================
   FOND "TABLETTE POSÉE SUR UN BUREAU" — mode tablette
   ============================================================
   Pas de photo à disposition ici : on dessine donc à la volée (canvas 2D)
   une pièce simple et stylisée — mur, sol, bureau en bois au premier plan
   — projetée en équirectangulaire, et on la pose comme fond (a-sky) UNIQUEMENT
   pendant qu'un jeu custom en mode tablette est ouvert. Le fond normal
   (photo de paysage) est restauré automatiquement à la fermeture.
   ============================================================ */
let _tabletRoomDataUrl = null;
let _tabletRoomActive = false;

function _buildTabletRoomSkyDataUrl(){
  if(_tabletRoomDataUrl) return _tabletRoomDataUrl;
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Mur (haut de l'image = ce qu'on voit en regardant devant/au-dessus)
  const wallGrad = ctx.createLinearGradient(0, 0, 0, H*0.62);
  wallGrad.addColorStop(0, '#2b3140');
  wallGrad.addColorStop(1, '#3a4356');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, W, H*0.62);

  // Fenêtre douce sur le mur (lumière ambiante d'une chambre le soir)
  for(let i=0;i<2;i++){
    const wx = W*0.28 + i*W*0.44;
    const wg = ctx.createLinearGradient(0, H*0.14, 0, H*0.5);
    wg.addColorStop(0, 'rgba(120,150,190,0.55)');
    wg.addColorStop(1, 'rgba(70,90,120,0.25)');
    ctx.fillStyle = wg;
    ctx.fillRect(wx, H*0.14, W*0.1, H*0.36);
    ctx.strokeStyle = 'rgba(20,22,28,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(wx, H*0.14, W*0.1, H*0.36);
  }

  // Sol
  const floorGrad = ctx.createLinearGradient(0, H*0.62, 0, H);
  floorGrad.addColorStop(0, '#4a3a2c');
  floorGrad.addColorStop(1, '#2a2119');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, H*0.62, W, H*0.38);

  // Bureau en bois (premier plan, juste devant/en dessous — là où la
  // "tablette" de la fenêtre de jeu vient visuellement se poser)
  const deskY = H*0.66;
  const deskGrad = ctx.createLinearGradient(0, deskY, 0, deskY + H*0.16);
  deskGrad.addColorStop(0, '#8a5a34');
  deskGrad.addColorStop(1, '#5c3a20');
  ctx.fillStyle = deskGrad;
  ctx.fillRect(W*0.18, deskY, W*0.64, H*0.16);
  // pieds du bureau
  ctx.fillStyle = '#3a2414';
  ctx.fillRect(W*0.2, deskY + H*0.16, W*0.03, H*0.16);
  ctx.fillRect(W*0.76, deskY + H*0.16, W*0.03, H*0.16);
  // liseré clair sur le bord du bureau (effet chanfrein)
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(W*0.18, deskY, W*0.64, H*0.012);

  // Petit clavier posé sur le bureau (silhouette simple, décorative —
  // les vraies touches interactives restent celles de l'interface, par
  // dessus, en 2D)
  const kbX = W*0.30, kbY = deskY + H*0.02, kbW = W*0.24, kbH = H*0.05;
  ctx.fillStyle = '#1c1e22';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(kbX, kbY, kbW, kbH, 10) : ctx.rect(kbX, kbY, kbW, kbH);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const cols = 10, rows = 3;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      ctx.fillRect(
        kbX + kbW*0.05 + c*(kbW*0.09), kbY + kbH*0.15 + r*(kbH*0.28),
        kbW*0.07, kbH*0.18
      );
    }
  }

  // Vignettage doux pour un rendu plus "pièce" que "texture plate"
  const vg = ctx.createRadialGradient(W/2, H*0.5, H*0.2, W/2, H*0.5, W*0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  _tabletRoomDataUrl = cv.toDataURL('image/jpeg', 0.85);
  return _tabletRoomDataUrl;
}

function setTabletRoomSky(active){
  if(active === _tabletRoomActive) return;
  _tabletRoomActive = active;
  const skyL = document.getElementById('skyL');
  const skyR = document.getElementById('skyR');
  if(!skyL || !skyR) return;
  if(active){
    const url = _buildTabletRoomSkyDataUrl();
    skyL.setAttribute('src', url);
    skyR.setAttribute('src', url);
  } else {
    skyL.setAttribute('src', '#sky-img');
    skyR.setAttribute('src', '#sky-img');
  }
}

function amSaveLibrary(){
  try{
    const safe = state.amTracks.map(t=>({...t, audioUrl:''})); // don't store blobs in LS
    localStorage.setItem('amTracks', JSON.stringify(safe));
    localStorage.setItem('amPlaylists', JSON.stringify(state.amPlaylists));
  }catch(_){}
}
function amLoadLibrary(){
  try{
    const t = localStorage.getItem('amTracks');
    if(t) state.amTracks = JSON.parse(t);
    const p = localStorage.getItem('amPlaylists');
    if(p) state.amPlaylists = JSON.parse(p);
  }catch(_){}
}
amLoadLibrary();

function amPlay(track){
  if(!track) return;
  const audio = _getAmAudio();
  audio.pause();
  if(audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
  audio.volume = state.amVolume||0.8;
  if(track.audioBlob){
    audio.src = URL.createObjectURL(track.audioBlob);
  } else if(track.audioUrl){
    audio.src = track.audioUrl;
  } else {
    toast('🎵 Aucun fichier audio pour ce morceau');
    state.amPlaying = false;
    renderHUD();
    return;
  }
  audio.load();
  audio.play().catch(err=>{ toast('⚠️ Lecture bloquée — retouchez l\'écran'); console.warn(err); });
  state.amCurrentTrack = track;
  state.amPlaying = true;
  state.amProgress = 0;
  _amAudio = audio;
  audio.ontimeupdate = ()=>{
    state.amProgress = audio.currentTime;
    state.amDuration = audio.duration||0;
    renderHUD();
  };
  audio.onended = ()=>{
    if(state.amRepeat){ audio.currentTime=0; audio.play(); return; }
    amNext();
  };
  renderHUD();
  state.amMiniPlayer = true;
}
function amPause(){
  _getAmAudio().pause();
  state.amPlaying = false;
  renderHUD();
}
function amToggle(){
  const audio = _getAmAudio();
  if(state.amPlaying){ amPause(); }
  else {
    if(state.amCurrentTrack){
      audio.play().catch(err=>{ toast('⚠️ Retouchez l\'écran pour lire'); });
      state.amPlaying = true;
      renderHUD();
    } else if(state.amTracks.length){ amPlay(state.amTracks[0]); }
    else { toast('🎵 Ajoutez d\'abord une musique'); }
  }
}
function amNext(){
  const tracks = state.amTracks;
  if(!tracks.length) return;
  const idx = state.amCurrentTrack ? tracks.findIndex(t=>t.id===state.amCurrentTrack.id) : -1;
  if(state.amShuffle){
    amPlay(tracks[Math.floor(Math.random()*tracks.length)]);
  } else {
    amPlay(tracks[(idx+1)%tracks.length]);
  }
}
function amPrev(){
  const tracks = state.amTracks;
  if(!tracks.length) return;
  const idx = state.amCurrentTrack ? tracks.findIndex(t=>t.id===state.amCurrentTrack.id) : 0;
  amPlay(tracks[(idx-1+tracks.length)%tracks.length]);
}

function handleAppleMusicAction(action){
  // Tab navigation
  if(action.startsWith('am:tab:')){
    state.amTab = action.slice(7);
    state.amOpenPlaylistId = null;
    renderHUD(); return;
  }
  if(action==='am:back'||action==='am:forward'){ renderHUD(); return; }

  // Playback
  if(action==='am:playpause'){ amToggle(); return; }
  if(action==='am:next'){ amNext(); return; }
  if(action==='am:prev'){ amPrev(); return; }
  if(action==='am:shuffle'){ state.amShuffle=!state.amShuffle; renderHUD(); return; }
  if(action==='am:repeat'){ state.amRepeat=!state.amRepeat; renderHUD(); return; }
  if(action==='am:love'){ if(state.amCurrentTrack) state.amCurrentTrack.loved=!state.amCurrentTrack.loved; renderHUD(); return; }
  if(action==='am:playAll'){ if(state.amTracks.length) amPlay(state.amTracks[0]); else toast('🎵 Bibliothèque vide'); return; }

  // Play specific track — triggers mp3 import if no audio
  if(action.startsWith('am:play:')){
    const id = action.slice(8);
    const track = state.amTracks.find(t=>t.id===id);
    if(!track){ toast('Morceau introuvable'); return; }
    if(!track.audioBlob && !track.audioUrl){
      // Demander le fichier MP3 via tap réel
      state.amPendingPlayTrackId = id;
      toast('🎵 Touchez l\'écran pour charger "' + track.name + '"');
      const handler = e=>{
        document.removeEventListener('click', handler);
        const pi = document.getElementById('amPlayFileInput');
        if(pi){ pi.setAttribute('data-trackid', id); window.NativeMediaFolder ? NativeMediaFolder.openFor(pi) : pi.click(); }
      };
      document.addEventListener('click', handler);
    } else {
      amPlay(track);
    }
    return;
  }

  // Track menu → add to playlist
  if(action.startsWith('am:trackMenu:')){
    const id=action.slice(13);
    state.amAddToPlaylistOpen=true;
    state.amAddToPlaylistTrackId=id;
    renderHUD(); return;
  }
  if(action==='am:cancelAddToPlaylist'){ state.amAddToPlaylistOpen=false; state.amAddToPlaylistTrackId=null; renderHUD(); return; }
  if(action.startsWith('am:addTrackToPlaylist:')){
    const plId=action.slice(22);
    const pl=state.amPlaylists.find(p=>p.id===plId);
    if(pl&&state.amAddToPlaylistTrackId){
      if(!pl.tracks.includes(state.amAddToPlaylistTrackId)) pl.tracks.push(state.amAddToPlaylistTrackId);
      amSaveLibrary();
      toast('✅ Ajouté à "'+pl.name+'"');
    }
    state.amAddToPlaylistOpen=false; state.amAddToPlaylistTrackId=null; renderHUD(); return;
  }

  // VKB pour les champs texte du modal
  if(action==='am:editTrackName'){
    openVKB('trackName', state.amNewTrackName||'', t=>{ state.amNewTrackName=t; renderHUD(); });
    return;
  }
  if(action==='am:editTrackArtist'){
    openVKB('trackArtist', state.amNewTrackArtist||'', t=>{ state.amNewTrackArtist=t; renderHUD(); });
    return;
  }
  if(action==='am:editPlaylistName'){
    openVKB('playlistName', state.amNewPlaylistName||'', t=>{ state.amNewPlaylistName=t; renderHUD(); });
    return;
  }

  // Add track
  if(action==='am:addTrack'){
    state.amAddTrackOpen=true; state.amNewTrackName=''; state.amNewTrackArtist='';
    state.amPendingAudioBlob=null; state.amPendingCoverDataUrl='';
    renderHUD(); return;
  }
  if(action==='am:cancelAddTrack'){ state.amAddTrackOpen=false; renderHUD(); return; }
  if(action==='am:pickCover'){
    toast('🖼 Touchez l\'écran pour choisir une image de couverture');
    const handler=()=>{
      document.removeEventListener('click', handler);
      const ci = document.getElementById('amCoverFileInput');
      if(ci){ window.NativeMediaFolder ? NativeMediaFolder.openFor(ci) : ci.click(); }
    };
    document.addEventListener('click', handler);
    return;
  }
  if(action==='am:pickMp3'){
    toast('🎵 Touchez l\'écran pour importer un fichier audio');
    const handler=()=>{
      document.removeEventListener('click', handler);
      const mi = document.getElementById('amMp3FileInput');
      if(mi){ window.NativeMediaFolder ? NativeMediaFolder.openFor(mi) : mi.click(); }
    };
    document.addEventListener('click', handler);
    return;
  }
  if(action==='am:confirmAddTrack'){
    const name=(state.amNewTrackName||'').trim()||'Morceau sans nom';
    const artist=(state.amNewTrackArtist||'').trim()||'Artiste inconnu';
    const id='am-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    const track={id,name,artist,coverDataUrl:state.amPendingCoverDataUrl||'',audioBlob:state.amPendingAudioBlob||null,audioUrl:''};
    state.amTracks.push(track);
    amSaveLibrary();
    state.amAddTrackOpen=false;
    toast('✅ "'+name+'" ajouté à la bibliothèque');
    renderHUD(); return;
  }

  // Playlist
  if(action==='am:createPlaylist'){
    state.amAddPlaylistOpen=true; state.amNewPlaylistName=''; state.amAddToPlaylistOpen=false;
    renderHUD(); return;
  }
  if(action==='am:cancelPlaylist'){ state.amAddPlaylistOpen=false; renderHUD(); return; }
  if(action==='am:confirmPlaylist'){
    const name=(state.amNewPlaylistName||'').trim()||'Nouvelle Playlist';
    const pl={id:'pl-'+Date.now(),name,tracks:[]};
    state.amPlaylists.push(pl);
    amSaveLibrary();
    state.amAddPlaylistOpen=false;
    toast('📋 Playlist "'+name+'" créée');
    renderHUD(); return;
  }
  if(action.startsWith('am:openPlaylist:')){
    state.amOpenPlaylistId=action.slice(16);
    state.amTab='playlists';
    renderHUD(); return;
  }
  if(action==='am:closePlDetail'){ state.amOpenPlaylistId=null; renderHUD(); return; }

  // Add track to playlist (from playlist detail)
  if(action.startsWith('am:addToPlaylist:pl:')){
    // open "add to playlist" UI showing track picker
    const plId=action.slice(20);
    // Show a simple prompt: pick tracks not yet in playlist
    const pl=state.amPlaylists.find(p=>p.id===plId);
    if(!pl){ renderHUD(); return; }
    const available=state.amTracks.filter(t=>!pl.tracks.includes(t.id));
    if(!available.length){ toast('Tous les morceaux sont déjà dans la playlist'); return; }
    // Add first available for simplicity; in real use show picker
    state.amAddToPlaylistOpen=true; state.amAddToPlaylistTrackId=available[0]?.id||null;
    renderHUD(); return;
  }

  // Minimize → mini player
  if(action==='am:minimize'){
    state.amMiniPlayer=true;
    state.activeApp=null;
    renderHUD();
    amRenderMiniPlayer();
    return;
  }
  // Mini player close
  if(action==='am:miniClose'){ state.amMiniPlayer=false; amRemoveMiniPlayer(); renderHUD(); return; }
  if(action==='am:miniOpen'){ state.amMiniPlayer=false; state.activeApp='applemusic'; renderHUD(); return; }
  if(action==='am:miniPlay'){ amToggle(); amRenderMiniPlayer(); return; }
}

function amRenderMiniPlayer(){
  let mp = document.getElementById('amMiniPlayerEl');
  if(!mp){
    mp = document.createElement('div');
    mp.id='amMiniPlayerEl'; mp.className='am-mini-player';
    document.getElementById('stage').appendChild(mp);
  }
  const cur = state.amCurrentTrack;
  const playing = state.amPlaying;
  const prog = state.amProgress||0, dur = state.amDuration||0;
  mp.innerHTML = `
    <div class="am-mini-cover" onclick="handleAction('am:miniOpen')">
      ${cur&&cur.coverDataUrl?`<img src="${cur.coverDataUrl}"/>`:'🎵'}
    </div>
    <div class="am-mini-info" onclick="handleAction('am:miniOpen')">
      <div class="am-mini-title">${cur?cur.name:'Aucune musique'}</div>
      <div class="am-mini-artist">${cur?(cur.artist||'Artiste inconnu'):'—'}</div>
      <div class="am-mini-prog"><div class="am-mini-prog-fill" style="width:${dur>0?Math.round(prog/dur*100):0}%"></div></div>
    </div>
    <div class="am-mini-controls">
      <div class="am-mini-ctrl" onclick="handleAction('am:prev')">⏮</div>
      <div class="am-mini-play" onclick="handleAction('am:miniPlay')">${playing?'⏸':'▶'}</div>
      <div class="am-mini-ctrl" onclick="handleAction('am:next')">⏭</div>
    </div>
    <div class="am-mini-close" onclick="handleAction('am:miniClose')">✕</div>
  `;
  if(!state.amMiniPlayer || (state.activeApp==='applemusic')) mp.style.display='none';
  else mp.style.display='flex';
}
function amRemoveMiniPlayer(){
  const mp=document.getElementById('amMiniPlayerEl');
  if(mp) mp.remove();
}

/* ------------ Profondeur UI réglable (calibration) ------------
   baseDepth/baseScale = valeurs de référence pour chaque élément.
   uiDepthExtra (px, réglable via le slider "Distance de l'interface")
   est ajouté à la profondeur, et l'échelle est recalculée pour que
   la taille apparente à l'écran reste identique (perspective:1000px). */
const UI_PERSPECTIVE = 1000;
function uiDepthTransform(baseDepth, baseScale, extraCss, extraDepth){
  const extra = (state.uiDepthExtra || 0) + (extraDepth || 0);
  const depth = baseDepth + extra;
  const scale = baseScale * (UI_PERSPECTIVE + baseDepth) / (UI_PERSPECTIVE + depth);
  return `${extraCss||''} translateZ(-${depth}px) scale(${scale.toFixed(4)})`;
}

function renderHUD(){
  let dockHTML;
  if(state.panel==='import-choice'){
    dockHTML = buildImportChoiceHTML();
  } else {
    dockHTML = state.panel==='dock' ? buildDockHTML() : buildGalleryHTML();
  }
  const railHTML = buildRailHTML();
  let appDockHTML;
  if(state.multiTaskPickerOpen){
    appDockHTML = buildMultitaskPickerHTML();
  } else {
    appDockHTML = buildAppDockHTML();
  }
  const appWindowHTML = state.activeApp ? buildAppWindowHTML() : '';
  const launchpadHTML = state.launchpadOpen ? buildLaunchpadHTML() : '';
  const hideCrossHTML = state.menuHidden ? buildHideCrossHTML() : '';
  const cinemaCtrlHTML = state.cinemaMode ? buildCinemaCtrlHTML() : '';

  const dockTransform      = uiDepthTransform(420, 0.69, 'translate(-50%,-50%)');
  const railTransform      = uiDepthTransform(420, 0.87, 'translate(-50%,-50%) translateX(-560px)');
  const appDockTransform   = uiDepthTransform(420, 0.78, 'translate(-50%,-50%) translateY(330px)');
  // Apply drag offset to appWindowTransform
  const dragOffX = state.dragGazeOffX || 0;
  const dragOffY = state.dragGazeOffY || 0;
  // Jeu custom en mode "tablette" : on considère ça comme une expérience
  // immersive (comme le mode cinéma) → on masque tout l'arrière-plan
  // (HUD, rail, dock du bas) et on ne garde que le fond (sky, "bureau")
  // + la fenêtre du jeu, posée plus bas et légèrement inclinée comme une
  // vraie tablette qu'on regarde de haut, posée devant soi.
  const isTabletCustomGame = !!(state.activeApp && state.activeApp.startsWith('customgame:') &&
    (state.customGames||[]).find(g => ('customgame:'+g.id) === state.activeApp)?.mode === 'tablet');
  setTabletRoomSky(isTabletCustomGame);

  // Sims 3 : écran géant immersif plein-champ (1280x720 → scale 1.55 @ Z -120px couvre les yeux)
  const appWindowTransform = (state.activeApp === 'sims3' && sims3State.open)
    ? uiDepthTransform(420, 0.66, 'translate(-50%,-50%)')
    : isTabletCustomGame
      ? uiDepthTransform(420, 0.8, `translate(-50%,-50%) translateY(${150+dragOffY}px) translateX(${dragOffX}px) rotateX(10deg)`)
    : state.appMaximized
      ? uiDepthTransform(420, 0.84, `translate(-50%,-50%) translateX(${dragOffX}px) translateY(${dragOffY}px)`)
      : uiDepthTransform(420, 0.78, `translate(-50%,-50%) translateX(${-640+dragOffX}px) translateY(${dragOffY}px)`);
  const launchpadTransform = uiDepthTransform(390, 0.72, 'translate(-50%,-50%)');
  const crossTransform     = uiDepthTransform(300, 0.83, 'translate(-50%,-50%)');
  const cinemaCtrlTransform= uiDepthTransform(180, 0.84, 'translate(-50%,-50%) translateY(130px)');

  const hideMain = (state.launchpadOpen && !state.activeApp) || (state.cinemaMode && !state.showMenuInCinema) || isTabletCustomGame ? 'none' : '';

  const mainWrapIds = ['hudWrap','railWrap','appDockWrap','appWindowWrap','launchpadWrap'];

  for(const side of ['L','R']){
    const hc = $('hudCenter'+side);
    const rc = $('railCenter'+side);
    const ac = $('appDockCenter'+side);
    const wc = $('appWindowCenter'+side);
    const lc = $('launchpadCenter'+side);
    const hw = $('hudWrap'+side);
    const rw = $('railWrap'+side);
    const aw = $('appDockWrap'+side);
    const ww = $('appWindowWrap'+side);
    const lw = $('launchpadWrap'+side);
    const xc = $('hideCrossCenter'+side);
    const xw = $('hideCrossWrap'+side);
    const cc = $('cinemaCtrlCenter'+side);
    const cw = $('cinemaCtrlWrap'+side);

    hc.innerHTML = dockHTML;
    rc.innerHTML = railHTML;
    ac.innerHTML = appDockHTML;
    if(wc){ wc.innerHTML = appWindowHTML; wc.style.transform = appWindowTransform; }
    if(lc){ lc.innerHTML = launchpadHTML; lc.style.transform = launchpadTransform; }
    if(xc){ xc.innerHTML = hideCrossHTML; xc.style.transform = crossTransform; }
    if(cc){ cc.innerHTML = cinemaCtrlHTML; cc.style.transform = cinemaCtrlTransform; }

    hc.style.transform = dockTransform;
    rc.style.transform = railTransform;
    ac.style.transform = appDockTransform;

    if(hw) hw.style.display = hideMain;
    if(rw) rw.style.display = hideMain;
    if(aw) aw.style.display = hideMain;
    if(ww) ww.style.display = (!state.activeApp && state.launchpadOpen) ? 'none' : '';
    if(lw) lw.style.display = state.launchpadOpen ? '' : 'none';

    if(xw) xw.style.display = state.menuHidden ? '' : 'none';
    if(cw) cw.style.display = state.cinemaMode ? '' : 'none';

    for(const base of mainWrapIds){
      const el = $(base+side);
      if(el){
        if(state.menuHidden && !state.cinemaMode){
          el.classList.add('hidden');
        } else {
          el.classList.remove('hidden');
        }
      }
    }

    // === Multitask slots ===
    renderMultitaskSlots(side);
  }

  if(state.cinemaMode && !state.menuHidden){
    const v = $('userVid');
    if(v) updateProgressBar(v);
  }
  // Mini player Apple Music
  if(state.amCurrentTrack) amRenderMiniPlayer();
}

function renderMultitaskSlots(side){
  // Les slots multitâche sont gérés par tickMultitask() via worldToScreen
  // Ici on juste s'assure que les conteneurs DOM existent
  const eye = document.getElementById('eye'+( side==='L' ? 'Left' : 'Right'));
  if(!eye) return;
  eye.querySelectorAll('.multitask-slot-wrap').forEach(e=>e.remove());
  if(!state.multiTaskMode || !state.multiTaskSlots.length) return;

  state.multiTaskSlots.forEach((slot, idx)=>{
    const app = APPS.find(a=>a.id===slot.appId)||{icon:'?',name:slot.appId};
    const wrap = document.createElement('div');
    wrap.className = 'multitask-slot-wrap' + (side==='L' ? ' interactive' : '');
    wrap.id = `mtSlotWrap_${side}_${idx}`;
    // z-index initial (recalculé/maintenu à chaque frame par tickMultitask
    // pour préserver l'ordre de superposition avant/arrière de la cascade)
    wrap.style.cssText = 'position:absolute;transform-origin:center center;pointer-events:'+(side==='L'?'auto':'none')+';z-index:'+(20-idx);
    wrap.innerHTML = `
      <div class="app-window glass" id="mtWinEl_${side}_${idx}" style="width:860px;position:relative;pointer-events:auto;transform:translate(-50%,-50%) scale(1)">
        <div class="multitask-badge">${idx+1}</div>
        <div class="app-window-header" style="padding:6px 10px">
          <div class="app-window-title" style="font-size:11px">${app.icon} ${app.name}</div>
          <div style="display:flex;gap:5px;align-items:center">
            <div class="app-window-close glass-soft" data-gaze data-action="multitask:close:${idx}" style="width:22px;height:22px;font-size:10px">✕</div>
          </div>
        </div>
        <div class="app-window-body" style="min-height:460px;max-height:680px;overflow:hidden;font-size:0.92em">
          ${buildAppBodyHTML(slot.appId)}
        </div>
      </div>`;
    eye.appendChild(wrap);
  });
}

function updateProgressBar(v){
  if(!v || !v.duration) return;
  const pct = (v.currentTime / v.duration * 100) + '%';
  // Update both eyes (duplicate IDs — target via containers)
  for(const side of ['L','R']){
    const cc = $('cinemaCtrlCenter'+side);
    if(cc){
      const fill = cc.querySelector('.progress-fill');
      if(fill) fill.style.width = pct;
    }
  }
}

