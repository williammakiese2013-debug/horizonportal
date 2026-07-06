/* ============================================================
   Series Picker — interface dédiée (même système que Stranger Things)
   Chaque série de seriesCatalog obtient : sélecteur de saison +
   liste d'épisodes + import/lecture via IndexedDB (seriesSaveBlob /
   seriesLoadBlob), avec indicateur "déjà importé". Les titres
   d'épisodes restent génériques (Épisode 1, 2, ...) — aucun vrai
   titre d'épisode n'est écrit ici.
   ============================================================ */

/* Cache mémoire des épisodes déjà importés, clé = dbKey -> bool */
state.seriesLoadedKeys = state.seriesLoadedKeys || {};

/* Vérifie (une fois, mise en cache) les épisodes déjà sauvegardés pour une saison donnée */
async function checkSeriesSeasonLoaded(key, sn){
  const a = seriesCatalog[key];
  if(!a || !a.seasons[sn]) return;
  const totalEp = a.seasons[sn];
  const toCheck = [];
  for(let e=1;e<=totalEp;e++){
    const dbKey = `series-${key}-s${sn}e${e}`;
    if(state.seriesLoadedKeys[dbKey] === undefined) toCheck.push(dbKey);
  }
  if(!toCheck.length) return;
  await Promise.all(toCheck.map(dbKey =>
    seriesLoadBlob(dbKey).then(blob => { state.seriesLoadedKeys[dbKey] = !!blob; })
      .catch(()=>{ state.seriesLoadedKeys[dbKey] = false; })
  ));
  renderHUD();
}
window.checkSeriesSeasonLoaded = checkSeriesSeasonLoaded;

