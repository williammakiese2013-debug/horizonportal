/* ================================================================
   Netflix App — interface Steary-like + Super 8 via IndexedDB
   ================================================================ */

/* IndexedDB helpers pour stocker la vidéo Super 8 entre sessions */
const NF_DB_NAME = 'horizonNF', NF_STORE = 'videos', NF_KEY = 'super8';
function nfOpenDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(NF_DB_NAME,1);
    req.onupgradeneeded = e=>{ e.target.result.createObjectStore(NF_STORE); };
    req.onsuccess = e=>res(e.target.result);
    req.onerror = ()=>rej(req.error);
  });
}
async function nfSaveBlob(blob){
  try{
    const db = await nfOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(NF_STORE,'readwrite');
      tx.objectStore(NF_STORE).put(blob, NF_KEY);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}
async function nfLoadBlob(){
  try{
    const db = await nfOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(NF_STORE,'readonly');
      const req = tx.objectStore(NF_STORE).get(NF_KEY);
      req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);
    });
  }catch(e){ return null; }
}

/* ============================================================
   Stranger Things — IndexedDB (même système que Super 8)
   ============================================================ */
const ST_DB_NAME = 'horizonST', ST_STORE = 'stVideos';
function stOpenDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(ST_DB_NAME,1);
    req.onupgradeneeded = e=>{ e.target.result.createObjectStore(ST_STORE); };
    req.onsuccess = e=>res(e.target.result);
    req.onerror = ()=>rej(req.error);
  });
}
async function stSaveBlob(blob, key){
  try{
    const db = await stOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(ST_STORE,'readwrite');
      tx.objectStore(ST_STORE).put(blob, key);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}
async function stLoadBlob(key){
  try{
    const db = await stOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(ST_STORE,'readonly');
      const req = tx.objectStore(ST_STORE).get(key);
      req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);
    });
  }catch(e){ return null; }
}

/* ============================================================
   Anime Hub — IndexedDB (même système)
   ============================================================ */
const ANIME_DB_NAME = 'horizonAnime', ANIME_STORE = 'animeVideos';
function animeOpenDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(ANIME_DB_NAME,1);
    req.onupgradeneeded = e=>{ e.target.result.createObjectStore(ANIME_STORE); };
    req.onsuccess = e=>res(e.target.result);
    req.onerror = ()=>rej(req.error);
  });
}
async function animeSaveBlob(blob, key){
  try{
    const db = await animeOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(ANIME_STORE,'readwrite');
      tx.objectStore(ANIME_STORE).put(blob, key);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}
async function animeLoadBlob(key){
  try{
    const db = await animeOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(ANIME_STORE,'readonly');
      const req = tx.objectStore(ANIME_STORE).get(key);
      req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);
    });
  }catch(e){ return null; }
}

/* ============================================================
   Series — IndexedDB
   ============================================================ */
const SERIES_DB_NAME = 'horizonSeries', SERIES_STORE = 'seriesVideos';
function seriesOpenDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(SERIES_DB_NAME,1);
    req.onupgradeneeded = e=>{ e.target.result.createObjectStore(SERIES_STORE); };
    req.onsuccess = e=>res(e.target.result);
    req.onerror = ()=>rej(req.error);
  });
}
async function seriesSaveBlob(blob, key){
  try{
    const db = await seriesOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(SERIES_STORE,'readwrite');
      tx.objectStore(SERIES_STORE).put(blob, key);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}
async function seriesLoadBlob(key){
  try{
    const db = await seriesOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(SERIES_STORE,'readonly');
      const req = tx.objectStore(SERIES_STORE).get(key);
      req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);
    });
  }catch(e){ return null; }
}

/* ============================================================
   Disney+ — IndexedDB
   ============================================================ */
const DISNEY_DB_NAME = 'horizonDisney', DISNEY_STORE = 'disneyVideos';
function disneyOpenDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(DISNEY_DB_NAME,1);
    req.onupgradeneeded = e=>{ e.target.result.createObjectStore(DISNEY_STORE); };
    req.onsuccess = e=>res(e.target.result);
    req.onerror = ()=>rej(req.error);
  });
}
async function disneySaveBlob(blob, key){
  try{
    const db = await disneyOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(DISNEY_STORE,'readwrite');
      tx.objectStore(DISNEY_STORE).put(blob, key);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}
async function disneyLoadBlob(key){
  try{
    const db = await disneyOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(DISNEY_STORE,'readonly');
      const req = tx.objectStore(DISNEY_STORE).get(key);
      req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);
    });
  }catch(e){ return null; }
}

