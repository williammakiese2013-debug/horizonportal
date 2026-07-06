/* ============================================================
   LES SIMS 3 VR — Jeu complet adapté VR/360 split-screen
   ============================================================ */

/* ---------- État du jeu Sims 3 ---------- */
const sims3State = {
  open: false,
  screen: 'mainmenu', // 'mainmenu' | 'create' | 'neighborhood' | 'live' | 'build' | 'buy' | 'skills' | 'career' | 'relationships' | 'inventory'
  sim: null,
  day: 1,
  hour: 8,
  minute: 0,
  timeSpeed: 1, // 1=normal, 2=fast, 3=ultrafast, 0=pause
  timeInterval: null,
  needs: { hunger:80, energy:90, fun:60, social:50, hygiene:70, bladder:85, comfort:75, environment:65 },
  skills: { cooking:2, charisma:1, logic:3, athletic:1, painting:0, music:0, gardening:0, fishing:0, writing:0, science:0 },
  career: { name:'Aucune', level:0, salary:0, daysWorked:0 },
  simoleons: 15000,
  moodlets: [],
  relationships: [],
  inventory: [],
  household: [],
  lot: { name:'Maison de départ', rooms:['Salon','Cuisine','Chambre','Salle de bain'], furniture:12 },
  actions: [],
  currentAction: null,
  actionProgress: 0,
  notification: null,
  notifTimer: null,
  buildMode: false,
  buyCategory: 'seating',
  selectedFurniture: null,
  savedSims: [],
  createForm: { name:'', gender:'female', skin:1, hair:'brun', top:'casual', aspiration:'bonheur', trait1:'sympathique', trait2:'curieux', trait3:'ambitieux' },
  lifeStage: 'adult',
  aspiration: 0,
  aspirationMax: 100,
};

/* ---------- Données Sims 3 ---------- */
const SIMS3_CAREERS = [
  { id:'none',     name:'Aucune',        icon:'🏠', maxLevel:0, salaries:[0] },
  { id:'business', name:'Business',      icon:'💼', maxLevel:10, salaries:[250,420,600,800,1050,1300,1600,2000,2500,3200] },
  { id:'science',  name:'Science',       icon:'🔬', maxLevel:10, salaries:[300,480,650,850,1100,1380,1700,2100,2600,3300] },
  { id:'military', name:'Militaire',     icon:'🎖️', maxLevel:10, salaries:[200,350,520,720,950,1200,1500,1900,2400,3000] },
  { id:'culinary', name:'Culinaire',     icon:'👨‍🍳', maxLevel:10, salaries:[280,440,620,820,1080,1350,1650,2050,2550,3250] },
  { id:'law',      name:'Droit',         icon:'⚖️', maxLevel:10, salaries:[350,550,750,950,1200,1500,1850,2300,2850,3600] },
  { id:'medical',  name:'Médecine',      icon:'🏥', maxLevel:10, salaries:[400,600,820,1020,1280,1580,1950,2450,3000,3800] },
  { id:'music',    name:'Musique',       icon:'🎵', maxLevel:10, salaries:[200,320,460,620,820,1050,1320,1680,2100,2700] },
];

const SIMS3_SKILLS = [
  { id:'cooking',   name:'Cuisine',      icon:'🍳', max:10 },
  { id:'charisma',  name:'Charisme',     icon:'💬', max:10 },
  { id:'logic',     name:'Logique',      icon:'♟️', max:10 },
  { id:'athletic',  name:'Athlétisme',   icon:'💪', max:10 },
  { id:'painting',  name:'Peinture',     icon:'🎨', max:10 },
  { id:'music',     name:'Musique',      icon:'🎹', max:10 },
  { id:'gardening', name:'Jardinage',    icon:'🌱', max:10 },
  { id:'fishing',   name:'Pêche',        icon:'🎣', max:10 },
  { id:'writing',   name:'Écriture',     icon:'✍️', max:10 },
  { id:'science',   name:'Science',      icon:'🔭', max:10 },
];

const SIMS3_MOODLETS = [
  { id:'wellrested', name:'Reposé',       icon:'😴', mood:+20, duration:4 },
  { id:'tasty',      name:'Bon repas',    icon:'😋', mood:+15, duration:3 },
  { id:'fun',        name:'Amusant',      icon:'😄', mood:+10, duration:2 },
  { id:'lonely',     name:'Solitaire',    icon:'😔', mood:-15, duration:6 },
  { id:'hungry',     name:'Faim',         icon:'😤', mood:-20, duration:2 },
  { id:'dirty',      name:'Sale',         icon:'🤢', mood:-10, duration:3 },
  { id:'inspired',   name:'Inspiré',      icon:'✨', mood:+25, duration:5 },
  { id:'focused',    name:'Concentré',    icon:'🧠', mood:+20, duration:4 },
];

const SIMS3_INTERACTIONS = [
  // Besoins
  { id:'eat',       name:'Manger',       icon:'🍽️', target:'hunger',   amount:40, time:30, skill:null },
  { id:'sleep',     name:'Dormir',       icon:'🛏️', target:'energy',   amount:60, time:60, skill:null },
  { id:'shower',    name:'Douche',       icon:'🚿', target:'hygiene',  amount:50, time:20, skill:null },
  { id:'toilet',    name:'Toilette',     icon:'🚽', target:'bladder',  amount:70, time:10, skill:null },
  { id:'tv',        name:'Regarder TV',  icon:'📺', target:'fun',      amount:25, time:40, skill:null },
  { id:'socialize', name:'Socialiser',   icon:'💬', target:'social',   amount:35, time:30, skill:null },
  // Compétences
  { id:'cook',      name:'Cuisiner',     icon:'🍳', target:'cooking',  amount:1,  time:45, skill:'cooking' },
  { id:'chess',     name:'Jeu d\'échecs',icon:'♟️', target:'logic',    amount:1,  time:40, skill:'logic' },
  { id:'workout',   name:'Sport',        icon:'💪', target:'athletic', amount:1,  time:50, skill:'athletic' },
  { id:'paint',     name:'Peindre',      icon:'🎨', target:'painting', amount:1,  time:50, skill:'painting' },
  { id:'piano',     name:'Piano',        icon:'🎹', target:'music',    amount:1,  time:45, skill:'music' },
  { id:'garden',    name:'Jardiner',     icon:'🌱', target:'gardening',amount:1,  time:40, skill:'gardening' },
  { id:'fish',      name:'Pêcher',       icon:'🎣', target:'fishing',  amount:1,  time:60, skill:'fishing' },
  { id:'write',     name:'Écrire',       icon:'✍️', target:'writing',  amount:1,  time:55, skill:'writing' },
  { id:'microscope',name:'Microscope',   icon:'🔭', target:'science',  amount:1,  time:50, skill:'science' },
  { id:'mirror',    name:'Parler miroir',icon:'🪞', target:'charisma', amount:1,  time:30, skill:'charisma' },
  // Argent
  { id:'freelance', name:'Freelance',    icon:'💻', target:'simoleons',amount:200,time:120,skill:null },
];

const SIMS3_BUY_ITEMS = {
  seating:    [{ id:'sofa', name:'Canapé Luxe', icon:'🛋️', price:1200 },{ id:'chair', name:'Chaise Design', icon:'🪑', price:450 },{ id:'recliner', name:'Fauteuil', icon:'🪑', price:800 }],
  beds:       [{ id:'singlebed', name:'Lit Simple', icon:'🛏️', price:900 },{ id:'doublebed', name:'Lit Double', icon:'🛏️', price:1500 },{ id:'kingbed', name:'Lit King', icon:'🛏️', price:2400 }],
  cooking:    [{ id:'stove', name:'Cuisinière', icon:'🍳', price:1800 },{ id:'fridge', name:'Réfrigérateur', icon:'🧊', price:1200 },{ id:'microwave', name:'Micro-ondes', icon:'📦', price:400 }],
  electronics:[{ id:'tv', name:'Smart TV', icon:'📺', price:2200 },{ id:'computer', name:'PC Gaming', icon:'💻', price:3000 },{ id:'stereo', name:'Chaîne Hi-Fi', icon:'🎵', price:800 }],
  outdoor:    [{ id:'pond', name:'Étang', icon:'🌊', price:3000 },{ id:'bbq', name:'BBQ', icon:'🔥', price:600 },{ id:'garden', name:'Jardin fleuri', icon:'🌸', price:1500 }],
  decorations:[{ id:'painting', name:'Tableau', icon:'🖼️', price:300 },{ id:'bookcase', name:'Bibliothèque', icon:'📚', price:700 },{ id:'fireplace', name:'Cheminée', icon:'🔥', price:1200 }],
};

const SIMS3_TRAITS = [
  'sympathique','curieux','ambitieux','artiste','sportif','charismatique',
  'intellectuel','romantique','paresseux','gourmand','propre','maladroit',
];

const SIMS3_ASPIRATIONS = [
  { id:'bonheur',    name:'Bonheur',        icon:'😊' },
  { id:'richesse',   name:'Richesse',       icon:'💰' },
  { id:'romance',    name:'Romance',        icon:'❤️' },
  { id:'connaissance',name:'Connaissance',  icon:'📚' },
  { id:'famille',    name:'Famille',        icon:'👨‍👩‍👧' },
  { id:'popularite', name:'Popularité',     icon:'⭐' },
];

const SIMS3_NEIGHBORHOODS = [
  { id:'sunset', name:'Sunset Valley', icon:'🌅', desc:'La ville de départ classique', pop:82 },
  { id:'riverview', name:'Riverview', icon:'🌊', desc:'Au bord de la rivière', pop:64 },
  { id:'ambitions', name:'Twinbrook', icon:'🏭', desc:'Ville industrielle mystérieuse', pop:71 },
];

const SIMS3_LOTFURNITURE = [
  '🛋️ Canapé','🛏️ Lit','🍳 Cuisinière','🧊 Réfrigérateur','📺 Télévision',
  '🚿 Douche','🚽 WC','🪑 Chaises × 4','🍽️ Table à manger','💻 Ordinateur',
  '📚 Bibliothèque','🪴 Plantes','🔥 Cheminée','🎹 Piano',
];

/* ---------- Fonctions utilitaires Sims 3 ---------- */
function sims3TimeStr(){
  const h = sims3State.hour;
  const m = sims3State.minute < 10 ? '0'+sims3State.minute : sims3State.minute;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h-12 : h;
  return `${h12}:${m} ${ampm}`;
}

function sims3DayStr(){
  const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  return days[(sims3State.day - 1) % 7];
}

function sims3Notify(msg){
  sims3State.notification = msg;
  clearTimeout(sims3State.notifTimer);
  sims3State.notifTimer = setTimeout(()=>{ sims3State.notification = null; renderSims3(); }, 3500);
  renderSims3();
}

function sims3Mood(){
  const n = sims3State.needs;
  const avg = (n.hunger + n.energy + n.fun + n.social + n.hygiene + n.bladder + n.comfort + n.environment) / 8;
  const moodletBonus = sims3State.moodlets.reduce((a,m)=>{
    const def = SIMS3_MOODLETS.find(x=>x.id===m.id);
    return a + (def ? def.mood : 0);
  }, 0);
  return Math.max(0, Math.min(100, avg + moodletBonus / 5));
}

function sims3MoodEmoji(){
  const m = sims3Mood();
  if(m >= 85) return '😁';
  if(m >= 70) return '😊';
  if(m >= 50) return '😐';
  if(m >= 30) return '😟';
  return '😭';
}

function sims3NeedColor(val){
  if(val >= 65) return '#22c55e';
  if(val >= 35) return '#f59e0b';
  return '#ef4444';
}

function sims3SkillStars(val, max){
  let s = '';
  for(let i=0;i<max;i++) s += i < val ? '★' : '☆';
  return s;
}