function buildSeriesPicker(){
  const key = state.seriesPickerKey;
  const a = seriesCatalog[key];
  if(!a) return '';
  const sn = state.seriesPickerSeason || parseInt(Object.keys(a.seasons)[0]);
  const totalEp = a.seasons[sn] || 0;

  function esc(s){ return s.replace(/['"]/g,'').replace(/[<>]/g,''); }

  const seriesOpts = SERIES_KEYS.map(k => `
    <option value="${k}"${k===key?' selected':''}>${esc(seriesCatalog[k].emoji)} ${esc(seriesCatalog[k].name)}</option>
  `).join('');

  const seasonsHTML = Object.keys(a.seasons).map(sk => `
    <div class="st-season-btn${parseInt(sk)===sn?' active':''}" data-gaze data-action="netflix:series:season:${key}:${sk}">
      Saison ${sk}
    </div>`).join('');

  const epsHTML = Array.from({length:totalEp}, (_,i) => {
    const e = i+1;
    const dbKey = `series-${key}-s${sn}e${e}`;
    const loaded = !!state.seriesLoadedKeys[dbKey];
    return `
    <div class="st-episode" data-gaze data-action="netflix:series:play:${key}:${sn}:${e}">
      <div class="st-ep-num">E${String(e).padStart(2,'0')}</div>
      <div class="st-ep-info">
        <div class="st-ep-title">Épisode ${e}</div>
        <div class="st-ep-meta">${loaded ? '💾 Déjà importé' : '📁 Non importé — touchez pour ajouter'}</div>
      </div>
      <div class="st-ep-play" data-gaze data-action="netflix:series:import:${key}:${sn}:${e}" title="Importer un fichier">${loaded?'▶':'📁'}</div>
    </div>`;
  }).join('');

  return `
  <div class="st-overlay" id="seriesPickerOverlay">
    <div class="st-title" style="color:${a.color||'#e50914'}">${a.emoji} ${esc(a.name).toUpperCase()}</div>
    <div class="st-subtitle">Choisissez une saison et un épisode</div>
    <div class="series-picker-row" style="margin-bottom:2px">
      <div class="series-picker-field">
        <label>Changer de série</label>
        <select class="series-picker-select"
          onchange="var _c=seriesCatalog[this.value];state.seriesPickerKey=this.value;state.seriesPickerSeason=_c?parseInt(Object.keys(_c.seasons)[0]):1;state.seriesPickerEpisode=null;renderHUD();checkSeriesSeasonLoaded(this.value,state.seriesPickerSeason);">
          ${seriesOpts}
        </select>
      </div>
    </div>
    <div class="st-seasons">${seasonsHTML}</div>
    <div class="st-episodes">${epsHTML}</div>
    <div class="st-close" data-gaze data-action="netflix:series:close">✕ Fermer</div>
  </div>`;
}

/* Indique si une vidéo Super 8 est déjà sauvegardée */
state.netflixHasVideo = false;
(async()=>{
  const blob = await nfLoadBlob();
  state.netflixHasVideo = !!blob;
})();


/* ============================================================
   AnimeHub — interface dédiée (onglet Animation)
   ============================================================ */
function buildAnimeHubHTML(){
  const q = (state.animeSearchQuery||'').toLowerCase().trim();
  const filtered = ANIME_KEYS.filter(k=>animeCatalog[k].name.toLowerCase().includes(q));
  const heroKey = filtered.length ? filtered[0] : ANIME_KEYS[0];
  const hero = animeCatalog[heroKey];
  const sSn = Object.keys(hero.seasons).length;

  function esc(s){ return s.replace(/['"]/g,'').replace(/[<>]/g,''); }

  function buildPopup(){
    if(!state.animePopupOpen) return '';
    const a = animeCatalog[state.animePopupKey];
    if(!a) return '';
    const sn = state.animePopupSeason || 1;
    const s = a.seasons[sn];
    const totalEp = s ? (s.episodes||0) : 0;
    const ep = state.animePopupEpisode;
    const dbKey = state.animePopupKey ? `anime-${state.animePopupKey}-s${sn}` : '';
    return `
    <div class="anime-popup-overlay">
      <div class="anime-popup">
        <div class="anime-popup-title">
          <span>${a.emoji} ${esc(a.name)} — Saison ${sn}</span>
          <div class="anime-popup-close" data-gaze data-action="netflix:anime:close">✕</div>
        </div>
        <div class="anime-popup-seasons">
          ${Object.keys(a.seasons).map(sk=>`
            <div class="anime-popup-sbtn${parseInt(sk)===sn?' active':''}"
              data-gaze data-action="netflix:anime:season:${state.animePopupKey}:${sk}">S${sk}</div>
          `).join('')}
        </div>
        <div class="anime-popup-epgrid">
          ${totalEp>0 ? Array.from({length:totalEp},(_,i)=>{
            const e = i+1;
            return `<div class="anime-popup-ep${ep===e?' selected':''}"
              data-gaze data-action="netflix:anime:episode:${state.animePopupKey}:${sn}:${e}">${e}</div>`;
          }).join('') : s.movies ? s.movies.map(m=>`
            <div class="anime-popup-ep" data-gaze data-action="toast:${esc(m)}">${esc(m)}</div>
          `).join('') : `<div style="grid-column:1/-1;text-align:center;font-size:10px;opacity:.5;padding:20px">Aucun épisode</div>`}
        </div>
        <div class="anime-popup-actions">
          <button class="anime-popup-btn" style="background:linear-gradient(135deg,#a855f7,#6366f1)"
            ${!ep?'disabled':''} data-gaze data-action="netflix:anime:play:${state.animePopupKey}:${sn}:${ep||1}">▶ Vérifier dans la bibliothèque</button>
          <button class="anime-popup-btn" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2)"
            data-gaze data-action="netflix:anime:import:${state.animePopupKey}:${sn}:${ep||1}">📁 Choisir un fichier sur mon téléphone</button>
        </div>
      </div>
    </div>`;
  }

  return `<div class="nf-root" style="background:linear-gradient(135deg,#1a0f2e 0%,#0f0820 50%,#1a0f2e 100%);color:#fff;font-family:system-ui,-apple-system,sans-serif;position:relative">
    <div class="app-gaze-scroll right" style="right:4px;top:50%;transform:translateY(-50%)">
      <div class="app-gaze-scroll-btn" data-gaze data-action="nf-scroll-up" title="Monter">▲</div>
      <div class="app-gaze-scroll-track"></div>
      <div class="app-gaze-scroll-btn" data-gaze data-action="nf-scroll-down" title="Descendre">▼</div>
    </div>
    <div class="nf-sidebar" style="background:rgba(20,10,40,.6);backdrop-filter:blur(10px)">
      <div class="nf-s-ico nf-s-active" style="background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff" data-gaze data-action="netflix:tab:home">🏠</div>
      <div class="nf-s-ico" data-gaze data-action="toast:Favoris">❤️</div>
      <div class="nf-s-ico" data-gaze data-action="toast:Téléchargements">⬇️</div>
      <div class="nf-s-ico" data-gaze data-action="toast:Profil">👤</div>
      <div class="nf-s-ico" style="margin-top:auto" data-gaze data-action="toast:Réglages">⚙️</div>
    </div>
    <div class="nf-main" id="nfMainScroll" style="overflow-y:auto">
      <div class="nf-topbar">
        <input type="text" class="nf-search glass-soft" placeholder="🔍 Rechercher un anime..."
          value="${esc(state.animeSearchQuery)}" data-gaze
          oninput="state.animeSearchQuery=this.value;renderHUD()">
        <div class="nf-tabs">
          <div class="nf-tab" data-gaze data-action="netflix:tab:home">Movie</div>
          <div class="nf-tab" data-gaze data-action="toast:Action">Action</div>
          <div class="nf-tab nf-tab-active" style="background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff">Animation</div>
          <div class="nf-tab" data-gaze data-action="toast:Mystery">Mystery</div>
          <div class="nf-tab" data-gaze data-action="toast:More">More</div>
        </div>
        <div class="nf-topbar-right">
          <div class="nf-notif">🔔<span class="nf-dot-green"></span></div>
          <div class="nf-avatar" data-gaze data-action="netflix:anime:creator:menu">
            <div class="nf-av-pic" style="background:linear-gradient(135deg,#f472b6,#a855f7)">👤</div>
            <div class="nf-av-name">Angele Morine <span style="opacity:.5;font-size:9px">@angele</span></div>
            <span style="font-size:10px;opacity:.5">▾</span>
          </div>
        </div>
      </div>
      <div class="nf-body">
        <div class="nf-left-col">
          <div class="nf-section-head"><span>⭐ Top 10 Anime</span><span class="nf-sort">Sort by Today ↑</span></div>
          <div class="nf-trailer-list">
            ${filtered.slice(0,3).map(k=>{
              const a = animeCatalog[k];
              return `<div class="nf-trailer-item" data-gaze data-action="netflix:anime:open:${k}">
                <div class="nf-trailer-thumb" style="background:linear-gradient(135deg,${a.color},#000)">${a.emoji}</div>
                <div class="nf-trailer-info">
                  <div class="nf-trailer-title">${esc(a.name)}</div>
                  <div class="nf-trailer-play">▶</div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div class="nf-section-head" style="margin-top:14px">Continue Watching</div>
          <div class="nf-cw-list">
            ${buildAnimeUserContentCW()}
            ${filtered.slice(3,6).map(k=>{
              const a = animeCatalog[k];
              const sks = Object.keys(a.seasons);
              const sk = sks[0];
              return `<div class="nf-cw-item" data-gaze data-action="netflix:anime:open:${k}">
                <div class="nf-cw-thumb" style="background:linear-gradient(135deg,${a.color},#000)">${a.emoji}</div>
                <div class="nf-cw-info"><div class="nf-cw-title">${esc(a.name)}</div><div class="nf-cw-sub">${esc(a.seasons[sk].name)}</div></div>
                <div class="nf-cw-play">▶</div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="nf-center-col">
          <div class="nf-hero" style="background:linear-gradient(135deg,#2d1b4e,#4a1942)">
            <div class="nf-hero-bg"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;opacity:.4">${hero.emoji}</div><div class="nf-hero-gradient"></div></div>
            <div class="nf-hero-badge"><span class="nf-tag" style="background:rgba(168,85,247,.3)">Trending Now</span><span class="nf-tag">${sSn>1?'Series':'Movie'}</span></div>
            <div class="nf-hero-title">${esc(hero.name)}</div>
            <div class="nf-hero-desc">${esc(hero.desc)}</div>
            <div class="nf-hero-btns">
              <div class="nf-btn-play" style="background:linear-gradient(135deg,#a855f7,#6366f1)" data-gaze data-action="netflix:anime:open:${heroKey}">▶ Watch</div>
              <div class="nf-btn-dl" data-gaze data-action="toast:Download">⬇ Download</div>
              <div data-gaze data-action="toast:Options" style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid rgba(255,255,255,.3)">…</div>
            </div>
          </div>
          <div class="nf-section-head" style="margin:10px 0 6px">${q?'Résultats pour "'+esc(q)+'"':'Tous les animes'}</div>
          <div class="nf-grid4" style="overflow-y:auto;flex:1;align-content:start;padding-bottom:10px">
            ${filtered.length ? filtered.map(k=>{
              const a = animeCatalog[k];
              const sSn = Object.keys(a.seasons).length;
              return `<div class="nf-card" style="position:relative" data-gaze>
                <div class="nf-card-img" style="${(state.nfCardCovers||{})['anime-'+k] ? `background:url('${(state.nfCardCovers||{})['anime-'+k]}') center/cover` : `background:linear-gradient(135deg,${a.color},#000)`}">
                  ${!(state.nfCardCovers||{})['anime-'+k] ? a.emoji : ''}
                </div>
                <div class="nf-card-tag" style="background:rgba(168,85,247,.4)">Animation</div>
                <div class="nf-card-title">${esc(a.name)}</div>
                <div class="nf-card-desc">${sSn} saison${sSn>1?'s':''}</div>
                <div class="nf-card-play" data-gaze data-action="netflix:anime:open:${k}">▶</div>
                <div class="nf-card-more" data-gaze data-action="netflix:anime:open:${k}">See more...</div>
                <div data-gaze data-action="nf:editcover:anime-${k}"
                  style="position:absolute;top:4px;left:4px;width:22px;height:22px;border-radius:50%;
                  background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.4);
                  display:flex;align-items:center;justify-content:center;font-size:10px;
                  cursor:pointer;pointer-events:auto;z-index:5">📷</div>
              </div>`;
            }).join('') : `<div style="grid-column:1/-1;text-align:center;font-size:11px;opacity:.5;padding:30px 0">Aucun résultat pour "${esc(q)}"</div>`}
          </div>
        </div>
      </div>
    </div>
    <input type="file" id="animeFileInput" accept="video/*" style="display:none">
    <input type="file" id="creatorCoverInput" accept="image/*" style="display:none">
    <input type="file" id="userContentFileInput" accept="video/*" style="display:none">
    <input type="file" id="nfCardCoverInput" accept="image/*" style="display:none">
    ${buildPopup()}
    ${state.netflixCreatorOpen ? buildCreatorMenu('netflix:anime:creator') : ''}
  </div>`;
}