/* ============================================================
   Apple TV — IndexedDB
   ============================================================ */
const ATV_DB_NAME = 'horizonATV', ATV_STORE = 'atvVideos';
function atvOpenDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(ATV_DB_NAME,1);
    req.onupgradeneeded = e=>{ e.target.result.createObjectStore(ATV_STORE); };
    req.onsuccess = e=>res(e.target.result);
    req.onerror = ()=>rej(req.error);
  });
}
async function atvSaveBlob(blob, key){
  try{
    const db = await atvOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(ATV_STORE,'readwrite');
      tx.objectStore(ATV_STORE).put(blob, key);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}
async function atvLoadBlob(key){
  try{
    const db = await atvOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(ATV_STORE,'readonly');
      const req = tx.objectStore(ATV_STORE).get(key);
      req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);
    });
  }catch(e){ return null; }
}

/* ============================================================
   Sauvegarde/chargement userContent Disney & ATV
   ============================================================ */
function saveDisneyUserContent(){
  try{
    localStorage.setItem('horizonDisneyContent', JSON.stringify(
      state.disneyUserContent.map(c=>({...c, coverDataUrl:c.coverDataUrl||''}))
    ));
  }catch(_){}
}
function loadDisneyUserContent(){
  try{
    const raw = localStorage.getItem('horizonDisneyContent');
    if(raw) state.disneyUserContent = JSON.parse(raw);
  }catch(_){}
}
function saveATVUserContent(){
  try{
    localStorage.setItem('horizonATVContent', JSON.stringify(
      state.atvUserContent.map(c=>({...c, coverDataUrl:c.coverDataUrl||''}))
    ));
  }catch(_){}
}
function loadATVUserContent(){
  try{
    const raw = localStorage.getItem('horizonATVContent');
    if(raw) state.atvUserContent = JSON.parse(raw);
  }catch(_){}
}

/* Données épisodes Stranger Things */
const ST_SEASONS = {
  1: {
    year:2016, episodes:[
      {ep:1, title:'Chapitre un : La Disparition de Will Byers', dur:'48min', date:'15/07/2016'},
      {ep:2, title:'Chapitre deux : L\'Étrange Petite Fille',    dur:'55min', date:'15/07/2016'},
      {ep:3, title:'Chapitre trois : Holly, Jolly',              dur:'51min', date:'15/07/2016'},
      {ep:4, title:'Chapitre quatre : Le Corps',                 dur:'49min', date:'15/07/2016'},
      {ep:5, title:'Chapitre cinq : La Boue est Dangereuse',     dur:'52min', date:'15/07/2016'},
      {ep:6, title:'Chapitre six : Le Monstre',                  dur:'46min', date:'15/07/2016'},
      {ep:7, title:'Chapitre sept : Le Bain',                    dur:'41min', date:'15/07/2016'},
      {ep:8, title:'Chapitre huit : Le Monde Renversé',          dur:'55min', date:'15/07/2016'},
    ]
  },
  2: {
    year:2017, episodes:[
      {ep:1, title:'Chapitre un : MADMAX',                       dur:'48min', date:'27/10/2017'},
      {ep:2, title:'Chapitre deux : Le Chat, le Rat',            dur:'56min', date:'27/10/2017'},
      {ep:3, title:'Chapitre trois : Le Pollywog',               dur:'51min', date:'27/10/2017'},
      {ep:4, title:'Chapitre quatre : Will le Sage',             dur:'46min', date:'27/10/2017'},
      {ep:5, title:'Chapitre cinq : Dig Dug',                    dur:'58min', date:'27/10/2017'},
      {ep:6, title:'Chapitre six : Le Spy',                      dur:'46min', date:'27/10/2017'},
      {ep:7, title:'Chapitre sept : La Petite Sœur',             dur:'56min', date:'27/10/2017'},
      {ep:8, title:'Chapitre huit : L\'Esprit de la Ruche',      dur:'63min', date:'27/10/2017'},
      {ep:9, title:'Chapitre neuf : La Porte',                   dur:'77min', date:'27/10/2017'},
    ]
  },
  3: {
    year:2019, episodes:[
      {ep:1, title:'Chapitre un : Suxxer',                       dur:'51min', date:'04/07/2019'},
      {ep:2, title:'Chapitre deux : La Russe à la Mall',         dur:'56min', date:'04/07/2019'},
      {ep:3, title:'Chapitre trois : Le Cas de Billy',           dur:'51min', date:'04/07/2019'},
      {ep:4, title:'Chapitre quatre : Le Sauna Test',            dur:'54min', date:'04/07/2019'},
      {ep:5, title:'Chapitre cinq : Le Fleuriste',               dur:'58min', date:'04/07/2019'},
      {ep:6, title:'Chapitre six : Le Scoop',                    dur:'63min', date:'04/07/2019'},
      {ep:7, title:'Chapitre sept : La Bataille de Starcourt',   dur:'78min', date:'04/07/2019'},
      {ep:8, title:'Chapitre huit : Le Chapitre Final',          dur:'80min', date:'04/07/2019'},
    ]
  },
  4: {
    year:2022, episodes:[
      {ep:1, title:'Chapitre un : Hellfire Club',                dur:'77min', date:'27/05/2022'},
      {ep:2, title:'Chapitre deux : Vecna\'s Curse',             dur:'75min', date:'27/05/2022'},
      {ep:3, title:'Chapitre trois : Le Monstre et la Super-héroïne', dur:'63min', date:'27/05/2022'},
      {ep:4, title:'Chapitre quatre : Dear Billy',               dur:'79min', date:'27/05/2022'},
      {ep:5, title:'Chapitre cinq : L\'Armée de Nina',           dur:'73min', date:'27/05/2022'},
      {ep:6, title:'Chapitre six : Le Plongeur',                 dur:'73min', date:'27/05/2022'},
      {ep:7, title:'Chapitre sept : Le Mastermind',              dur:'99min', date:'01/07/2022'},
      {ep:8, title:'Chapitre huit : Papa',                       dur:'85min', date:'01/07/2022'},
      {ep:9, title:'Chapitre neuf : The Piggyback',              dur:'150min',date:'01/07/2022'},
    ]
  },
};