function sims3StartTime(){
  if(sims3State.timeInterval) return;
  sims3State.timeInterval = setInterval(()=>{
    if(!sims3State.open || sims3State.screen !== 'live') return;
    if(sims3State.timeSpeed === 0) return;
    // Advance time
    sims3State.minute += 5 * sims3State.timeSpeed;
    if(sims3State.minute >= 60){ sims3State.minute -= 60; sims3State.hour++; }
    if(sims3State.hour >= 24){ sims3State.hour = 0; sims3State.day++; }
    // Degrade needs slowly
    const deg = 0.3 * sims3State.timeSpeed;
    const n = sims3State.needs;
    n.hunger    = Math.max(0, n.hunger    - deg * 0.8);
    n.energy    = Math.max(0, n.energy    - deg * 0.5);
    n.fun       = Math.max(0, n.fun       - deg * 0.4);
    n.social    = Math.max(0, n.social    - deg * 0.3);
    n.hygiene   = Math.max(0, n.hygiene   - deg * 0.6);
    n.bladder   = Math.max(0, n.bladder   - deg * 1.0);
    n.comfort   = Math.max(0, n.comfort   - deg * 0.2);
    n.environment = Math.max(0, n.environment - deg * 0.1);
    // Action progress
    if(sims3State.currentAction){
      sims3State.actionProgress += 2 * sims3State.timeSpeed;
      if(sims3State.actionProgress >= 100){
        const act = SIMS3_INTERACTIONS.find(a=>a.id===sims3State.currentAction);
        if(act){
          if(act.skill){
            const cur = sims3State.skills[act.skill] || 0;
            if(cur < 10) sims3State.skills[act.skill] = Math.min(10, cur + 0.3);
          } else if(act.target === 'simoleons'){
            sims3State.simoleons += act.amount;
            sims3Notify(`💰 +${act.amount}§ gagnés !`);
          } else {
            const need = sims3State.needs[act.target];
            if(need !== undefined) sims3State.needs[act.target] = Math.min(100, need + act.amount);
          }
          // Add random moodlet
          if(Math.random() > 0.6){
            const posM = ['wellrested','tasty','fun','inspired','focused'];
            const mid = posM[Math.floor(Math.random()*posM.length)];
            if(!sims3State.moodlets.find(x=>x.id===mid)){
              sims3State.moodlets.push({ id:mid, hoursLeft: SIMS3_MOODLETS.find(x=>x.id===mid)?.duration || 3 });
            }
          }
          sims3Notify(`✅ ${act.name} terminé !`);
        }
        sims3State.currentAction = null;
        sims3State.actionProgress = 0;
      }
    }
    // Moodlet tick
    sims3State.moodlets = sims3State.moodlets.filter(m=>{
      m.hoursLeft -= 0.02 * sims3State.timeSpeed;
      return m.hoursLeft > 0;
    });
    // Hunger critical
    if(n.hunger < 5 && !sims3State.moodlets.find(x=>x.id==='hungry')){
      sims3State.moodlets.push({ id:'hungry', hoursLeft: 2 });
      sims3Notify('⚠️ Ton Sim a faim !');
    }
    renderSims3();
  }, 500);
}

function sims3StopTime(){
  if(sims3State.timeInterval){ clearInterval(sims3State.timeInterval); sims3State.timeInterval = null; }
}

/* ---------- Ouverture / Fermeture ---------- */
function openSims3VR(){
  sims3State.open = true;
  sims3State.screen = 'loading';
  state.activeApp = 'sims3';
  state.menuHidden = false;
  state.appMaximized = true;
  renderSims3();
  // Simulate loading progress then go to launcher
  let progress = 0;
  const LOADING_TIPS = [
    'Milking cowplants','Loading Sims DNA','Building Sunset Valley',
    'Planting cowplants','Waking up Sims','Generating neighborhoods',
    'Calibrating plumbobs','Filling swimming pools','Teaching cooking skills',
    'Downloading personalities','Initializing careers','Watering gardens',
  ];
  let tipIdx = Math.floor(Math.random() * LOADING_TIPS.length);
  sims3State.loadingTip = LOADING_TIPS[tipIdx];
  sims3State.loadingProgress = 0;
  renderSims3();
  const iv = setInterval(()=>{
    progress += Math.random() * 18 + 4;
    if(progress >= 100) progress = 100;
    sims3State.loadingProgress = Math.round(progress);
    // Change tip occasionally
    if(Math.random() < 0.3){
      tipIdx = (tipIdx + 1) % LOADING_TIPS.length;
      sims3State.loadingTip = LOADING_TIPS[tipIdx];
    }
    renderSims3();
    if(progress >= 100){
      clearInterval(iv);
      setTimeout(()=>{
        sims3State.screen = 'mainmenu';
        renderSims3();
      }, 600);
    }
  }, 280);
}

function closeSims3VR(){
  sims3State.open = false;
  sims3StopTime();
  const el = document.getElementById('sims3-overlay');
  if(el) el.remove();
  if(state.activeApp === 'sims3') state.activeApp = null;
  renderHUD();
}

/* ---------- Builders HTML ---------- */
function buildSims3MainMenu(){
  return `
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:28px;
    background:linear-gradient(135deg,#0a2a0a 0%,#1a3a1a 40%,#0f2a0f 100%);">
    <!-- Logo Sims 3 -->
    <div style="text-align:center">
      <div style="font-size:56px;filter:drop-shadow(0 0 24px #22c55e88)">🏠</div>
      <div style="font-size:32px;font-weight:900;color:#22c55e;letter-spacing:2px;margin-top:8px;
        text-shadow:0 0 30px #22c55e,0 2px 8px rgba(0,0,0,0.8)">Les Sims™ 3</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:4px;margin-top:4px">ÉDITION VR</div>
    </div>
    <!-- Boutons menu -->
    <div style="display:flex;flex-direction:column;gap:12px;width:220px">
      <div data-gaze data-action="sims3:goto:neighborhood"
        style="padding:14px 20px;border-radius:14px;text-align:center;cursor:pointer;font-weight:700;font-size:14px;
        background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;
        box-shadow:0 4px 20px rgba(34,197,94,0.4)">
        🎮 Jouer
      </div>
      <div data-gaze data-action="sims3:goto:create"
        style="padding:14px 20px;border-radius:14px;text-align:center;cursor:pointer;font-weight:700;font-size:14px;
        background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:#fff">
        👤 Créer un Sim
      </div>
      <div data-gaze data-action="sims3:close"
        style="padding:12px 20px;border-radius:14px;text-align:center;cursor:pointer;font-size:13px;
        background:rgba(255,80,80,0.15);border:1px solid rgba(255,80,80,0.4);color:rgba(255,150,150,0.9)">
        ✕ Quitter
      </div>
    </div>
    <!-- Décorations -->
    <div style="position:absolute;bottom:16px;font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:1px">
      © Les Sims 3 VR Edition — Horizon VR Portal
    </div>
  </div>`;
}

