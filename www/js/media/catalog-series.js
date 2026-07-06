/* ============================================================
   Series Catalog — BASE DE DONNÉES DES SÉRIES
   ============================================================ */
const seriesCatalog = {
  vampirediaries:{
    name:"The Vampire Diaries", emoji:"🧛", color:"#2a0a1a",
    seasons:{1:22, 2:22, 3:22, 4:23, 5:22, 6:22, 7:22, 8:16}
  },
  theoriginals:{
    name:"The Originals", emoji:"🩸", color:"#1a0a0a",
    seasons:{1:22, 2:22, 3:22, 4:13, 5:13}
  },
  teenwolf:{
    name:"Teen Wolf", emoji:"🐺", color:"#1a2a0a",
    seasons:{1:12, 2:12, 3:24, 4:12, 5:20, 6:20}
  },
  h2o:{
    name:"H2O : Just Add Water", emoji:"🧜", color:"#0a2a3a",
    seasons:{1:26, 2:26, 3:26}
  },
  henrydanger:{
    name:"Henry Danger", emoji:"🦸", color:"#3a1a0a",
    seasons:{1:26, 2:19, 3:19, 4:22, 5:35}
  },
  thundermans:{
    name:"The Thundermans", emoji:"⚡", color:"#2a2a0a",
    seasons:{1:20, 2:24, 3:25, 4:29}
  },
  samandcat:{
    name:"Sam & Cat", emoji:"👭", color:"#2a0a2a",
    seasons:{1:35}
  },
  victorious:{
    name:"Victorious", emoji:"🎤", color:"#2a1a0a",
    seasons:{1:19, 2:13, 3:12, 4:13}
  },
  smallville:{
    name:"Smallville", emoji:"🦸", color:"#0a0a2a",
    seasons:{1:21, 2:23, 3:22, 4:22, 5:22, 6:22, 7:20, 8:22, 9:22, 10:22}
  }
};
const SERIES_KEYS = Object.keys(seriesCatalog);

/* ------------ Helpers ------------ */
const $ = (id)=>document.getElementById(id);
const skyL = $('skyL'), skyR = $('skyR');
const camL = $('camL'), camR = $('camR');

function setScene(sc){
  state.scene = sc;
  if(sc.kind === 'video'){
    let v = document.getElementById('userVid');
    if(!v){ v = document.createElement('video'); v.id='userVid'; v.crossOrigin='anonymous';
      v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
      v.loop = true; document.body.appendChild(v); }
    v.muted = true;
    v.src = sc.url; v.play().catch(()=>{});
    skyL.setAttribute('src', '#userVid');
    skyR.setAttribute('src', '#userVid');
  } else {
    skyL.setAttribute('src', sc.url);
    skyR.setAttribute('src', sc.url);
  }
  toast('Scène : '+sc.name);
}

function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText='position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:99999;'+
    'padding:8px 14px;border-radius:14px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;'+
    'backdrop-filter:blur(12px);pointer-events:none;opacity:0;transition:opacity .2s';
  $('stage').appendChild(t);
  requestAnimationFrame(()=>t.style.opacity='1');
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},1600);
}

/* ------------ Galerie — IndexedDB (stockage des fichiers importés) ------------ */
const GAL_DB_NAME = 'horizonGallery', GAL_STORE = 'galMedia';
function galOpenDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(GAL_DB_NAME,1);
    req.onupgradeneeded = e=>{ e.target.result.createObjectStore(GAL_STORE); };
    req.onsuccess = e=>res(e.target.result);
    req.onerror = ()=>rej(req.error);
  });
}
async function galSaveBlob(blob, key){
  try{
    const db = await galOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(GAL_STORE,'readwrite');
      tx.objectStore(GAL_STORE).put(blob, key);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}
async function galLoadBlob(key){
  try{
    const db = await galOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(GAL_STORE,'readonly');
      const req = tx.objectStore(GAL_STORE).get(key);
      req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);
    });
  }catch(e){ return null; }
}
async function galDeleteBlob(key){
  try{
    const db = await galOpenDB();
    return new Promise((res,rej)=>{
      const tx = db.transaction(GAL_STORE,'readwrite');
      tx.objectStore(GAL_STORE).delete(key);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }catch(e){ return false; }
}

/* ------------ localStorage (métadonnées) + IndexedDB (fichiers) ------------ */
function saveUserMedia(){
  try{
    // On ne sauvegarde jamais l'URL blob (elle expire) — seulement les métadonnées.
    const meta = state.userMedia.map(({url, ...rest}) => rest);
    localStorage.setItem('horizonUserMedia', JSON.stringify(meta));
  }catch(_){}
}
function loadUserMedia(){
  try{
    const raw = localStorage.getItem('horizonUserMedia');
    if(raw){ state.userMedia = JSON.parse(raw); }
  }catch(_){}
  // Recharge les fichiers réels depuis IndexedDB et régénère des URL fraîches
  if(state.userMedia && state.userMedia.length){
    (async () => {
      let changed = false;
      for(const item of state.userMedia){
        try{
          const blob = await galLoadBlob(item.id);
          if(blob){ item.url = URL.createObjectURL(blob); changed = true; }
        }catch(_){}
      }
      if(changed) renderHUD();
    })();
  }
}
loadUserMedia();

/* User Content persistence */
function saveUserContent(){
  try{ localStorage.setItem('horizonUserContent', JSON.stringify(state.userContent)); }catch(_){}
}
function loadUserContent(){
  try{
    const raw = localStorage.getItem('horizonUserContent');
    if(raw){ state.userContent = JSON.parse(raw); }
  }catch(_){}
}
loadUserContent();
loadDisneyUserContent();
loadATVUserContent();

/* Load saved game icons & card covers */
try{ const gi = localStorage.getItem('horizonGLGameIcons'); if(gi) state.glGameIcons = JSON.parse(gi); }catch(_){}
try{ const nc = localStorage.getItem('horizonNFCardCovers'); if(nc) state.nfCardCovers = JSON.parse(nc); }catch(_){}
try{ const dc = localStorage.getItem('horizonDisneyCardCovers'); if(dc) state.disneyCardCovers = JSON.parse(dc); }catch(_){}
try{ const ac = localStorage.getItem('horizonATVCardCovers'); if(ac) state.atvCardCovers = JSON.parse(ac); }catch(_){}