/* État picker Stranger Things */
state.stPickerOpen = false;
state.stPickerSeason = 1;
state.stPendingKey = null;
state.stLoadedKeys = {};

/* Vérifier les épisodes déjà sauvegardés */
(async()=>{
  const db = await stOpenDB().catch(()=>null);
  if(!db) return;
  for(let s=1;s<=4;s++){
    const eps = ST_SEASONS[s].episodes;
    for(let e=0;e<eps.length;e++){
      const key = `s${s}e${eps[e].ep}`;
      const blob = await stLoadBlob(key).catch(()=>null);
      if(blob) state.stLoadedKeys[key] = true;
    }
  }
  renderHUD();
})();

function buildSTPicker(){
  const s = state.stPickerSeason;
  const season = ST_SEASONS[s];
  const seasonsHTML = [1,2,3,4].map(n=>`
    <div class="st-season-btn${s===n?' active':''}" data-gaze data-action="netflix:st:season:${n}">
      Saison ${n}
    </div>`).join('');
  const epsHTML = season.episodes.map(ep=>{
    const key = `s${s}e${ep.ep}`;
    const loaded = state.stLoadedKeys[key];
    return `
    <div class="st-episode" data-gaze data-action="netflix:st:play:${s}:${ep.ep}">
      <div class="st-ep-num">E${String(ep.ep).padStart(2,'0')}</div>
      <div class="st-ep-info">
        <div class="st-ep-title">${ep.title}</div>
        <div class="st-ep-meta">⏱ ${ep.dur} &nbsp;·&nbsp; 📅 ${ep.date}${loaded?' &nbsp;·&nbsp; 💾 Chargé':''}</div>
      </div>
      <div class="st-ep-play">▶</div>
    </div>`;
  }).join('');
  return `
  <div class="st-overlay" id="stPickerOverlay">
    <div class="st-title">STRANGER THINGS</div>
    <div class="st-subtitle">Choisissez une saison et un épisode</div>
    <div class="st-seasons">${seasonsHTML}</div>
    <div class="st-episodes">${epsHTML}</div>
    <div class="st-close" data-gaze data-action="netflix:st:close">✕ Fermer</div>
  </div>`;
}