function buildSims3Create(){
  const f = sims3State.createForm;
  const skins = [['#8B5E3C','Mate'],['#F5CBA7','Clair'],['#D4A470','Doré'],['#FDEBD0','Pâle']];
  const hairs = ['brun','blond','roux','noir','gris'];
  const hairColors = {brun:'#6B3A2A',blond:'#F0C040',roux:'#C84020',noir:'#1a1a1a',gris:'#909090'};
  const skinColor = ['#8B5E3C','#F5CBA7','#D4A470','#FDEBD0'][f.skin-1] || '#D4A470';
  const hairColor = hairColors[f.hair] || '#6B3A2A';
  const isFemale = f.gender === 'female';
  // Plumbob color based on aspiration
  const plumbobColors = {bonheur:'#22c55e',richesse:'#eab308',romance:'#ec4899',connaissance:'#3b82f6',famille:'#f97316',popularite:'#a855f7'};
  const pb = plumbobColors[f.aspiration] || '#22c55e';

  return `
  <div style="height:100%;display:flex;background:linear-gradient(135deg,#d0dff0 0%,#b8d0ec 50%,#c8daf0 100%);overflow:hidden">
    <!-- Left: controls panel -->
    <div style="width:200px;flex-shrink:0;background:rgba(100,140,190,0.25);
      border-right:2px solid rgba(100,150,200,0.4);padding:10px 8px;overflow-y:auto;
      backdrop-filter:blur(8px)">
      <div style="font-size:13px;font-weight:800;color:#224;margin-bottom:10px;
        text-shadow:0 1px 2px rgba(255,255,255,0.5)">👤 Créer un Sim</div>
      <!-- Nom -->
      <div style="margin-bottom:8px">
        <div style="font-size:9px;color:rgba(30,50,80,.7);font-weight:700;margin-bottom:3px;letter-spacing:.5px">NOM</div>
        <div style="background:rgba(255,255,255,0.6);border:1px solid rgba(100,150,200,0.5);
          border-radius:8px;padding:7px 10px;font-size:11px;color:${f.name?'#224':'rgba(50,80,120,.4)'}">
          ${f.name || 'Cliquez pour nommer…'}</div>
      </div>
      <!-- Genre -->
      <div style="margin-bottom:8px">
        <div style="font-size:9px;color:rgba(30,50,80,.7);font-weight:700;margin-bottom:4px;letter-spacing:.5px">GENRE</div>
        <div style="display:flex;gap:5px">
          <div data-gaze data-action="sims3:create:gender:female"
            style="flex:1;padding:6px;border-radius:8px;text-align:center;cursor:pointer;font-size:11px;font-weight:700;
            background:${isFemale?'rgba(220,60,120,0.25)':'rgba(255,255,255,0.3)'};
            border:2px solid ${isFemale?'#ec4899':'rgba(150,180,220,0.5)'};color:#224">♀ F</div>
          <div data-gaze data-action="sims3:create:gender:male"
            style="flex:1;padding:6px;border-radius:8px;text-align:center;cursor:pointer;font-size:11px;font-weight:700;
            background:${!isFemale?'rgba(60,100,220,0.25)':'rgba(255,255,255,0.3)'};
            border:2px solid ${!isFemale?'#3b82f6':'rgba(150,180,220,0.5)'};color:#224">♂ H</div>
        </div>
      </div>
      <!-- Teint -->
      <div style="margin-bottom:8px">
        <div style="font-size:9px;color:rgba(30,50,80,.7);font-weight:700;margin-bottom:4px;letter-spacing:.5px">TEINT</div>
        <div style="display:flex;gap:4px">
          ${skins.map(([c,n],i)=>`<div data-gaze data-action="sims3:create:skin:${i+1}"
            style="flex:1;height:26px;border-radius:6px;background:${c};cursor:pointer;
            border:2px solid ${f.skin===i+1?'#2244aa':'rgba(255,255,255,0.4)'};
            box-shadow:${f.skin===i+1?'0 0 8px rgba(34,68,170,0.5)':'none'}"></div>`).join('')}
        </div>
      </div>
      <!-- Cheveux -->
      <div style="margin-bottom:8px">
        <div style="font-size:9px;color:rgba(30,50,80,.7);font-weight:700;margin-bottom:4px;letter-spacing:.5px">CHEVEUX</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px">
          ${hairs.map(h=>`<div data-gaze data-action="sims3:create:hair:${h}"
            style="padding:4px 7px;border-radius:6px;font-size:9px;cursor:pointer;font-weight:700;
            background:${f.hair===h?'rgba(34,68,170,0.2)':'rgba(255,255,255,0.4)'};
            border:1px solid ${f.hair===h?'#2244aa':'rgba(150,180,220,0.4)'};color:#224">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hairColors[h]};
              vertical-align:middle;margin-right:2px;border:1px solid rgba(0,0,0,0.2)"></span>${h}</div>`).join('')}
        </div>
      </div>
      <!-- Aspiration -->
      <div style="margin-bottom:8px">
        <div style="font-size:9px;color:rgba(30,50,80,.7);font-weight:700;margin-bottom:4px;letter-spacing:.5px">ASPIRATION</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
          ${SIMS3_ASPIRATIONS.map(a=>`<div data-gaze data-action="sims3:create:aspiration:${a.id}"
            style="padding:5px 4px;border-radius:7px;text-align:center;cursor:pointer;font-size:9px;font-weight:700;
            background:${f.aspiration===a.id?'rgba(34,68,170,0.2)':'rgba(255,255,255,0.35)'};
            border:1px solid ${f.aspiration===a.id?'#2244aa':'rgba(150,180,220,0.4)'};color:#224">
            ${a.icon} ${a.name}</div>`).join('')}
        </div>
      </div>
      <!-- Traits -->
      <div style="margin-bottom:10px">
        <div style="font-size:9px;color:rgba(30,50,80,.7);font-weight:700;margin-bottom:4px;letter-spacing:.5px">TRAITS (3 max)</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px">
          ${SIMS3_TRAITS.map(t=>{
            const sel = [f.trait1,f.trait2,f.trait3].includes(t);
            return `<div data-gaze data-action="sims3:create:trait:${t}"
              style="padding:3px 7px;border-radius:6px;font-size:9px;cursor:pointer;font-weight:600;
              background:${sel?'rgba(34,68,170,0.25)':'rgba(255,255,255,0.35)'};
              border:1px solid ${sel?'#2244aa':'rgba(150,180,220,0.4)'};color:#224">
              ${t.charAt(0).toUpperCase()+t.slice(1)}</div>`;
          }).join('')}
        </div>
      </div>
      <!-- Boutons -->
      <div style="display:flex;gap:6px">
        <div data-gaze data-action="sims3:create:confirm"
          style="flex:1;padding:9px;border-radius:10px;text-align:center;cursor:pointer;font-weight:800;font-size:12px;
          background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;
          box-shadow:0 3px 12px rgba(34,197,94,0.4)">✅ Créer</div>
        <div data-gaze data-action="sims3:goto:mainmenu"
          style="padding:9px 12px;border-radius:10px;cursor:pointer;font-size:11px;font-weight:700;
          background:rgba(255,255,255,0.4);border:1px solid rgba(150,180,220,0.5);color:#224">← Retour</div>
      </div>
    </div>

    <!-- Center: 3D CSS Character -->
    <div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative;
      background:linear-gradient(180deg,#c8daf4 0%,#d8eafc 40%,#b8ccdc 100%)">
      <!-- Mirror frame -->
      <div style="position:absolute;left:0;top:0;bottom:0;width:8px;
        background:linear-gradient(90deg,rgba(180,200,230,0.8),transparent)"></div>
      <!-- Character platform -->
      <div style="position:relative;display:flex;flex-direction:column;align-items:center">
        <!-- Plumbob above head -->
        <div style="margin-bottom:6px;filter:drop-shadow(0 3px 8px ${pb}88)">
          <div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:18px solid ${pb};margin:0 auto"></div>
          <div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:16px solid ${pb}aa;margin:0 auto;margin-top:-2px"></div>
        </div>
        <!-- HEAD -->
        <div style="position:relative;width:${isFemale?'54':'56'}px;height:${isFemale?'62':'64'}px;
          background:${skinColor};border-radius:${isFemale?'50% 50% 45% 45%':'48% 48% 42% 42%'};
          box-shadow:inset -6px -4px 12px rgba(0,0,0,0.15),2px 4px 8px rgba(0,0,0,0.2)">
          <!-- Hair -->
          <div style="position:absolute;top:-10px;left:-4px;right:-4px;height:${isFemale?'36':'28'}px;
            background:${hairColor};border-radius:${isFemale?'50% 50% 30% 30%':'46% 46% 0 0'};
            box-shadow:inset 0 2px 6px rgba(255,255,255,0.2)"></div>
          ${isFemale ? `<!-- Female hair sides -->
          <div style="position:absolute;top:10px;left:-8px;width:12px;height:38px;
            background:${hairColor};border-radius:50% 0 40% 40%"></div>
          <div style="position:absolute;top:10px;right:-8px;width:12px;height:38px;
            background:${hairColor};border-radius:0 50% 40% 40%"></div>` : ''}
          <!-- Eyes -->
          <div style="position:absolute;top:28px;left:12px;width:10px;height:7px;
            background:#1a1a2e;border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,0.4)">
            <div style="width:4px;height:4px;background:#fff;border-radius:50%;position:absolute;top:1px;right:1px"></div>
          </div>
          <div style="position:absolute;top:28px;right:12px;width:10px;height:7px;
            background:#1a1a2e;border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,0.4)">
            <div style="width:4px;height:4px;background:#fff;border-radius:50%;position:absolute;top:1px;right:1px"></div>
          </div>
          <!-- Eyebrows -->
          <div style="position:absolute;top:22px;left:10px;width:13px;height:3px;
            background:${hairColor};border-radius:2px;transform:rotate(-5deg)"></div>
          <div style="position:absolute;top:22px;right:10px;width:13px;height:3px;
            background:${hairColor};border-radius:2px;transform:rotate(5deg)"></div>
          <!-- Nose -->
          <div style="position:absolute;top:38px;left:50%;transform:translateX(-50%);
            width:6px;height:5px;border-bottom:2px solid rgba(0,0,0,0.15);border-radius:0 0 3px 3px"></div>
          <!-- Mouth -->
          <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);
            width:14px;height:5px;border-bottom:2px solid rgba(180,60,60,0.6);border-radius:0 0 8px 8px"></div>
          ${isFemale ? `<div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);
            width:10px;height:3px;background:rgba(220,80,80,0.4);border-radius:3px"></div>` : ''}
        </div>
        <!-- NECK -->
        <div style="width:20px;height:12px;background:${skinColor};
          box-shadow:inset -2px 0 4px rgba(0,0,0,0.1)"></div>
        <!-- BODY - Torso -->
        <div style="position:relative;width:${isFemale?'70':'76'}px;height:${isFemale?'72':'76'}px;
          background:${isFemale?'#9090d8':'#6080c0'};
          border-radius:${isFemale?'12px 12px 8px 8px':'10px 10px 6px 6px'};
          box-shadow:inset -6px -4px 12px rgba(0,0,0,0.2),2px 2px 8px rgba(0,0,0,0.25)">
          <!-- Collar / shirt detail -->
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);
            width:24px;height:14px;background:rgba(255,255,255,0.15);border-radius:0 0 40% 40%"></div>
          ${isFemale ? `<!-- Female shirt shape -->
          <div style="position:absolute;top:36px;left:0;right:0;height:36px;
            background:${isFemale?'#8888cc':'#5070b0'};border-radius:0 0 8px 8px"></div>` : ''}
          <!-- ARMS -->
          <!-- Left arm -->
          <div style="position:absolute;top:4px;left:-14px;width:14px;height:56px;
            background:${isFemale?'#9090d8':'#6080c0'};border-radius:${isFemale?'6px':'4px'};
            transform:rotate(${isFemale?'4':'6'}deg);
            box-shadow:inset -2px -2px 6px rgba(0,0,0,0.2)">
            <!-- Left hand -->
            <div style="position:absolute;bottom:-8px;left:1px;width:12px;height:10px;
              background:${skinColor};border-radius:50% 50% 40% 40%"></div>
          </div>
          <!-- Right arm -->
          <div style="position:absolute;top:4px;right:-14px;width:14px;height:56px;
            background:${isFemale?'#9090d8':'#6080c0'};border-radius:${isFemale?'6px':'4px'};
            transform:rotate(-${isFemale?'4':'6'}deg);
            box-shadow:inset 2px -2px 6px rgba(0,0,0,0.2)">
            <!-- Right hand -->
            <div style="position:absolute;bottom:-8px;right:1px;width:12px;height:10px;
              background:${skinColor};border-radius:50% 50% 40% 40%"></div>
          </div>
        </div>
        <!-- LEGS -->
        <div style="display:flex;gap:6px;position:relative">
          <!-- Left leg -->
          <div style="position:relative">
            <div style="width:${isFemale?'28':'31'}px;height:${isFemale?'68':'72'}px;
              background:#2a3a5a;border-radius:4px;
              box-shadow:inset -3px -3px 8px rgba(0,0,0,0.3)"></div>
            <!-- Left shoe -->
            <div style="width:${isFemale?'26':'32'}px;height:10px;
              background:#1a1a2a;border-radius:${isFemale?'50%':'4px'} ${isFemale?'40%':'4px'} 4px 4px;
              margin-top:-2px;${isFemale?'margin-left:-1px;':''}
              box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>
          </div>
          <!-- Right leg -->
          <div style="position:relative">
            <div style="width:${isFemale?'28':'31'}px;height:${isFemale?'68':'72'}px;
              background:#2a3a5a;border-radius:4px;
              box-shadow:inset -3px -3px 8px rgba(0,0,0,0.3)"></div>
            <!-- Right shoe -->
            <div style="width:${isFemale?'26':'32'}px;height:10px;
              background:#1a1a2a;border-radius:${isFemale?'50%':'4px'} ${isFemale?'40%':'4px'} 4px 4px;
              margin-top:-2px;
              box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>
          </div>
        </div>
        <!-- Shadow under feet -->
        <div style="width:80px;height:10px;border-radius:50%;
          background:rgba(0,0,0,0.15);margin-top:4px;filter:blur(3px)"></div>
        <!-- Name tag -->
        <div style="margin-top:8px;background:rgba(255,255,255,0.7);border:1px solid rgba(100,150,200,0.4);
          border-radius:10px;padding:4px 14px;font-size:11px;font-weight:700;color:#224;
          text-align:center;backdrop-filter:blur(4px)">
          ${f.name || '— Entrez un nom —'}
        </div>
        <!-- Traits display -->
        ${[f.trait1,f.trait2,f.trait3].filter(Boolean).length > 0 ? `
        <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center">
          ${[f.trait1,f.trait2,f.trait3].filter(Boolean).map(t=>`
          <div style="padding:2px 8px;border-radius:8px;font-size:8px;font-weight:700;
            background:rgba(34,68,170,0.2);border:1px solid rgba(100,140,220,0.5);color:#224">
            ${t}</div>`).join('')}
        </div>` : ''}
      </div>
      <!-- Mirror backdrop reflection -->
      <div style="position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%,rgba(200,220,240,0.05) 100%)"></div>
    </div>

    <!-- Right: UI controls panel (sliders like image 3) -->
    <div style="width:140px;flex-shrink:0;background:rgba(80,120,180,0.2);
      border-left:2px solid rgba(100,150,200,0.3);padding:10px 8px;overflow-y:auto">
      <div style="font-size:9px;font-weight:700;color:rgba(30,50,80,.7);margin-bottom:8px;letter-spacing:.5px">APPARENCE</div>
      <!-- Sliders style image 3 -->
      ${[['Taille','height'],['Poids','weight'],['Visage','face'],['Corps','body']].map(([label,key])=>`
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:9px;color:rgba(30,50,80,.7);font-weight:700">${label}</span>
        </div>
        <div style="height:4px;border-radius:2px;background:rgba(100,140,200,0.3);position:relative">
          <div style="position:absolute;top:-4px;left:50%;transform:translateX(-50%);
            width:12px;height:12px;border-radius:50%;background:#fff;
            border:2px solid rgba(80,120,190,0.7);cursor:pointer;
            box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>
          <div style="height:100%;width:50%;background:linear-gradient(90deg,rgba(80,120,200,0.5),rgba(100,160,240,0.7));border-radius:2px"></div>
        </div>
      </div>`).join('')}
      <!-- Makeup/extras for female -->
      ${isFemale ? `
      <div style="margin-top:4px;margin-bottom:8px">
        <div style="font-size:9px;font-weight:700;color:rgba(30,50,80,.7);margin-bottom:5px;letter-spacing:.5px">MAQUILLAGE</div>
        ${[['Rouge à lèvres','#e05050'],['Fond de teint','#d4a070'],['Fard à paupières','#8080d0']].map(([m,c])=>`
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
          <div style="width:14px;height:14px;border-radius:3px;background:${c};border:1px solid rgba(0,0,0,0.15)"></div>
          <span style="font-size:9px;color:rgba(30,50,80,.7)">${m}</span>
        </div>`).join('')}
      </div>` : `
      <div style="margin-top:4px;margin-bottom:8px">
        <div style="font-size:9px;font-weight:700;color:rgba(30,50,80,.7);margin-bottom:5px;letter-spacing:.5px">PILOSITÉ</div>
        ${[['Barbe','Aucune'],['Moustache','Aucune']].map(([m,v])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:9px;color:rgba(30,50,80,.7)">${m}</span>
          <span style="font-size:9px;color:#2244aa;font-weight:700">${v}</span>
        </div>`).join('')}
      </div>`}
      <!-- Vêtements -->
      <div style="font-size:9px;font-weight:700;color:rgba(30,50,80,.7);margin-bottom:5px;letter-spacing:.5px">TENUES</div>
      ${['Quotidien','Sport','Soirée','Nuit'].map((t,i)=>`
      <div style="padding:5px 7px;border-radius:6px;margin-bottom:3px;cursor:pointer;font-size:9px;font-weight:700;
        background:${i===0?'rgba(34,68,170,0.2)':'rgba(255,255,255,0.3)'};
        border:1px solid ${i===0?'#2244aa':'rgba(150,180,220,0.4)'};color:#224">
        ${['👗','👟','👔','🩲'][i]} ${t}</div>`).join('')}
    </div>
  </div>`;
}

