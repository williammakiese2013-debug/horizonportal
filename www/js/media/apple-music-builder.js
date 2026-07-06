/* ============================================================
   APPLE MUSIC — Builder
   ============================================================ */
function amFmtTime(secs){
  if(!secs||isNaN(secs)) return '0:00';
  const m=Math.floor(secs/60),s=Math.floor(secs%60);
  return m+':'+(s<10?'0':'')+s;
}
function amCoverEl(track, size=40){
  if(!track) return `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size*0.15)}px;background:#333;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.4)}px">🎵</div>`;
  if(track.coverDataUrl) return `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size*0.15)}px;overflow:hidden;flex-shrink:0"><img src="${track.coverDataUrl}" style="width:100%;height:100%;object-fit:cover"/></div>`;
  return `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size*0.15)}px;background:linear-gradient(135deg,#2a1a3a,#4a2a6a);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.4)}px;flex-shrink:0">🎵</div>`;
}
function buildAppleMusicHTML(){
  const tab = state.amTab;
  const tracks = state.amTracks;
  const playlists = state.amPlaylists;
  const cur = state.amCurrentTrack;
  const playing = state.amPlaying;
  const prog = state.amProgress||0;
  const dur = state.amDuration||0;

  // Sidebar
  const navItems = [
    {id:'home',icon:'♪',label:'Pour vous'},
    {id:'radio',icon:'📻',label:'Radio'},
    {id:'library',icon:'🗂️',label:'Bibliothèque'},
    {id:'search',icon:'🔍',label:'Rechercher'},
  ];
  const sidebar = `<div class="am-sidebar">
    <div class="am-logo"><div class="am-logo-ico">♪</div>Music</div>
    <div class="am-search-bar" data-gaze data-action="am:tab:search">🔍 Rechercher</div>
    <div class="am-nav-section">Menu</div>
    ${navItems.map(n=>`<div class="am-nav-item${tab===n.id?' active':''}" data-gaze data-action="am:tab:${n.id}"><span class="am-nav-ico">${n.icon}</span>${n.label}</div>`).join('')}
    <div class="am-nav-section" style="margin-top:10px">Bibliothèque</div>
    <div class="am-nav-item${tab==='artists'?' active':''}" data-gaze data-action="am:tab:artists"><span class="am-nav-ico">🎤</span>Artistes</div>
    <div class="am-nav-item${tab==='albums'?' active':''}" data-gaze data-action="am:tab:albums"><span class="am-nav-ico">💿</span>Albums</div>
    <div class="am-nav-item${tab==='playlists'?' active':''}" data-gaze data-action="am:tab:playlists"><span class="am-nav-ico">📋</span>Playlists</div>
    ${cur ? `<div class="am-now-mini" data-gaze data-action="am:tab:home">
      <div class="am-now-mini-cover">${cur.coverDataUrl?`<img src="${cur.coverDataUrl}"/>`:'🎵'}</div>
      <div class="am-now-mini-info">
        <div class="am-now-mini-title">${cur.name}</div>
        <div class="am-now-mini-artist">${cur.artist||'Artiste inconnu'}</div>
      </div>
      <div class="am-now-mini-btn" data-gaze data-action="am:playpause">${playing?'⏸':'▶'}</div>
    </div>` : ''}
  </div>`;

  // Player bar
  const playerBar = `<div class="am-player">
    <div class="am-player-cover">${cur?(cur.coverDataUrl?`<img src="${cur.coverDataUrl}"/>`:'🎵'):'🎵'}</div>
    <div class="am-player-info">
      <div class="am-player-title">${cur?cur.name:'Aucune musique'}</div>
      <div class="am-player-artist">${cur?(cur.artist||'Artiste inconnu'):'—'}</div>
    </div>
    <div class="am-player-love${state.amCurrentTrack?.loved?' loved':''}" data-gaze data-action="am:love">♥</div>
    <div class="am-player-center">
      <div class="am-player-controls">
        <div class="am-ctrl-btn${state.amShuffle?' active':''}" data-gaze data-action="am:shuffle" title="Aléatoire">⇄</div>
        <div class="am-ctrl-btn" data-gaze data-action="am:prev">⏮</div>
        <div class="am-ctrl-play" data-gaze data-action="am:playpause">${playing?'⏸':'▶'}</div>
        <div class="am-ctrl-btn" data-gaze data-action="am:next">⏭</div>
        <div class="am-ctrl-btn${state.amRepeat?' active':''}" data-gaze data-action="am:repeat" title="Répéter">↺</div>
      </div>
      <div class="am-progress-wrap">
        <div class="am-progress-time">${amFmtTime(prog)}</div>
        <div class="am-progress-track" data-gaze data-action="am:seek">
          <div class="am-progress-fill" style="width:${dur>0?Math.round(prog/dur*100):0}%"></div>
        </div>
        <div class="am-progress-time">${amFmtTime(dur)}</div>
      </div>
    </div>
    <div class="am-player-right">
      <div class="am-vol-wrap">
        <div class="am-vol-ico">🔈</div>
        <div class="am-vol-track"><div class="am-vol-fill" style="width:${Math.round((state.amVolume||0.8)*100)}%"></div></div>
        <div class="am-vol-ico">🔊</div>
      </div>
    </div>
  </div>`;

  // Tab content
  let tabContent = '';
  if(tab==='home'){
    tabContent = `
      <div class="am-hero">
        <div>
          <div class="am-hero-badge">Playlist</div>
          <div class="am-hero-title"><span>Top Song</span><br><span class="accent">Of The Week</span></div>
          <div class="am-hero-btns">
            <div class="am-play-btn" data-gaze data-action="am:playAll">▶ Lire</div>
            <div class="am-outline-btn" data-gaze data-action="am:tab:library">📂 Bibliothèque</div>
          </div>
        </div>
      </div>
      <div class="am-section-head">
        <div class="am-section-title">Ma Bibliothèque</div>
        <div class="am-see-all" data-gaze data-action="am:tab:library">Tout voir</div>
      </div>
      ${tracks.length===0?`<div class="am-empty"><div class="am-empty-ico">🎵</div><div>Aucune musique ajoutée</div><div style="margin-top:8px;font-size:10px">Cliquez sur "Ajouter" pour importer vos morceaux</div><div class="am-action-btn primary" data-gaze data-action="am:addTrack" style="margin-top:12px;display:inline-block">＋ Ajouter une musique</div></div>`:
      `<div class="am-tracks-list">${tracks.slice(0,5).map((t,i)=>`
        <div class="am-track-row${cur&&cur.id===t.id?' playing':''}" data-gaze data-action="am:play:${t.id}">
          <div class="am-track-num${cur&&cur.id===t.id?' playing-ico':''}">${cur&&cur.id===t.id?(playing?'♪':String(i+1)):String(i+1)}</div>
          <div class="am-track-cover">${t.coverDataUrl?`<img src="${t.coverDataUrl}"/>`:'🎵'}</div>
          <div class="am-track-info">
            <div class="am-track-name${cur&&cur.id===t.id?' playing':''}">${t.name}</div>
            <div class="am-track-artist">${t.artist||'Artiste inconnu'}</div>
          </div>
          <div class="am-track-time">3:20</div>
          <div class="am-track-menu" data-gaze data-action="am:trackMenu:${t.id}">•••</div>
        </div>`).join('')}
      </div>`}
      <div class="am-section-head" style="margin-top:18px">
        <div class="am-section-title">Playlists</div>
        <div class="am-see-all" data-gaze data-action="am:tab:playlists">Tout voir</div>
      </div>
      ${playlists.length===0?`<div style="display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.35);font-size:11px;padding:10px 0">
        <div class="am-action-btn" data-gaze data-action="am:createPlaylist">＋ Créer une playlist</div>
      </div>`:
      `<div class="am-playlist-grid">${playlists.slice(0,4).map(pl=>`
        <div class="am-playlist-card" data-gaze data-action="am:openPlaylist:${pl.id}">
          <div class="am-pl-cover">${pl.coverDataUrl?`<img src="${pl.coverDataUrl}"/>`:'🎶'}</div>
          <div class="am-pl-name">${pl.name}</div>
          <div class="am-pl-count">${pl.tracks.length} morceau${pl.tracks.length!==1?'x':''}</div>
        </div>`).join('')}</div>`}
    `;
  } else if(tab==='library'){
    tabContent = `
      <div class="am-section-head">
        <div class="am-section-title">Tous les morceaux (${tracks.length})</div>
        <div class="am-action-btn primary" data-gaze data-action="am:addTrack">＋ Ajouter</div>
      </div>
      ${tracks.length===0?`<div class="am-empty"><div class="am-empty-ico">🎶</div><div>Votre bibliothèque est vide</div><div style="margin-top:8px;font-size:10px">Importez vos fichiers MP3 pour commencer</div></div>`:
      `<div class="am-tracks-list">${tracks.map((t,i)=>`
        <div class="am-track-row${cur&&cur.id===t.id?' playing':''}" data-gaze data-action="am:play:${t.id}">
          <div class="am-track-num${cur&&cur.id===t.id?' playing-ico':''}">${cur&&cur.id===t.id?(playing?'♪':String(i+1)):String(i+1)}</div>
          <div class="am-track-cover">${t.coverDataUrl?`<img src="${t.coverDataUrl}"/>`:'🎵'}</div>
          <div class="am-track-info">
            <div class="am-track-name${cur&&cur.id===t.id?' playing':''}">${t.name}</div>
            <div class="am-track-artist">${t.artist||'Artiste inconnu'}</div>
          </div>
          <div class="am-track-menu" data-gaze data-action="am:trackMenu:${t.id}">•••</div>
        </div>`).join('')}
      </div>`}
    `;
  } else if(tab==='playlists'){
    if(state.amOpenPlaylistId!=null){
      const pl = playlists.find(p=>p.id===state.amOpenPlaylistId);
      if(pl){
        const plTracks = pl.tracks.map(tid=>tracks.find(t=>t.id===tid)).filter(Boolean);
        tabContent = `
          <div class="am-pl-detail-back" data-gaze data-action="am:closePlDetail">← Playlists</div>
          <div class="am-section-head">
            <div class="am-section-title">📋 ${pl.name}</div>
            <div class="am-action-btn" data-gaze data-action="am:addToPlaylist:pl:${pl.id}" style="font-size:10px">＋ Ajouter</div>
          </div>
          ${plTracks.length===0?`<div class="am-empty"><div class="am-empty-ico">🎶</div><div>Playlist vide</div></div>`:
          `<div class="am-tracks-list">${plTracks.map((t,i)=>`
            <div class="am-track-row${cur&&cur.id===t.id?' playing':''}" data-gaze data-action="am:play:${t.id}">
              <div class="am-track-num">${i+1}</div>
              <div class="am-track-cover">${t.coverDataUrl?`<img src="${t.coverDataUrl}"/>`:'🎵'}</div>
              <div class="am-track-info">
                <div class="am-track-name${cur&&cur.id===t.id?' playing':''}">${t.name}</div>
                <div class="am-track-artist">${t.artist||'Artiste inconnu'}</div>
              </div>
            </div>`).join('')}
          </div>`}
        `;
      }
    } else {
      tabContent = `
        <div class="am-section-head">
          <div class="am-section-title">Mes Playlists</div>
          <div class="am-action-btn primary" data-gaze data-action="am:createPlaylist">＋ Nouvelle Playlist</div>
        </div>
        ${playlists.length===0?`<div class="am-empty"><div class="am-empty-ico">📋</div><div>Aucune playlist</div><div style="margin-top:8px;font-size:10px">Créez votre première playlist</div></div>`:
        `<div class="am-playlist-grid">${playlists.map(pl=>`
          <div class="am-playlist-card" data-gaze data-action="am:openPlaylist:${pl.id}">
            <div class="am-pl-cover">${pl.coverDataUrl?`<img src="${pl.coverDataUrl}"/>`:'🎶'}</div>
            <div class="am-pl-name">${pl.name}</div>
            <div class="am-pl-count">${pl.tracks.length} morceau${pl.tracks.length!==1?'x':''}</div>
          </div>`).join('')}</div>`}
      `;
    }
  } else if(tab==='search'||tab==='artists'||tab==='albums'){
    const q = (state.amSearchQuery||'').toLowerCase();
    const filtered = q ? tracks.filter(t=>t.name.toLowerCase().includes(q)||((t.artist||'').toLowerCase().includes(q))) : tracks;
    tabContent = `
      <div style="margin-bottom:12px">
        <input type="text" class="am-modal-input" placeholder="🔍 Rechercher artiste, titre..." value="${state.amSearchQuery||''}"
          oninput="state.amSearchQuery=this.value;renderHUD()" style="font-size:13px;padding:10px 14px">
      </div>
      <div class="am-section-head">
        <div class="am-section-title">${q?`Résultats pour "${state.amSearchQuery}"`:tab==='artists'?'Artistes':tab==='albums'?'Albums':'Toute la bibliothèque'}</div>
      </div>
      ${filtered.length===0?`<div class="am-empty"><div class="am-empty-ico">🔍</div><div>${q?'Aucun résultat':'Bibliothèque vide'}</div></div>`:
      `<div class="am-tracks-list">${filtered.map((t,i)=>`
        <div class="am-track-row${cur&&cur.id===t.id?' playing':''}" data-gaze data-action="am:play:${t.id}">
          <div class="am-track-num">${i+1}</div>
          <div class="am-track-cover">${t.coverDataUrl?`<img src="${t.coverDataUrl}"/>`:'🎵'}</div>
          <div class="am-track-info">
            <div class="am-track-name${cur&&cur.id===t.id?' playing':''}">${t.name}</div>
            <div class="am-track-artist">${t.artist||'Artiste inconnu'}</div>
          </div>
          <div class="am-track-menu" data-gaze data-action="am:trackMenu:${t.id}">•••</div>
        </div>`).join('')}
      </div>`}
    `;
  } else if(tab==='radio'){
    tabContent = `
      <div class="am-hero" style="background:linear-gradient(135deg,#0033aa,#6600cc)">
        <div>
          <div class="am-hero-badge">Radio</div>
          <div class="am-hero-title"><span>Apple Music 1</span></div>
          <div class="am-hero-btns"><div class="am-play-btn">▶ Écouter en direct</div></div>
        </div>
      </div>
      <div class="am-empty" style="margin-top:20px"><div class="am-empty-ico">📻</div><div>Radio en direct — connectez-vous à Internet</div></div>
    `;
  }

  // Modals
  let modal = '';
  if(state.amAddTrackOpen){
    modal = `<div class="am-modal-overlay">
      <div class="am-modal">
        <div class="am-modal-title">➕ Ajouter une musique</div>
        <div class="am-modal-cover-preview" data-gaze data-action="am:pickCover">
          ${state.amPendingCoverDataUrl?`<img src="${state.amPendingCoverDataUrl}"/>`:'🖼'}
        </div>
        <div style="font-size:9px;text-align:center;color:rgba(255,255,255,.4);margin-bottom:10px">Tap pour choisir une image de couverture</div>
        <div class="am-modal-row">
          <div class="am-modal-label">Nom du morceau</div>
          <div class="am-modal-input" data-gaze data-action="am:editTrackName"
            style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;min-height:36px;padding:8px 12px;">
            <span style="${state.amNewTrackName?'color:#fff':'color:rgba(255,255,255,.35)'}">${state.amNewTrackName||'Ex: Bohemian Rhapsody'}</span>
            <span style="font-size:14px;opacity:.6">⌨️</span>
          </div>
        </div>
        <div class="am-modal-row">
          <div class="am-modal-label">Artiste</div>
          <div class="am-modal-input" data-gaze data-action="am:editTrackArtist"
            style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;min-height:36px;padding:8px 12px;">
            <span style="${state.amNewTrackArtist?'color:#fff':'color:rgba(255,255,255,.35)'}">${state.amNewTrackArtist||'Ex: Queen'}</span>
            <span style="font-size:14px;opacity:.6">⌨️</span>
          </div>
        </div>
        <div class="am-modal-import-zone${state.amPendingAudioBlob?' has-file':''}" data-gaze data-action="am:pickMp3">
          <div class="ico">${state.amPendingAudioBlob?'✅':'🎵'}</div>
          <div class="label">${state.amPendingAudioBlob?'Fichier MP3 chargé !':'Appuyez pour importer un fichier MP3'}</div>
          <div class="sublabel">${state.amPendingAudioBlob?state.amPendingAudioBlob.name||'':'Formats acceptés : .mp3, .m4a, .aac, .wav'}</div>
        </div>
        <div class="am-modal-btns">
          <div class="am-modal-btn cancel" data-gaze data-action="am:cancelAddTrack">Annuler</div>
          <div class="am-modal-btn confirm" data-gaze data-action="am:confirmAddTrack">Ajouter</div>
        </div>
      </div>
    </div>`;
  } else if(state.amAddPlaylistOpen){
    modal = `<div class="am-modal-overlay">
      <div class="am-modal">
        <div class="am-modal-title">📋 Nouvelle Playlist</div>
        <div class="am-modal-row">
          <div class="am-modal-label">Nom de la playlist</div>
          <div class="am-modal-input" data-gaze data-action="am:editPlaylistName"
            style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;min-height:36px;padding:8px 12px;">
            <span style="${state.amNewPlaylistName?'color:#fff':'color:rgba(255,255,255,.35)'}">${state.amNewPlaylistName||'Ex: Ma playlist favoris'}</span>
            <span style="font-size:14px;opacity:.6">⌨️</span>
          </div>
        </div>
        <div class="am-modal-btns">
          <div class="am-modal-btn cancel" data-gaze data-action="am:cancelPlaylist">Annuler</div>
          <div class="am-modal-btn confirm" data-gaze data-action="am:confirmPlaylist">Créer</div>
        </div>
      </div>
    </div>`;
  } else if(state.amAddToPlaylistOpen){
    const trackToAdd = tracks.find(t=>t.id===state.amAddToPlaylistTrackId);
    modal = `<div class="am-modal-overlay">
      <div class="am-modal">
        <div class="am-modal-title">Ajouter à une Playlist</div>
        ${trackToAdd?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px;background:rgba(255,255,255,.06);border-radius:8px">
          <div style="width:32px;height:32px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#333;display:flex;align-items:center;justify-content:center">${trackToAdd.coverDataUrl?`<img src="${trackToAdd.coverDataUrl}" style="width:100%;height:100%;object-fit:cover"/>`:'🎵'}</div>
          <div><div style="font-size:11px;font-weight:600">${trackToAdd.name}</div><div style="font-size:9px;opacity:.5">${trackToAdd.artist||'—'}</div></div>
        </div>`:''}
        <div class="am-to-pl-list">
          ${playlists.length===0?`<div style="text-align:center;font-size:11px;opacity:.5;padding:20px">Aucune playlist</div>`:
          playlists.map(pl=>`<div class="am-to-pl-item" data-gaze data-action="am:addTrackToPlaylist:${pl.id}">
            <div style="width:28px;height:28px;border-radius:6px;background:#333;display:flex;align-items:center;justify-content:center;font-size:13px">📋</div>
            <div><div style="font-size:11px;font-weight:600">${pl.name}</div><div style="font-size:9px;opacity:.4">${pl.tracks.length} morceaux</div></div>
          </div>`).join('')}
        </div>
        <div class="am-modal-btns">
          <div class="am-modal-btn cancel" data-gaze data-action="am:cancelAddToPlaylist">Fermer</div>
          <div class="am-modal-btn confirm" data-gaze data-action="am:createPlaylist">＋ Nouvelle playlist</div>
        </div>
      </div>
    </div>`;
  }

  return `<div class="am-root" style="position:relative">
    ${sidebar}
    <div class="am-main">
      <div class="am-topbar">
        <div class="am-topbar-nav">
          <div class="am-topbar-btn" data-gaze data-action="am:back">‹</div>
          <div class="am-topbar-btn" data-gaze data-action="am:forward">›</div>
        </div>
        <div class="am-topbar-title">${tab==='home'?'Pour vous':tab==='library'?'Bibliothèque':tab==='playlists'?'Playlists':tab==='search'||tab==='artists'||tab==='albums'?'Rechercher':'Radio'}</div>
        <div class="am-topbar-actions">
          <div class="am-action-btn" data-gaze data-action="am:addTrack">＋ Musique</div>
          <div class="am-action-btn" data-gaze data-action="am:createPlaylist">＋ Playlist</div>
        </div>
      </div>
      <div class="am-body" id="amBodyScroll">${tabContent}</div>
      ${playerBar}
    </div>
    ${modal}
  </div>`;
}

function buildGameLauncherHTML(){
  const navIcons = ['🏠','🛍️','🎮','📷','📊'];
  const activeNav = state.glNav || 0;

  const games = [
    { id:'gow',   emoji:'⚔️',  title:"God of War Ragnarök",     hours:'17 Hours', color:'#4a9eda', bg:'linear-gradient(135deg,#1a2a3a,#0d1b2a)' },
    { id:'fn',    emoji:'🌪️',  title:'Fortnight',               hours:'13 Hours', color:'#a855f7', bg:'linear-gradient(135deg,#1a1a3a,#0d0d2a)' },
    { id:'sm2',   emoji:'🕷️',  title:"Marvel's Spider-Man 2",   hours:'24Hours',  color:'#e11d48', bg:'linear-gradient(135deg,#1a0a2a,#2a0a1a)' },
    { id:'sims3', emoji:'🏠',  title:'Les Sims 3 VR',           hours:'8 Hours',  color:'#22c55e', bg:'linear-gradient(135deg,#0a2a0a,#1a3a1a)', action:'sims3:launch' },
    { id:'mineraft', emoji:'⛏️', title:'MineRaft VR',           hours:'31 Hours', color:'#7ec850', bg:'linear-gradient(135deg,#1a2a12,#0d1f0a)', action:'game:mineraft:launch' },
    { id:'cooking', emoji:'🍳', title:'Wok & Zen',              hours:'5 Hours',  color:'#ff8a3d', bg:'linear-gradient(135deg,#3a1a0a,#1f0d05)', action:'game:cooking:launch' },
    { id:'cksim',   emoji:'🍔', title:'Cooking Game Simulator', hours:'12 Hours', color:'#ffb020', bg:'linear-gradient(135deg,#3a2a0a,#1f1505)', action:'game:cksim:launch' },
    { id:'echoes', emoji:'🌒', title:'Echoes of Yesterday',     hours:'45 Min',   color:'#5a7a8a', bg:'linear-gradient(135deg,#0a0a1a,#1a0a0a)', action:'game:echoes:launch' },
    { id:'tennis', emoji:'🎾', title:'Tennis VR',              hours:'2 Hours',  color:'#c6ff3d', bg:'linear-gradient(135deg,#0a2a12,#122b0a)', action:'game:tennis:launch' },
    { id:'webhero', emoji:'🕸️', title:'Web Hero — Le Fil de Prime', hours:'1 Hour', color:'#37e0ff', bg:'linear-gradient(135deg,#0a1a2a,#05101f)', action:'game:webhero:launch' },
    { id:'boxing', emoji:'🥊', title:'GigaBox 3D — Seyran Veyron', hours:'3 Hours', color:'#ff0055', bg:'linear-gradient(135deg,#2a0a12,#1f050a)', action:'game:boxing:launch' },
  ];
  const friends = [
    { name:'Robert Fox',     status:'Playing God of war',            color:'#3b82f6' },
    { name:'Wade Warren',    status:'Playing Minecraft',              color:'#10b981' },
    { name:'Savannah Nguyen',status:"Playing Marvel's Midnight Suns", color:'#f59e0b' },
  ];
  const parties = [
    { name:'God of war', sub:'Liza start a video chat', icon:'⚔️', bg:'#1a2a3a' },
    { name:'PUBG',       sub:'Liza start a video chat', icon:'🔫', bg:'#2a1a0a' },
    { name:'Minecraft',  sub:'Liza start a video chat', icon:'⛏️', bg:'#0a1a0a' },
  ];
  const chatMsgs = state.glChatMsgs || [];

  const navHTML = navIcons.map((ico, i) =>
    `<div class="gl-nav-btn${i===activeNav?' active':''}" data-gaze data-action="gl-nav:${i}" title="${['Accueil','Store','Jeux','Médias','Stats'][i]}">${ico}</div>`
  ).join('');

  const gamesHTML = games.map(g =>
    `<div class="gl-game-card" style="background:${g.bg};position:relative" ${g.action ? `data-gaze data-action="${g.action}"` : ''}>
      <div class="gl-game-art" style="pointer-events:none">
        <div class="gl-game-glow" style="background:radial-gradient(ellipse at 50% 80%,${g.color}33 0%,transparent 70%)"></div>
        ${(state.glGameIcons||{})[g.id] ? `<img src="${(state.glGameIcons||{})[g.id]}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:.85;border-radius:14px 14px 0 0">` : g.emoji}
        ${g.action ? `<div style="position:absolute;bottom:6px;right:6px;background:${g.color};color:#fff;font-size:8px;font-weight:700;padding:2px 6px;border-radius:8px">▶ JOUER</div>` : ''}
      </div>
      <div class="gl-game-footer" style="pointer-events:none">
        <div>
          <div class="gl-game-name">${g.title}</div>
          <div class="gl-game-hours">${g.hours}</div>
        </div>
        <button class="gl-like-btn${(state.glLikes||{})[g.id]?' liked':''}" style="pointer-events:auto" data-gaze data-action="gl-like:${g.id}">
          ${(state.glLikes||{})[g.id]?'❤️':'🤍'}
        </button>
      </div>
      <div data-gaze data-action="gl:editicon:${g.id}"
        style="position:absolute;top:5px;left:5px;width:26px;height:26px;border-radius:50%;
        background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.4);
        display:flex;align-items:center;justify-content:center;font-size:12px;
        cursor:pointer;pointer-events:auto;z-index:5;backdrop-filter:blur(4px)"
        title="Modifier l'icône">📷</div>
    </div>`
  ).join('');

  const friendsHTML = friends.map(f =>
    `<div class="gl-friend">
      <div class="gl-friend-ava" style="background:linear-gradient(135deg,${f.color},${f.color}88)">
        ${f.name.split(' ').map(n=>n[0]).join('')}
        <div class="gl-online-dot"></div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="gl-friend-name">${f.name}</div>
        <div class="gl-friend-status">${f.status}</div>
      </div>
    </div>`
  ).join('');

  const partiesHTML = parties.map(p =>
    `<div class="gl-party">
      <div class="gl-party-ico" style="background:${p.bg}">${p.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="gl-friend-name">${p.name}</div>
        <div class="gl-friend-status">${p.sub}</div>
      </div>
      <div class="gl-party-avatars">
        <div class="gl-mini-ava">🧑</div>
        <div class="gl-mini-ava">👩</div>
        <div class="gl-mini-ava gl-mini-ava-plus" style="font-size:7px;font-weight:700">+3</div>
      </div>
    </div>`
  ).join('');

  const chatHTML = chatMsgs.map(m =>
    `<div class="gl-chat-msg"><span>Vous: </span>${escapeHtml(m)}</div>`
  ).join('');

  return `<div class="gl-root">
    <!-- Topbar -->
    <div class="gl-topbar">
      <div class="gl-ps-logo">PS</div>
      <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,.85)">PlayStation</span>
      <div class="gl-sep"></div>
      <span class="gl-topbar-title">Dashboard</span>
      <div class="gl-topbar-actions">
        <div class="gl-icon-btn" data-gaze data-action="gl-search">🔍</div>
        <div class="gl-icon-btn" data-gaze data-action="gl-notif">🔔</div>
        <div class="gl-icon-btn" data-gaze data-action="gl-store">🛍️</div>
        <div class="gl-avatar">
          <div class="gl-avatar-circle">FM</div>
          <span class="gl-avatar-name">Floyd Miles</span>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="gl-body">
      <!-- Left nav -->
      <div class="gl-nav">${navHTML}</div>

      <!-- Center -->
      <div class="gl-center">
        <!-- Banner VALORANT -->
        <div class="gl-banner">
          <div class="gl-banner-bg"></div>
          <div class="gl-banner-glow"></div>
          <div class="gl-banner-content">
            <div class="gl-valo-logo">
              <div class="gl-valo-diamond">V</div>
              <span class="gl-valo-title">VALORANT</span>
            </div>
            <p class="gl-banner-desc">VALORANT is set on a near-future Earth impacted by large advancements in technology, global event.</p>
            <button class="gl-find-btn" data-gaze data-action="gl-findmore">Find out more</button>
          </div>
          <div class="gl-banner-hero">
            <div class="gl-hero-watermark">REAWAKE</div>
            <div class="gl-hero-char">🥷</div>
          </div>
        </div>

        <!-- Most played -->
        <div class="gl-section-label">Most Played Games</div>
        <div class="gl-games-grid">${gamesHTML}</div>
      </div>

      <!-- Right social panel -->
      <div class="gl-social">
        <div class="gl-social-hdr">
          <span class="gl-social-hdr-title">Social</span>
          <span style="font-size:11px;opacity:.5">▲</span>
        </div>
        <div style="overflow:auto;flex:1">
          <div class="gl-sub-label">Online +3</div>
          ${friendsHTML}
          <div class="gl-divider"></div>
          <div class="gl-sub-label">Parties +3</div>
          ${partiesHTML}
          <div class="gl-divider"></div>
          <!-- Party chat -->
          <div class="gl-chat">
            <div class="gl-chat-label">Party Chat</div>
            <div class="gl-chat-name-row">
              <span class="gl-chat-name">Annette Black</span>
              <div class="gl-party-avatars">
                <div class="gl-mini-ava">🧑</div>
                <div class="gl-mini-ava">👩</div>
                <div class="gl-mini-ava">👦</div>
                <div class="gl-mini-ava gl-mini-ava-plus" style="font-size:7px;font-weight:700">10</div>
              </div>
            </div>
            <div class="gl-chat-msgs" id="glChatMsgs">${chatHTML}</div>
            <div class="gl-chat-input-row">
              <input class="gl-chat-input" id="glChatInput" placeholder="Type a message…"
                onkeydown="if(event.key==='Enter'){event.preventDefault();glSendChat();}">
              <button class="gl-chat-send" onclick="glSendChat()">➤</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <input type="file" id="glGameIconInput" accept="image/*" style="display:none">
  </div>`;
}

function glSendChat(){
  const inp = document.getElementById('glChatInput');
  if(!inp||!inp.value.trim()) return;
  if(!state.glChatMsgs) state.glChatMsgs=[];
  state.glChatMsgs.push(inp.value.trim());
  inp.value='';
  renderHUD();
  // scroll to bottom
  setTimeout(()=>{ const m=document.getElementById('glChatMsgs'); if(m) m.scrollTop=9999; },30);
}

function buildAppBodyHTML(appId){
  if(appId === 'youtube'){
    return `<iframe src="https://api.allorigins.win/raw?url=https://m.youtube.com/channel/UCzuqhhs6NWbgTzMuM09WKDQ%3Fhl%3Dfr%26gl%3DFR%26cbrd%3D1"
      allow="autoplay; encrypted-media" referrerpolicy="origin" sandbox="allow-scripts allow-same-origin allow-popups"
      loading="lazy"></iframe>`;
  }
  if(appId === 'fexini'){
    return `<iframe src="https://api.allorigins.win/raw?url=https://fexini.net"
      allow="autoplay; encrypted-media" referrerpolicy="origin" sandbox="allow-scripts allow-same-origin allow-popups"
      loading="lazy"></iframe>`;
  }
  if(appId === 'safari'){
    return buildBrowserHTML();
  }
  if(appId === 'jeux'){
    return buildGamesHubHTML();
  }
  if(appId === 'gamelauncher'){
    return buildGameLauncherHTML();
  }
  if(appId === 'notes'){
    return buildNotesHTML();
  }
  if(appId === 'maison'){
    return buildMaisonHTML();
  }
  if(appId === 'netflix'){
    return buildNetflixHTML();
  }
  if(appId === 'appletv'){
    return buildAppleTVHTML();
  }
  if(appId === 'visionhome'){
    return buildVisionHomeHTML();
  }
  if(appId === 'disney'){
    return buildDisneyHTML();
  }
  if(appId === 'settings'){
    return buildSettingsHTML();
  }
  return `<div style="padding:30px;text-align:center;opacity:.6">Application inconnue</div>`;
}

/* ------------ App Notes ------------ */
const KB_ROWS = [
  ['A','Z','E','R','T','Y','U','I','O','P'],
  ['Q','S','D','F','G','H','J','K','L','M'],
  ['⇧','W','X','C','V','B','N','⌫','↵','✕'],
  ['123','espace','.,!?','⬅','➡'],
];
const KB_SPECIAL = { '⌫':'backspace', '↵':'enter', '⇧':'shift', '✕':'close-kb',
                     '⬅':'cursor-left', '➡':'cursor-right', 'espace':'space', '123':'num' };

function buildNotesHTML(){
  const text = state.notesText || '';
  const rows = KB_ROWS.map((row, ri) => {
    const keys = row.map(k => {
      const isWide = k === 'espace' || k === '123' || k === '.,!?';
      const isAct  = k === state.notesGazeKey;
      const prog   = isAct ? Math.min(1,(performance.now()-state.notesGazeStart)/1000) : 0;
      const dash   = 2*Math.PI*10;
      const offset = dash * (1 - prog);
      return `<div class="kb-key${isWide?' kb-wide':''}" data-kb="${k}" data-gaze data-action="notes:key:${k}">
        <svg class="kb-ring" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" fill="none"
          stroke="rgba(255,255,255,.9)" stroke-width="2"
          stroke-dasharray="${dash.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
          transform="rotate(-90 13 13)"/></svg>
        ${k}
      </div>`;
    }).join('');
    return `<div class="kb-row">${keys}</div>`;
  }).join('');

  return `
  <div class="notes-wrap">
    <div class="notes-page glass-soft">
      <div class="notes-header">
        <span style="font-size:13px;font-weight:600;opacity:.8">✍️ Carnet de bord spatial</span>
        <div class="notes-actions">
          <div class="notes-btn" data-gaze data-action="notes:clear">🗑 Effacer</div>
          <div class="notes-btn" data-gaze data-action="notes:save">💾 Sauver</div>
        </div>
      </div>
      <div class="notes-body" id="notesBody" data-gaze data-action="notes:edittext" style="cursor:pointer;">${escapeHtml(text) || '<span style="opacity:.35">👆 Tapez pour écrire (2x pour clavier iPhone)</span>'}</div>
    </div>
    <div class="kb-wrap glass">
      ${rows}
    </div>
  </div>`;
}

function escapeHtml(t){
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