function buildSims3Neighborhood(){
  return `
  <div style="overflow-y:auto;height:100%;padding:16px;
    background:linear-gradient(135deg,#0a1628 0%,#162a3a 50%,#0a2010 100%);">
    <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:6px">🗺️ Choisir un quartier</div>
    <div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:16px">Sélectionne où ton Sim va vivre</div>
    ${SIMS3_NEIGHBORHOODS.map(nb=>`
      <div data-gaze data-action="sims3:neighborhood:${nb.id}"
        style="padding:16px;border-radius:14px;margin-bottom:10px;cursor:pointer;
        background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
        transition:background .15s;display:flex;align-items:center;gap:14px">
        <div style="font-size:38px">${nb.icon}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#fff">${nb.name}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px">${nb.desc}</div>
          <div style="font-size:10px;color:#22c55e;margin-top:4px">👥 ${nb.pop} Sims résidents</div>
        </div>
        <div style="margin-left:auto;font-size:20px;opacity:.5">›</div>
      </div>`).join('')}
    <div style="margin-top:8px">
      <div data-gaze data-action="sims3:goto:mainmenu"
        style="padding:10px;border-radius:10px;text-align:center;cursor:pointer;font-size:12px;
        background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,.6)">
        ← Retour au menu
      </div>
    </div>
  </div>`;
}

function buildSims3Live(){
  const s = sims3State;
  const n = s.needs;
  const mood = sims3Mood();
  const moodEmoji = sims3MoodEmoji();
  const moodColor = mood >= 70 ? '#22c55e' : mood >= 40 ? '#f59e0b' : '#ef4444';
  const sim = s.sim || { name:'Sim', gender:'female' };
  const speedLabels = ['⏸','▶','⏩','⏫'];

  const needsHTML = Object.entries({
    '🍔':['hunger','Faim'],
    '⚡':['energy','Énergie'],
    '🎮':['fun','Loisir'],
    '💬':['social','Social'],
    '🚿':['hygiene','Hygiène'],
    '🚽':['bladder','Besoins'],
    '🛋️':['comfort','Confort'],
    '🌿':['environment','Environ.'],
  }).map(([ico,[key,label]])=>`
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
      <span style="font-size:11px;width:14px">${ico}</span>
      <div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,0.15);overflow:hidden">
        <div style="height:100%;width:${Math.round(n[key]||0)}%;background:${sims3NeedColor(n[key]||0)};border-radius:3px;transition:width .3s"></div>
      </div>
      <span style="font-size:8px;color:rgba(255,255,255,.5);width:28px;text-align:right">${Math.round(n[key]||0)}%</span>
    </div>`).join('');

  const moodletsHTML = s.moodlets.length > 0
    ? s.moodlets.slice(0,4).map(m=>{
        const def = SIMS3_MOODLETS.find(x=>x.id===m.id);
        if(!def) return '';
        return `<div style="display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:8px;
          background:${def.mood>0?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};
          border:1px solid ${def.mood>0?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}">
          <span style="font-size:11px">${def.icon}</span>
          <span style="font-size:9px;color:rgba(255,255,255,.8)">${def.name}</span>
          <span style="font-size:9px;color:${def.mood>0?'#4ade80':'#f87171'}">${def.mood>0?'+':''}${def.mood}</span>
        </div>`;
      }).join('')
    : `<div style="font-size:10px;color:rgba(255,255,255,.3)">Aucun moodlet actif</div>`;

  const actionsHTML = SIMS3_INTERACTIONS.slice(0, 8).map(act=>`
    <div data-gaze data-action="sims3:do:${act.id}"
      style="padding:8px 10px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:7px;
      background:${s.currentAction===act.id?'rgba(34,197,94,0.25)':'rgba(255,255,255,0.06)'};
      border:1px solid ${s.currentAction===act.id?'rgba(34,197,94,0.5)':'rgba(255,255,255,0.1)'}">
      <span style="font-size:14px">${act.icon}</span>
      <span style="font-size:11px;font-weight:600;color:#fff">${act.name}</span>
      ${s.currentAction===act.id ? `<div style="margin-left:auto;width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);overflow:hidden"><div style="height:100%;width:${Math.round(s.actionProgress)}%;background:#22c55e"></div></div>` : ''}
    </div>`).join('');

  const skillsHTML = SIMS3_SKILLS.slice(0,5).map(sk=>`
    <div style="margin-bottom:5px">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:9px;color:rgba(255,255,255,.7)">${sk.icon} ${sk.name}</span>
        <span style="font-size:9px;color:#22c55e">${Math.floor(s.skills[sk.id]||0)}/10</span>
      </div>
      <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.12);overflow:hidden">
        <div style="height:100%;width:${Math.floor((s.skills[sk.id]||0)/10*100)}%;background:#22c55e;transition:width .3s"></div>
      </div>
    </div>`).join('');

  return `
  <div style="display:flex;height:100%;gap:0;background:linear-gradient(135deg,#0a1a0a 0%,#112211 100%);">
    <!-- Panneau gauche : Sim + besoins -->
    <div style="width:170px;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.08);
      padding:12px 10px;display:flex;flex-direction:column;gap:8px;overflow-y:auto">
      <!-- Avatar + humeur -->
      <div style="text-align:center">
        <div style="width:64px;height:64px;border-radius:50%;margin:0 auto 6px;
          background:linear-gradient(135deg,#22c55e,#16a34a);
          display:flex;align-items:center;justify-content:center;font-size:32px;
          box-shadow:0 0 20px ${moodColor}55">
          ${sim.gender==='female'?'👩':'👨'}
        </div>
        <div style="font-size:12px;font-weight:700;color:#fff">${sim.name || 'Ton Sim'}</div>
        <div style="font-size:20px;margin:2px 0">${moodEmoji}</div>
        <!-- Jauge humeur -->
        <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.15);overflow:hidden;margin:4px 0">
          <div style="height:100%;width:${Math.round(mood)}%;background:${moodColor};transition:width .3s"></div>
        </div>
        <div style="font-size:9px;color:${moodColor}">${Math.round(mood)}% humeur</div>
      </div>
      <!-- Simoleons -->
      <div style="background:rgba(255,210,50,0.1);border:1px solid rgba(255,210,50,0.3);
        border-radius:8px;padding:6px 10px;text-align:center">
        <div style="font-size:10px;color:rgba(255,255,255,.5)">Simoleons</div>
        <div style="font-size:14px;font-weight:700;color:#fde047">§${s.simoleons.toLocaleString()}</div>
      </div>
      <!-- Jour / Heure -->
      <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:6px;text-align:center">
        <div style="font-size:10px;color:rgba(255,255,255,.5)">${sims3DayStr()} — Jour ${s.day}</div>
        <div style="font-size:14px;font-weight:700;color:#fff;margin-top:2px">⏰ ${sims3TimeStr()}</div>
        <!-- Contrôle vitesse -->
        <div style="display:flex;gap:3px;justify-content:center;margin-top:6px">
          ${[0,1,2,3].map(sp=>`<div data-gaze data-action="sims3:speed:${sp}"
            style="padding:3px 7px;border-radius:6px;font-size:10px;cursor:pointer;
            background:${s.timeSpeed===sp?'rgba(34,197,94,0.4)':'rgba(255,255,255,0.07)'};
            border:1px solid ${s.timeSpeed===sp?'#22c55e':'rgba(255,255,255,0.1)'}">
            ${speedLabels[sp]}</div>`).join('')}
        </div>
      </div>
      <!-- Besoins -->
      <div>
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.8px;margin-bottom:6px">BESOINS</div>
        ${needsHTML}
      </div>
      <!-- Moodlets -->
      <div>
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.8px;margin-bottom:5px">MOODLETS</div>
        <div style="display:flex;flex-direction:column;gap:3px">${moodletsHTML}</div>
      </div>
    </div>

    <!-- Centre : maison + actions -->
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
      <!-- Vue maison 3D stylisée -->
      <div style="flex:1;position:relative;overflow:hidden;
        background:linear-gradient(180deg,#0d3b2e 0%,#1a4a2a 30%,#2a6a3a 60%,#3a8a4a 100%)">
        <!-- Ciel -->
        <div style="position:absolute;top:0;left:0;right:0;height:45%;
          background:linear-gradient(180deg,#0a1628 0%,#1a3040 50%,#0d3b2e 100%)">
          <!-- Étoiles -->
          ${Array.from({length:12},(_,i)=>`<div style="position:absolute;width:${Math.random()>0.7?3:2}px;height:${Math.random()>0.7?3:2}px;border-radius:50%;
            background:rgba(255,255,255,${0.4+Math.random()*0.6});
            top:${Math.random()*90}%;left:${Math.random()*100}%"></div>`).join('')}
          <!-- Soleil/Lune selon l'heure -->
          <div style="position:absolute;top:${s.hour>=7&&s.hour<20?'20':'35'}%;left:${30+Math.min(70,(s.hour-6)/14*100)}%;
            font-size:24px;filter:drop-shadow(0 0 12px ${s.hour>=7&&s.hour<20?'#fbbf24':'#e0e7ff'})">
            ${s.hour>=7&&s.hour<20?'☀️':'🌙'}</div>
        </div>
        <!-- Sol -->
        <div style="position:absolute;bottom:0;left:0;right:0;height:38%;
          background:linear-gradient(180deg,#2d6a4f 0%,#1b4332 100%)">
          <!-- Herbe déco -->
          <div style="position:absolute;top:0;left:0;right:0;height:14px;
            background:linear-gradient(180deg,#40916c,#2d6a4f);border-radius:4px 4px 0 0"></div>
          <div style="position:absolute;top:4px;left:8%;font-size:14px">🌿</div>
          <div style="position:absolute;top:4px;left:18%;font-size:12px">🌸</div>
          <div style="position:absolute;top:4px;right:14%;font-size:14px">🌿</div>
          <div style="position:absolute;top:4px;right:24%;font-size:12px">🌼</div>
          <!-- Arbre -->
          <div style="position:absolute;top:-30px;right:10%;font-size:40px">🌳</div>
          <div style="position:absolute;top:-20px;left:6%;font-size:30px">🌲</div>
        </div>
        <!-- Maison principale -->
        <div style="position:absolute;bottom:35%;left:50%;transform:translateX(-50%)">
          <!-- Toit -->
          <div style="width:0;height:0;border-left:90px solid transparent;border-right:90px solid transparent;
            border-bottom:60px solid #8B4513;margin-bottom:-2px"></div>
          <!-- Corps maison -->
          <div style="width:180px;background:linear-gradient(180deg,#D2691E,#A0522D);
            padding:0 0 8px;border-radius:0 0 6px 6px">
            <!-- Fenêtres + porte -->
            <div style="display:flex;justify-content:space-around;padding:10px 12px 0">
              <div style="width:30px;height:28px;background:linear-gradient(135deg,#7dd3fc,#38bdf8);
                border:2px solid rgba(255,255,255,.3);border-radius:3px"></div>
              <div style="width:28px;height:40px;background:linear-gradient(180deg,#a16207,#78350f);
                border:2px solid rgba(255,255,255,.2);border-radius:3px 3px 0 0;margin-top:auto"></div>
              <div style="width:30px;height:28px;background:linear-gradient(135deg,#7dd3fc,#38bdf8);
                border:2px solid rgba(255,255,255,.3);border-radius:3px"></div>
            </div>
          </div>
        </div>
        <!-- Action en cours overlay -->
        ${s.currentAction ? `
        <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,0.7);border-radius:10px;padding:7px 14px;
          border:1px solid rgba(34,197,94,0.4);min-width:160px;text-align:center">
          <div style="font-size:11px;color:#4ade80;font-weight:600">
            ${SIMS3_INTERACTIONS.find(a=>a.id===s.currentAction)?.icon} En cours…
          </div>
          <div style="height:5px;border-radius:3px;background:rgba(255,255,255,.15);margin-top:4px;overflow:hidden">
            <div style="height:100%;width:${Math.round(s.actionProgress)}%;background:#22c55e;transition:width .3s"></div>
          </div>
        </div>` : ''}
        <!-- Notification -->
        ${s.notification ? `
        <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,0.85);border-radius:12px;padding:8px 16px;
          border:1px solid rgba(34,197,94,0.5);font-size:12px;font-weight:600;color:#fff;
          white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.5)">
          ${s.notification}
        </div>` : ''}
        <!-- Barre outils Live -->
        <div style="position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:4px">
          <div data-gaze data-action="sims3:goto:build"
            style="width:34px;height:34px;border-radius:9px;background:rgba(0,0,0,0.6);
            border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;
            cursor:pointer;font-size:16px" title="Mode Construction">🏗️</div>
          <div data-gaze data-action="sims3:goto:buy"
            style="width:34px;height:34px;border-radius:9px;background:rgba(0,0,0,0.6);
            border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;
            cursor:pointer;font-size:16px" title="Acheter des meubles">🛒</div>
          <div data-gaze data-action="sims3:goto:skills"
            style="width:34px;height:34px;border-radius:9px;background:rgba(0,0,0,0.6);
            border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;
            cursor:pointer;font-size:16px" title="Compétences">⭐</div>
          <div data-gaze data-action="sims3:goto:career"
            style="width:34px;height:34px;border-radius:9px;background:rgba(0,0,0,0.6);
            border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;
            cursor:pointer;font-size:16px" title="Carrière">💼</div>
          <div data-gaze data-action="sims3:goto:relationships"
            style="width:34px;height:34px;border-radius:9px;background:rgba(0,0,0,0.6);
            border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;
            cursor:pointer;font-size:16px" title="Relations">❤️</div>
        </div>
      </div>
      <!-- Barre d'actions style Sims 3 image 4: bulles flottantes autour du Sim -->
      <div style="height:150px;background:linear-gradient(180deg,rgba(10,20,10,0.7),rgba(5,10,5,0.85));
        border-top:1px solid rgba(255,255,255,0.1);position:relative;overflow:hidden">
        <!-- HUD bottom bar like Sims 3 screenshot -->
        <div style="display:flex;height:100%;gap:0">
          <!-- Sim portrait + plumbob area -->
          <div style="width:100px;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.08);
            display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;
            background:rgba(0,0,0,0.3)">
            <div style="width:52px;height:52px;border-radius:8px;
              background:linear-gradient(135deg,#4a8a3a,#2a6a1a);
              display:flex;align-items:center;justify-content:center;font-size:28px;
              border:2px solid rgba(34,197,94,0.4);margin-bottom:3px">
              ${sim.gender==='female'?'👩':'👨'}</div>
            <div style="font-size:8px;color:rgba(255,255,255,.6);text-align:center;
              max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sim.name||'Sim'}</div>
            <div style="font-size:16px;margin-top:2px">${moodEmoji}</div>
          </div>
          <!-- Floating action bubbles -->
          <div style="flex:1;position:relative;overflow:hidden">
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
              <!-- Interaction bubble groups (like the pie menu / radial bubbles in image 4) -->
              <div style="position:relative;width:100%;height:100%;padding:8px 6px">
                <!-- Row 1: Primary needs actions -->
                <div style="display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap">
                  ${SIMS3_INTERACTIONS.slice(0,6).map(act=>`
                  <div data-gaze data-action="sims3:do:${act.id}"
                    style="padding:5px 9px;border-radius:12px;cursor:pointer;
                    background:${s.currentAction===act.id
                      ? 'linear-gradient(135deg,rgba(34,197,94,0.5),rgba(22,163,74,0.4))'
                      : 'linear-gradient(135deg,rgba(60,90,60,0.7),rgba(40,70,40,0.6))'};
                    border:1px solid ${s.currentAction===act.id?'rgba(34,197,94,0.8)':'rgba(100,180,100,0.3)'};
                    display:flex;align-items:center;gap:4px;
                    box-shadow:${s.currentAction===act.id?'0 0 8px rgba(34,197,94,0.4)':'0 1px 4px rgba(0,0,0,0.4)'}">
                    <span style="font-size:13px">${act.icon}</span>
                    <span style="font-size:10px;font-weight:700;color:#fff;white-space:nowrap">${act.name}</span>
                    ${s.currentAction===act.id ? `<div style="width:24px;height:3px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden"><div style="height:100%;width:${Math.round(s.actionProgress)}%;background:#22c55e"></div></div>` : ''}
                  </div>`).join('')}
                </div>
                <!-- Row 2: Skills actions -->
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  ${SIMS3_INTERACTIONS.slice(6,12).map(act=>`
                  <div data-gaze data-action="sims3:do:${act.id}"
                    style="padding:5px 9px;border-radius:12px;cursor:pointer;
                    background:${s.currentAction===act.id
                      ? 'linear-gradient(135deg,rgba(34,197,94,0.5),rgba(22,163,74,0.4))'
                      : 'linear-gradient(135deg,rgba(40,70,90,0.7),rgba(30,55,75,0.6))'};
                    border:1px solid ${s.currentAction===act.id?'rgba(34,197,94,0.8)':'rgba(80,140,180,0.3)'};
                    display:flex;align-items:center;gap:4px;
                    box-shadow:${s.currentAction===act.id?'0 0 8px rgba(34,197,94,0.4)':'0 1px 4px rgba(0,0,0,0.4)'}">
                    <span style="font-size:13px">${act.icon}</span>
                    <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.85);white-space:nowrap">${act.name}</span>
                  </div>`).join('')}
                </div>
              </div>
            </div>
          </div>
          <!-- Right: needs mini panel (like bottom right of image 4) -->
          <div style="width:160px;flex-shrink:0;border-left:1px solid rgba(255,255,255,0.08);
            padding:6px 8px;background:rgba(0,0,0,0.2)">
            <div style="font-size:8px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:.5px;margin-bottom:4px">BESOINS</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px">
              ${Object.entries({'🍔':['hunger','Faim'],'⚡':['energy','Énergie'],'🎮':['fun','Loisir'],
                '💬':['social','Social'],'🚿':['hygiene','Hygiène'],'🚽':['bladder','Besoins'],
                '🛋️':['comfort','Confort'],'🌿':['environ.','environment']}).slice(0,8).map(([ico,[key,label]])=>`
              <div style="display:flex;align-items:center;gap:3px">
                <span style="font-size:9px">${ico}</span>
                <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.12);overflow:hidden">
                  <div style="height:100%;width:${Math.round(n[key]||n[label?.toLowerCase()]||0)}%;
                    background:${sims3NeedColor(n[key]||n[label?.toLowerCase()]||0)};border-radius:2px"></div>
                </div>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Panneau droit : compétences + navigation -->
    <div style="width:150px;flex-shrink:0;border-left:1px solid rgba(255,255,255,0.08);
      padding:12px 10px;display:flex;flex-direction:column;gap:10px;overflow-y:auto">
      <!-- Compétences top 5 -->
      <div>
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.8px;margin-bottom:6px">COMPÉTENCES</div>
        ${skillsHTML}
        <div data-gaze data-action="sims3:goto:skills"
          style="margin-top:6px;font-size:9px;color:#22c55e;cursor:pointer;text-align:right">Tout voir ›</div>
      </div>
      <!-- Carrière -->
      <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:8px">
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.8px;margin-bottom:4px">CARRIÈRE</div>
        <div style="font-size:12px;font-weight:600;color:#fff">${s.career.icon||'🏠'} ${s.career.name}</div>
        ${s.career.level > 0 ? `
          <div style="font-size:10px;color:#4ade80;margin-top:2px">Niveau ${s.career.level}</div>
          <div style="font-size:10px;color:#fde047;margin-top:1px">§${s.career.salary}/j</div>` : 
          `<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:2px">Aucune carrière</div>`}
        <div data-gaze data-action="sims3:goto:career"
          style="margin-top:6px;font-size:9px;color:#22c55e;cursor:pointer">Gérer ›</div>
      </div>
      <!-- Bouton quitter -->
      <div data-gaze data-action="sims3:goto:mainmenu"
        style="padding:8px;border-radius:10px;text-align:center;cursor:pointer;font-size:11px;
        background:rgba(255,80,80,0.15);border:1px solid rgba(255,80,80,0.35);color:rgba(255,180,180,.9);
        margin-top:auto">
        ← Menu
      </div>
    </div>
  </div>`;
}

function buildSims3Build(){
  const rooms = sims3State.lot.rooms;
  const s = sims3State;
  return `
  <div style="overflow-y:auto;height:100%;padding:16px;
    background:linear-gradient(135deg,#1a0a2e 0%,#2a1a3e 100%);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:16px;font-weight:800;color:#fff">🏗️ Mode Construction</div>
      <div data-gaze data-action="sims3:goto:live"
        style="padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;
        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,.8)">← Retour</div>
    </div>
    <!-- Pièces existantes -->
    <div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:8px">PIÈCES DU LOT — ${s.lot.name}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${rooms.map(r=>`
        <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.12);text-align:center">
          <div style="font-size:20px;margin-bottom:4px">${
            {'Salon':'🛋️','Cuisine':'🍳','Chambre':'🛏️','Salle de bain':'🚿',
             'Bureau':'💻','Garage':'🚗','Jardin':'🌿','Cave':'🪣'}[r]||'🏠'}</div>
          <div style="font-size:11px;font-weight:600;color:#fff">${r}</div>
        </div>`).join('')}
    </div>
    <!-- Ajouter pièce -->
    <div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:8px">AJOUTER UNE PIÈCE</div>
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px">
      ${['Bureau','Garage','Jardin','Cave','Bibliothèque','Salle de sport'].map(r=>`
        <div data-gaze data-action="sims3:build:addroom:${r}"
          style="padding:8px 12px;border-radius:10px;cursor:pointer;font-size:11px;
          background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.4);color:rgba(220,200,255,.9)">
          ＋ ${r} <span style="color:#fde047;font-size:10px">(§${({Bureau:2500,Garage:4000,Jardin:1500,Cave:2000,Bibliothèque:3000,'Salle de sport':3500})[r]})</span>
        </div>`).join('')}
    </div>
    <!-- Meubles installés -->
    <div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:8px">MEUBLES INSTALLÉS</div>
    <div style="display:flex;flex-direction:column;gap:5px">
      ${SIMS3_LOTFURNITURE.slice(0, s.lot.furniture).map(f=>`
        <div style="padding:8px 12px;border-radius:9px;background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.1);font-size:11px;color:rgba(255,255,255,.8)">${f}</div>`).join('')}
    </div>
    <div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,.3)">${s.lot.furniture}/${SIMS3_LOTFURNITURE.length} meubles</div>
  </div>`;
}

function buildSims3Buy(){
  const s = sims3State;
  const cats = Object.keys(SIMS3_BUY_ITEMS);
  const catLabels = {seating:'Sièges',beds:'Lits',cooking:'Cuisine',electronics:'Électronique',outdoor:'Extérieur',decorations:'Déco'};
  const catIcons  = {seating:'🛋️',beds:'🛏️',cooking:'🍳',electronics:'📺',outdoor:'🌿',decorations:'🖼️'};
  const items = SIMS3_BUY_ITEMS[s.buyCategory] || [];
  return `
  <div style="height:100%;display:flex;flex-direction:column;
    background:linear-gradient(135deg,#0a1a2e 0%,#1a2a3e 100%);">
    <!-- Header -->
    <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);
      display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:15px;font-weight:800;color:#fff">🛒 Acheter des meubles</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;color:#fde047;font-weight:700">§${s.simoleons.toLocaleString()}</span>
        <div data-gaze data-action="sims3:goto:live"
          style="padding:5px 10px;border-radius:8px;cursor:pointer;font-size:11px;
          background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,.8)">← Retour</div>
      </div>
    </div>
    <!-- Catégories -->
    <div style="display:flex;gap:6px;padding:8px 12px;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.06)">
      ${cats.map(c=>`<div data-gaze data-action="sims3:buy:cat:${c}"
        style="padding:5px 12px;border-radius:10px;font-size:11px;cursor:pointer;white-space:nowrap;
        background:${s.buyCategory===c?'rgba(34,197,94,0.25)':'rgba(255,255,255,0.07)'};
        border:1px solid ${s.buyCategory===c?'#22c55e':'rgba(255,255,255,0.1)'}">
        ${catIcons[c]} ${catLabels[c]}</div>`).join('')}
    </div>
    <!-- Articles -->
    <div style="flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px">
      ${items.map(it=>`
        <div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:12px">
          <div style="font-size:32px">${it.icon}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:#fff">${it.name}</div>
            <div style="font-size:11px;color:#fde047;margin-top:2px">§${it.price}</div>
          </div>
          <div data-gaze data-action="sims3:buy:item:${it.id}:${it.price}"
            style="padding:8px 14px;border-radius:10px;cursor:pointer;font-size:11px;font-weight:700;
            background:${s.simoleons >= it.price ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.08)'};
            color:${s.simoleons >= it.price ? '#fff' : 'rgba(255,255,255,.35)'}">
            Acheter
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

function buildSims3Skills(){
  const s = sims3State;
  return `
  <div style="overflow-y:auto;height:100%;padding:16px;
    background:linear-gradient(135deg,#1a1a0a 0%,#2a2a10 100%);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:16px;font-weight:800;color:#fff">⭐ Compétences</div>
      <div data-gaze data-action="sims3:goto:live"
        style="padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;
        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,.8)">← Retour</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${SIMS3_SKILLS.map(sk=>{
        const val = Math.floor(s.skills[sk.id] || 0);
        const pct = (s.skills[sk.id]||0)/10*100;
        return `
        <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="font-size:22px">${sk.icon}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:#fff">${sk.name}</div>
              <div style="font-size:10px;color:rgba(255,255,255,.5)">Niveau ${val} / ${sk.max}</div>
            </div>
            <div style="font-size:14px;color:#fbbf24;letter-spacing:-1px">${sims3SkillStars(val, Math.min(val+1,5))}</div>
          </div>
          <div style="height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden">
            <div style="height:100%;width:${pct.toFixed(1)}%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:4px;transition:width .3s"></div>
          </div>
          ${val >= 10 ? `<div style="font-size:9px;color:#4ade80;margin-top:4px">✅ Maîtrisé !</div>` : 
            `<div style="font-size:9px;color:rgba(255,255,255,.35);margin-top:4px">${(10-(s.skills[sk.id]||0)).toFixed(1)} points pour le prochain niveau</div>`}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function buildSims3Career(){
  const s = sims3State;
  return `
  <div style="overflow-y:auto;height:100%;padding:16px;
    background:linear-gradient(135deg,#0a1a2e 0%,#102030 100%);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:16px;font-weight:800;color:#fff">💼 Carrière</div>
      <div data-gaze data-action="sims3:goto:live"
        style="padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;
        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,.8)">← Retour</div>
    </div>
    <!-- Carrière actuelle -->
    ${s.career.level > 0 ? `
      <div style="padding:16px;border-radius:14px;margin-bottom:16px;
        background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3)">
        <div style="font-size:24px;margin-bottom:6px">${s.career.icon||'💼'}</div>
        <div style="font-size:15px;font-weight:700;color:#fff">${s.career.name}</div>
        <div style="font-size:12px;color:#4ade80;margin-top:3px">Niveau ${s.career.level} / 10</div>
        <div style="font-size:12px;color:#fde047;margin-top:2px">Salaire : §${s.career.salary} / jour</div>
        <div style="height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${s.career.level * 10}%;background:#22c55e;transition:width .3s"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <div data-gaze data-action="sims3:career:work"
            style="flex:1;padding:8px;border-radius:10px;text-align:center;cursor:pointer;
            background:rgba(34,197,94,0.2);border:1px solid rgba(34,197,94,0.4);font-size:12px;font-weight:700;color:#fff">
            ▶ Travailler (+§${s.career.salary})
          </div>
          <div data-gaze data-action="sims3:career:quit"
            style="padding:8px 14px;border-radius:10px;cursor:pointer;
            background:rgba(255,80,80,0.15);border:1px solid rgba(255,80,80,0.3);font-size:11px;color:rgba(255,180,180,.9)">
            Démissionner
          </div>
        </div>
      </div>` :
      `<div style="padding:14px;border-radius:12px;margin-bottom:16px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);text-align:center;
        color:rgba(255,255,255,.4);font-size:12px">Aucune carrière — Choisissez ci-dessous</div>`}
    <!-- Liste carrières -->
    <div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:8px">OFFRES D'EMPLOI</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${SIMS3_CAREERS.filter(c=>c.id!=='none').map(c=>`
        <div data-gaze data-action="sims3:career:join:${c.id}"
          style="padding:12px 14px;border-radius:12px;cursor:pointer;
          background:${s.career.id===c.id?'rgba(34,197,94,0.1)':'rgba(255,255,255,.05)'};
          border:1px solid ${s.career.id===c.id?'rgba(34,197,94,0.4)':'rgba(255,255,255,.1)'};
          display:flex;align-items:center;gap:12px">
          <div style="font-size:28px">${c.icon}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:#fff">${c.name}</div>
            <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:2px">Départ : §${c.salaries[0]}/j · Max : §${c.salaries[9]}/j</div>
          </div>
          ${s.career.id===c.id?`<div style="font-size:10px;color:#4ade80;font-weight:700">✓ Actif</div>`:''}
        </div>`).join('')}
    </div>
  </div>`;
}

function buildSims3Relationships(){
  const s = sims3State;
  const defaultNPCs = [
    { id:1, name:'Clara Martin',   emoji:'👩', relation:'Amie',      score:72, status:'online' },
    { id:2, name:'Paul Dupont',    emoji:'👨', relation:'Voisin',    score:45, status:'offline' },
    { id:3, name:'Sophie Bernard', emoji:'👩', relation:'Collègue',  score:88, status:'online' },
    { id:4, name:'Marc Rousseau',  emoji:'👨', relation:'Inconnu',   score:20, status:'offline' },
    { id:5, name:'Julie Blanc',    emoji:'👩', relation:'Meilleure amie', score:95, status:'online' },
  ];
  const rels = s.relationships.length > 0 ? s.relationships : defaultNPCs;
  return `
  <div style="overflow-y:auto;height:100%;padding:16px;
    background:linear-gradient(135deg,#2a0a1e 0%,#3a1030 100%);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:16px;font-weight:800;color:#fff">❤️ Relations</div>
      <div data-gaze data-action="sims3:goto:live"
        style="padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;
        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,.8)">← Retour</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${rels.map(r=>{
        const relColor = r.score>=80?'#f43f5e':r.score>=50?'#f59e0b':'#6b7280';
        return `
        <div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
          display:flex;align-items:center;gap:12px">
          <div style="position:relative">
            <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,${relColor},${relColor}88);
              display:flex;align-items:center;justify-content:center;font-size:22px">${r.emoji}</div>
            <div style="position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;
              background:${r.status==='online'?'#22c55e':'#6b7280'};border:2px solid #2a0a1e"></div>
          </div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:#fff">${r.name}</div>
            <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:1px">${r.relation}</div>
            <div style="height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:5px;overflow:hidden">
              <div style="height:100%;width:${r.score}%;background:${relColor};transition:width .3s"></div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;font-weight:700;color:${relColor}">${r.score}%</div>
            <div data-gaze data-action="sims3:rel:talk:${r.id}"
              style="margin-top:6px;padding:4px 8px;border-radius:7px;cursor:pointer;font-size:9px;
              background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.8)">
              💬 Parler
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <!-- Rencontrer de nouvelles personnes -->
    <div data-gaze data-action="sims3:rel:meet"
      style="margin-top:12px;padding:12px;border-radius:12px;text-align:center;cursor:pointer;
      background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);font-size:12px;font-weight:600;color:#fb7185">
      ＋ Rencontrer de nouvelles personnes
    </div>
  </div>`;
}

function buildSims3Loading(){
  const p = sims3State.loadingProgress || 0;
  const tip = sims3State.loadingTip || 'Loading...';
  return `
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;
    background:radial-gradient(ellipse at center,#d6e8f8 0%,#b8d4ee 40%,#c8dff5 100%);position:relative;overflow:hidden">
    <!-- Soft glow center -->
    <div style="position:absolute;width:320px;height:320px;border-radius:50%;
      background:radial-gradient(circle,rgba(255,255,255,0.7) 0%,transparent 70%);
      top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none"></div>
    <!-- Plumbob diamond CSS -->
    <div style="position:relative;width:90px;height:110px;margin-bottom:28px;filter:drop-shadow(0 6px 24px rgba(100,160,220,0.5))">
      <!-- Top triangle -->
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:33px solid transparent;
        border-right:33px solid transparent;
        border-bottom:52px solid rgba(140,185,230,0.9)"></div>
      <!-- Middle left facet -->
      <div style="position:absolute;top:40px;left:10px;
        width:0;height:0;
        border-right:35px solid rgba(160,205,245,0.85);
        border-top:18px solid transparent;
        border-bottom:26px solid transparent"></div>
      <!-- Middle right facet -->
      <div style="position:absolute;top:40px;right:10px;
        width:0;height:0;
        border-left:35px solid rgba(110,160,210,0.9);
        border-top:18px solid transparent;
        border-bottom:26px solid transparent"></div>
      <!-- Bottom point -->
      <div style="position:absolute;top:58px;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:33px solid transparent;
        border-right:33px solid transparent;
        border-top:52px solid rgba(130,178,225,0.88)"></div>
      <!-- Highlight -->
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:10px solid transparent;
        border-right:10px solid transparent;
        border-bottom:18px solid rgba(255,255,255,0.45)"></div>
    </div>
    <!-- The Sims 3 logo text -->
    <div style="font-family:Georgia,serif;margin-bottom:8px;text-align:center;position:relative">
      <span style="font-size:11px;color:rgba(140,140,160,0.7);letter-spacing:1px;font-style:italic">The </span>
      <span style="font-size:38px;font-weight:900;color:rgba(180,185,195,0.85);
        text-shadow:2px 2px 0 rgba(255,255,255,0.6),-1px -1px 0 rgba(150,155,165,0.5);
        letter-spacing:-1px;font-style:italic">SIms</span>
      <span style="font-size:22px;font-weight:900;color:rgba(160,165,175,0.8);vertical-align:super;
        font-style:italic">3</span>
    </div>
    <!-- Progress bar area -->
    <div style="margin-top:40px;width:340px;max-width:80vw">
      <div style="height:10px;border-radius:5px;background:rgba(180,200,220,0.4);overflow:hidden;
        box-shadow:inset 0 1px 3px rgba(0,0,0,0.15)">
        <div style="height:100%;width:${p}%;
          background:linear-gradient(90deg,rgba(100,155,210,0.7),rgba(130,185,240,0.9));
          border-radius:5px;transition:width 0.25s ease"></div>
      </div>
    </div>
    <!-- Tip text -->
    <div style="margin-top:16px;font-size:12px;font-weight:600;color:rgba(80,90,110,0.75);
      letter-spacing:0.5px">${tip}</div>
  </div>`;
}

function buildSims3Launcher(){
  // Game Launcher fidèle à l'image 2
  const news = [
    { icon:'⭐', text:'CONTENU GRATUIT ! Seulement ce week-end !' },
    { icon:'ℹ️', text:'Nouveau terrain disponible dans le Store !' },
    { icon:'⭐', text:'Contenu gratuit de Futureshock Living !' },
    { icon:'ℹ️', text:'Les coffrets cadeaux Sims 3 Store sont de retour !' },
  ];
  return `
  <div style="height:100%;background:linear-gradient(180deg,#b8d4f0 0%,#a0c4e8 100%);display:flex;flex-direction:column;
    font-family:Arial,sans-serif;overflow:hidden">
    <!-- Title bar -->
    <div style="background:linear-gradient(180deg,#8ab0d4,#6890b8);padding:5px 12px;
      display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #5070a0">
      <span style="font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.5)">The Sims 3 Game Launcher</span>
      <div style="display:flex;gap:4px">
        <div style="width:18px;height:18px;background:linear-gradient(#c0d8f0,#90b0d0);border:1px solid #608;border-radius:2px;
          display:flex;align-items:center;justify-content:center;font-size:9px;color:#446;cursor:pointer">─</div>
        <div style="width:18px;height:18px;background:linear-gradient(#c0d8f0,#90b0d0);border:1px solid #608;border-radius:2px;
          display:flex;align-items:center;justify-content:center;font-size:9px;color:#446;cursor:pointer">□</div>
        <div data-gaze data-action="sims3:close"
          style="width:18px;height:18px;background:linear-gradient(#e08080,#c06060);border:1px solid #a04040;border-radius:2px;
          display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;cursor:pointer;font-weight:700">✕</div>
      </div>
    </div>
    <!-- Main area -->
    <div style="flex:1;display:flex;overflow:hidden">
      <!-- Left sidebar -->
      <div style="width:140px;flex-shrink:0;background:linear-gradient(180deg,#6888b0 0%,#5070a0 100%);
        display:flex;flex-direction:column;align-items:center;padding:14px 8px;gap:10px">
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:6px">
          <div style="font-size:8px;color:rgba(255,255,255,0.7);font-style:italic">The</div>
          <div style="font-size:20px;font-weight:900;color:#fff;font-style:italic;
            text-shadow:0 0 10px rgba(100,200,100,0.6),2px 2px 4px rgba(0,0,0,0.4)">SIms<sup style="font-size:11px">3</sup></div>
        </div>
        <!-- Play button - big green -->
        <div data-gaze data-action="sims3:launcher:play"
          style="width:72px;height:72px;border-radius:50%;cursor:pointer;
          background:radial-gradient(circle at 35% 35%,#60c860,#208820);
          box-shadow:0 4px 16px rgba(0,0,0,0.4),0 0 0 4px rgba(255,255,255,0.2),inset 0 2px 4px rgba(255,255,255,0.3);
          display:flex;align-items:center;justify-content:center">
          <div style="width:0;height:0;border-left:22px solid rgba(255,255,255,0.95);
            border-top:14px solid transparent;border-bottom:14px solid transparent;margin-left:4px"></div>
        </div>
        <!-- Nav buttons -->
        <div style="width:100%;display:flex;flex-direction:column;gap:3px;margin-top:8px">
          ${[['sims3:launcher:welcome','Bienvenue'],['sims3:launcher:downloads','Téléchargements'],
             ['sims3:launcher:uploads','Envois'],['sims3:launcher:installed','Contenu installé'],
             ['sims3:launcher:updates','Mises à jour du jeu']].map(([a,label])=>`
          <div data-gaze data-action="${a}"
            style="padding:7px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:700;
            color:#fff;text-align:center;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);
            text-shadow:0 1px 2px rgba(0,0,0,0.5)">${label}</div>`).join('')}
        </div>
        <!-- Version -->
        <div style="margin-top:auto;font-size:8px;color:rgba(255,255,255,0.5);text-align:center">Version:<br>1.63.4.024017</div>
      </div>
      <!-- Center panel -->
      <div style="flex:1;display:flex;flex-direction:column;background:#c8dff5;overflow:hidden">
        <!-- Stay Connected / Exchange bar -->
        <div style="background:linear-gradient(180deg,#d8eafc,#c0d8f0);padding:10px 12px;
          border-bottom:1px solid #a0c0e0;display:flex;gap:12px;align-items:flex-start">
          <!-- Avatar + login -->
          <div style="display:flex;gap:8px;align-items:center">
            <div style="width:48px;height:48px;background:linear-gradient(#a0c0e0,#8090b0);border:2px solid #8090b0;
              border-radius:4px;display:flex;align-items:center;justify-content:center">
              <div style="font-size:24px;opacity:0.4">?</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#446;margin-bottom:4px">Rester connecté !</div>
              <div data-gaze data-action="sims3:launcher:login"
                style="padding:4px 14px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:700;
                background:linear-gradient(#e8f4ff,#c8dcf0);border:1px solid #90b0d0;color:#336;
                box-shadow:0 2px 4px rgba(0,0,0,0.15)">Connexion</div>
              <div style="font-size:8px;color:#668;margin-top:3px">
                <span style="cursor:pointer;text-decoration:underline">MOT DE PASSE OUBLIÉ</span> · 
                <span style="cursor:pointer;text-decoration:underline">CRÉER UN COMPTE</span>
              </div>
            </div>
          </div>
          <!-- Tab bar -->
          <div style="flex:1;display:flex;flex-direction:column">
            <div style="display:flex;gap:2px;margin-bottom:6px">
              ${[['OFFRE QUOTIDIENNE','sims3:tab:daily'],['SAC MYSTÈRE','sims3:tab:mystery'],['ÉCHANGE','sims3:tab:exchange']].map(([t,a])=>`
              <div data-gaze data-action="${a}"
                style="padding:4px 8px;border-radius:3px 3px 0 0;cursor:pointer;font-size:8px;font-weight:700;
                background:${a.includes('exchange')?'#90b8d8':'rgba(255,255,255,0.4)'};
                color:${a.includes('exchange')?'#fff':'#446'};border:1px solid #80a8c8;border-bottom:none">${t}</div>`).join('')}
            </div>
            <div style="background:rgba(255,255,255,0.5);border-radius:0 4px 4px 4px;padding:8px;
              font-size:10px;color:#446;border:1px solid #90b0d0">
              Visitez <span style="color:#2060c0;cursor:pointer;font-weight:700">L'Échange</span> pour télécharger du contenu créé par les joueurs
              <div style="display:flex;gap:6px;margin-top:6px">
                ${['👩‍🦰','🎃','🧙'].map(e=>`
                <div style="width:50px;height:50px;border-radius:4px;background:linear-gradient(#808090,#606070);
                  display:flex;align-items:center;justify-content:center;font-size:24px;border:1px solid #5060a0">${e}</div>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <!-- News panel -->
        <div style="flex:1;overflow-y:auto;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:11px;font-weight:900;color:#334;letter-spacing:1px">ACTUALITÉS</span>
            <span style="font-size:9px;color:#2060c0;cursor:pointer;font-weight:700">PLUS ></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:1px">
            ${news.map(n=>`
            <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;cursor:pointer;
              background:rgba(255,255,255,0.3);border-bottom:1px solid rgba(160,190,220,0.5)">
              <span style="font-size:14px;flex-shrink:0">${n.icon}</span>
              <span style="font-size:10px;color:#334;font-weight:600">${n.text}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <!-- Right panel : Store preview -->
      <div style="width:160px;flex-shrink:0;overflow:hidden;position:relative;background:#2a5a1a">
        <!-- Store header -->
        <div style="background:linear-gradient(180deg,#4a8a2a,#3a7a1a);padding:6px 8px;
          display:flex;align-items:center;gap:6px;border-bottom:1px solid #2a6a10">
          <div style="font-size:8px;font-style:italic;font-weight:900;color:#fff">
            <span style="font-size:6px">The </span>SIms<sup style="font-size:5px">3</sup>
          </div>
          <div style="flex:1">
            <div style="font-size:7px;color:#8fca6f;font-weight:700">BRAND NEW VENUE!</div>
            <div style="font-size:8px;color:#fff;font-weight:700;cursor:pointer">Hayride X-ing! ▼</div>
          </div>
        </div>
        <!-- House image placeholder (3D neighborhood) -->
        <div style="height:100%;background:linear-gradient(180deg,#4a9a2a 0%,#3a8a1a 30%,#8aaa6a 60%,#6a8a4a 100%);
          position:relative;overflow:hidden">
          <!-- Sky -->
          <div style="position:absolute;top:0;left:0;right:0;height:40%;
            background:linear-gradient(180deg,#c8e8f0,#a0d0e8)"></div>
          <!-- House structure -->
          <div style="position:absolute;top:30%;left:50%;transform:translateX(-50%);text-align:center">
            <!-- Main house -->
            <div style="width:90px;height:55px;background:#f0e8d8;border:2px solid #c8b8a0;
              border-radius:2px;position:relative;margin:0 auto">
              <!-- Roof -->
              <div style="position:absolute;top:-22px;left:-6px;width:0;height:0;
                border-left:51px solid transparent;border-right:51px solid transparent;
                border-bottom:24px solid #c87840"></div>
              <!-- Roof 2 (lighter) -->
              <div style="position:absolute;top:-20px;left:-4px;width:0;height:0;
                border-left:49px solid transparent;border-right:49px solid transparent;
                border-bottom:22px solid #d88848"></div>
              <!-- Windows -->
              <div style="position:absolute;top:10px;left:8px;width:16px;height:16px;
                background:#a0c8e0;border:1px solid #6090b0"></div>
              <div style="position:absolute;top:10px;right:8px;width:16px;height:16px;
                background:#a0c8e0;border:1px solid #6090b0"></div>
              <!-- Door -->
              <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
                width:14px;height:22px;background:#a06030;border:1px solid #804820;border-radius:2px 2px 0 0"></div>
              <!-- Tower/cupola -->
              <div style="position:absolute;top:-28px;right:-4px;width:22px;height:30px;
                background:#e8d8c0;border:1px solid #b8a080">
                <div style="position:absolute;top:-10px;left:-2px;width:0;height:0;
                  border-left:13px solid transparent;border-right:13px solid transparent;
                  border-bottom:12px solid #c87840"></div>
              </div>
            </div>
            <!-- Gazebo -->
            <div style="position:absolute;right:-30px;top:10px;width:30px;height:20px">
              <div style="width:30px;height:16px;background:rgba(200,180,150,0.8);border:1px solid #a08060;
                border-radius:50% 50% 0 0"></div>
              <div style="width:24px;height:4px;background:#806040;margin:0 auto"></div>
            </div>
          </div>
          <!-- Ground/path -->
          <div style="position:absolute;bottom:0;left:0;right:0;height:35%;
            background:linear-gradient(180deg,#6aaa4a,#4a8a2a)">
            <!-- Tractor -->
            <div style="position:absolute;bottom:6px;right:6px;font-size:22px">🚜</div>
            <!-- Hay bales -->
            <div style="position:absolute;bottom:4px;right:32px;font-size:12px">🟫</div>
            <!-- Fence -->
            <div style="position:absolute;top:0;left:4px;right:4px;height:3px;
              background:rgba(200,160,100,0.8)"></div>
          </div>
          <!-- Cherry blossom tree -->
          <div style="position:absolute;top:20%;left:6px;font-size:28px">🌸</div>
        </div>
      </div>
    </div>
    <!-- Bottom bar -->
    <div style="background:linear-gradient(#5a8ab0,#3a6090);padding:5px 8px;
      display:flex;gap:4px;justify-content:center;border-top:2px solid #2a5080">
      ${['🏠','👤','🌐','🛒','🎮','🎵','🌿','⚡','🔬','🏆','⭐','🔧'].map(e=>`
      <div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.15);
        border:1px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;
        font-size:13px;cursor:pointer">${e}</div>`).join('')}
    </div>
  </div>`;
}

/* ---------- Rendu principal Sims 3 ---------- */
function buildSims3Content(){
  const scr = sims3State.screen;
  if(scr === 'loading')      return buildSims3Loading();
  if(scr === 'mainmenu')     return buildSims3Launcher();
  if(scr === 'create')       return buildSims3Create();
  if(scr === 'neighborhood') return buildSims3Neighborhood();
  if(scr === 'live')         return buildSims3Live();
  if(scr === 'build')        return buildSims3Build();
  if(scr === 'buy')          return buildSims3Buy();
  if(scr === 'skills')       return buildSims3Skills();
  if(scr === 'career')       return buildSims3Career();
  if(scr === 'relationships')return buildSims3Relationships();
  return buildSims3Launcher();
}

function renderSims3(){
  if(!sims3State.open) return;
  // Supprimer l'ancien overlay body s'il existe (legacy)
  const old = document.getElementById('sims3-overlay');
  if(old) old.remove();
  // Rendu via renderHUD -> buildAppWindowHTML cas 'sims3'
  renderHUD();
}

/* ---------- Gestion des actions Sims 3 ---------- */
function handleSims3Action(action){
  const s = sims3State;

  if(action === 'sims3:close'){ closeSims3VR(); return; }

  // Launcher actions
  if(action === 'sims3:launcher:play'){
    s.screen = 'neighborhood';
    renderSims3(); return;
  }
  if(action.startsWith('sims3:launcher:') || action.startsWith('sims3:tab:')){
    // sub-menus not yet implemented, just toast
    toast('🎮 ' + action.split(':').pop());
    return;
  }

  if(action.startsWith('sims3:goto:')){
    const screen = action.slice(11);
    s.screen = screen;
    if(screen === 'live'){
      if(!s.sim){
        // Sim par défaut si pas créé
        s.sim = { name:'Sim VR', gender:'female', skin:1, hair:'brun', aspiration:'bonheur' };
      }
      sims3StartTime();
    } else {
      sims3StopTime();
    }
    renderSims3(); return;
  }

  if(action === 'sims3:create:confirm'){
    const f = s.createForm;
    s.sim = {
      name: f.name || 'Mon Sim',
      gender: f.gender,
      skin: f.skin,
      hair: f.hair,
      aspiration: f.aspiration,
      traits: [f.trait1, f.trait2, f.trait3].filter(Boolean),
    };
    s.screen = 'neighborhood';
    sims3Notify(`✅ ${s.sim.name} créé !`);
    renderSims3(); return;
  }

  if(action.startsWith('sims3:create:gender:')){
    s.createForm.gender = action.split(':')[3]; renderSims3(); return;
  }
  if(action.startsWith('sims3:create:skin:')){
    s.createForm.skin = parseInt(action.split(':')[3]); renderSims3(); return;
  }
  if(action.startsWith('sims3:create:hair:')){
    s.createForm.hair = action.split(':')[3]; renderSims3(); return;
  }
  if(action.startsWith('sims3:create:aspiration:')){
    s.createForm.aspiration = action.split(':')[3]; renderSims3(); return;
  }
  if(action.startsWith('sims3:create:trait:')){
    const t = action.slice(19);
    const f = s.createForm;
    const slots = ['trait1','trait2','trait3'];
    const used = slots.find(sl => f[sl] === t);
    if(used){ f[used] = ''; }
    else {
      const empty = slots.find(sl => !f[sl]);
      if(empty) f[empty] = t;
    }
    renderSims3(); return;
  }

  if(action.startsWith('sims3:neighborhood:')){
    const nbId = action.slice(19);
    const nb = SIMS3_NEIGHBORHOODS.find(n=>n.id===nbId);
    if(nb){ s.lot.name = nb.name; sims3Notify(`🏘️ Bienvenue à ${nb.name} !`); }
    s.screen = 'live';
    if(!s.sim) s.sim = { name:'Sim VR', gender:'female', skin:1, hair:'brun', aspiration:'bonheur' };
    sims3StartTime();
    renderSims3(); return;
  }

  if(action.startsWith('sims3:speed:')){
    s.timeSpeed = parseInt(action.split(':')[2]);
    renderSims3(); return;
  }

  if(action.startsWith('sims3:do:')){
    const actId = action.slice(9);
    if(s.currentAction === actId){
      s.currentAction = null; s.actionProgress = 0;
      sims3Notify('⏹ Action annulée');
    } else {
      s.currentAction = actId; s.actionProgress = 0;
      const act = SIMS3_INTERACTIONS.find(a=>a.id===actId);
      if(act) sims3Notify(`▶ ${act.icon} ${act.name}…`);
    }
    renderSims3(); return;
  }

  if(action.startsWith('sims3:buy:cat:')){
    s.buyCategory = action.slice(14); renderSims3(); return;
  }
  if(action.startsWith('sims3:buy:item:')){
    const parts = action.split(':');
    const price = parseInt(parts[4]);
    if(s.simoleons >= price){
      s.simoleons -= price;
      s.lot.furniture = Math.min(SIMS3_LOTFURNITURE.length, s.lot.furniture + 1);
      sims3Notify(`✅ Meuble acheté ! §${price} déduits.`);
    } else {
      sims3Notify('❌ Pas assez de Simoleons !');
    }
    renderSims3(); return;
  }

  if(action.startsWith('sims3:build:addroom:')){
    const room = action.slice(20);
    const prices = {Bureau:2500,Garage:4000,Jardin:1500,Cave:2000,Bibliothèque:3000,'Salle de sport':3500};
    const price = prices[room] || 2000;
    if(s.simoleons >= price){
      s.simoleons -= price;
      if(!s.lot.rooms.includes(room)) s.lot.rooms.push(room);
      sims3Notify(`🏗️ ${room} construit ! §${price} déduits.`);
    } else {
      sims3Notify('❌ Pas assez de Simoleons !');
    }
    renderSims3(); return;
  }

  if(action.startsWith('sims3:career:join:')){
    const cId = action.slice(18);
    const car = SIMS3_CAREERS.find(c=>c.id===cId);
    if(car){
      s.career = { id:car.id, name:car.name, icon:car.icon, level:1, salary:car.salaries[0], daysWorked:0 };
      sims3Notify(`💼 Bienvenue dans la carrière ${car.name} !`);
    }
    renderSims3(); return;
  }
  if(action === 'sims3:career:work'){
    if(s.career.level > 0){
      s.simoleons += s.career.salary;
      s.career.daysWorked++;
      s.needs.energy = Math.max(0, s.needs.energy - 25);
      s.needs.comfort = Math.max(0, s.needs.comfort - 15);
      // Level up toutes les 5 journées travaillées
      if(s.career.daysWorked % 5 === 0 && s.career.level < 10){
        s.career.level++;
        const car = SIMS3_CAREERS.find(c=>c.id===s.career.id);
        if(car) s.career.salary = car.salaries[s.career.level - 1];
        sims3Notify(`🎉 Promotion ! Niveau ${s.career.level}`);
      } else {
        sims3Notify(`💼 Journée de travail terminée ! +§${s.career.salary}`);
      }
    }
    renderSims3(); return;
  }
  if(action === 'sims3:career:quit'){
    s.career = { name:'Aucune', level:0, salary:0, daysWorked:0, id:'none' };
    sims3Notify('👋 Démission acceptée.');
    renderSims3(); return;
  }

  if(action.startsWith('sims3:rel:talk:')){
    const id = parseInt(action.slice(15));
    const rels = s.relationships.length > 0 ? s.relationships : [
      { id:1, name:'Clara Martin',   emoji:'👩', relation:'Amie',      score:72, status:'online' },
      { id:2, name:'Paul Dupont',    emoji:'👨', relation:'Voisin',    score:45, status:'offline' },
      { id:3, name:'Sophie Bernard', emoji:'👩', relation:'Collègue',  score:88, status:'online' },
      { id:4, name:'Marc Rousseau',  emoji:'👨', relation:'Inconnu',   score:20, status:'offline' },
      { id:5, name:'Julie Blanc',    emoji:'👩', relation:'Meilleure amie', score:95, status:'online' },
    ];
    if(!s.relationships.length) s.relationships = rels;
    const rel = s.relationships.find(r=>r.id===id);
    if(rel){
      rel.score = Math.min(100, rel.score + 8);
      s.needs.social = Math.min(100, s.needs.social + 20);
      sims3Notify(`💬 Conversation avec ${rel.name} (+8 relation)`);
    }
    renderSims3(); return;
  }
  if(action === 'sims3:rel:meet'){
    const names = ['Alex Kim','Marie Leclerc','Thomas Gros','Emma Petit','Lucas Moreau'];
    const name = names[Math.floor(Math.random()*names.length)] + ' #' + Math.floor(Math.random()*99);
    if(!s.relationships.length){
      s.relationships = [
        { id:1, name:'Clara Martin',   emoji:'👩', relation:'Amie',     score:72, status:'online' },
        { id:2, name:'Paul Dupont',    emoji:'👨', relation:'Voisin',   score:45, status:'offline' },
        { id:3, name:'Sophie Bernard', emoji:'👩', relation:'Collègue', score:88, status:'online' },
        { id:4, name:'Marc Rousseau',  emoji:'👨', relation:'Inconnu',  score:20, status:'offline' },
        { id:5, name:'Julie Blanc',    emoji:'👩', relation:'Meilleure amie', score:95, status:'online' },
      ];
    }
    const newId = Date.now();
    s.relationships.push({ id:newId, name, emoji:Math.random()>0.5?'👩':'👨', relation:'Inconnu', score:10, status:'online' });
    sims3Notify(`👋 Rencontre avec ${name} !`);
    renderSims3(); return;
  }

  renderSims3();
}

/* Hook dans handleAction principal pour les actions sims3 */
const _origHandleAction = handleAction;
window._sims3Hooked = true;
