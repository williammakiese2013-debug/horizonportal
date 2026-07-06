/* ============================================================
   MINERAFT VR — Moteur Minecraft-like complet
   Rendu raycasting Canvas 2D style Minecraft, monde procédural,
   contrôle par regard (gyroscope + gaze dwell)
   ============================================================ */
(function(){

/* ─── Blocs (type → {couleur top, côté, bas, nom, emoji}) ─── */
const BLOCKS = {
  0:  null, // air
  1:  { top:'#7ec850', side:'#6aaa3c', bot:'#8b5e2a', name:'Herbe',    emoji:'🌿' },
  2:  { top:'#8b5e2a', side:'#8b5e2a', bot:'#8b5e2a', name:'Terre',    emoji:'🟫' },
  3:  { top:'#888',    side:'#888',    bot:'#888',    name:'Pierre',   emoji:'⬜' },
  4:  { top:'#d4b483', side:'#d4b483', bot:'#d4b483', name:'Sable',    emoji:'🏜️' },
  5:  { top:'#c4922b', side:'#c4922b', bot:'#c4922b', name:'Bois',     emoji:'🪵' },
  6:  { top:'#2d7e2d', side:'#2d7e2d', bot:'#2d7e2d', name:'Feuillage',emoji:'🍃' },
  7:  { top:'#444',    side:'#444',    bot:'#444',    name:'Roche',    emoji:'🪨' },
  8:  { top:'#e5b000', side:'#e5b000', bot:'#e5b000', name:'Or',       emoji:'✨' },
  9:  { top:'#5f9ea0', side:'#5f9ea0', bot:'#5f9ea0', name:'Diamant',  emoji:'💎' },
  10: { top:'#e04020', side:'#e04020', bot:'#e04020', name:'Brique',   emoji:'🧱' },
  11: { top:'#d3d3d3', side:'#d3d3d3', bot:'#d3d3d3', name:'Neige',    emoji:'❄️' },
  12: { top:'#1a6e2a', side:'#1a6e2a', bot:'#1a6e2a', name:'Cactus',   emoji:'🌵' },
  13: { top:'#2244cc', side:'#2244cc', bot:'#2244cc', name:'Eau',      emoji:'💧', alpha:.55 },
  14: { top:'#ffa040', side:'#ce6200', bot:'#ce6200', name:'Citrouille',emoji:'🎃' },
};

const HOTBAR_BLOCKS = [1,3,5,10,8,9,13,4,7];
const WORLD_SIZE = 64;   // 64×64×48 chunks
const WORLD_H   = 48;
const SEA_LEVEL = 18;

/* ─── État global ─── */
const MRF = {
  active: false,
  world: null,       // Uint8Array [x + z*W + y*W*W]
  camX: 32, camY: 20.5, camZ: 32,
  yaw: 0,    pitch: 0,   // radians
  mode: 'mine',          // 'mine' | 'place'
  hotbarIdx: 0,
  day: 1,
  time: 0,  // 0..1 (jour/nuit cycle)
  gazeTime: 0,
  gazeTarget: null,   // {face, bx,by,bz}
  dwell: 0,
  onGround: false,
  velY: 0,
  actionCooldown: 0,
  // Gyro
  gyroYaw: 0,
  gyroPitch: 0,
  gyroAlpha0: null,
  gyroBase: null,
  useGyro: false,
  animId: null,
  lastFrame: 0,
  // Marche automatique (double-regard haut→bas / bas→haut rapide)
  autoWalk: false,
  nodPhase: 0,       // 0=neutre, 1=est monté (attend la descente), -1=est descendu (attend la montée)
  nodPhaseTime: 0,   // timestamp du dernier changement de phase
  nodExtremum: 0,    // amplitude maximale atteinte pendant le mouvement en cours
  nodCooldownUntil: 0, // anti-rebond après un toggle réussi
  // Interface ciblée par le regard (boutons HUD, hotbar) à l'intérieur du jeu
  uiGazeEl: null,
  uiGazeStart: 0,
  uiGazeProgress: 0,
  // Qualité de rendu adaptative (résolution des colonnes du raycaster) :
  // ajustée automatiquement selon le framerate réel pour garder le jeu
  // fluide même sur les appareils mobiles plus modestes.
  renderCols: 180,
  fpsAvg: 60,
};
const NOD_TRIGGER = 0.16;     // seuil d'angle (rad) pour considérer un "coup de tête" haut/bas (~9°)
const NOD_MAX_GAP = 700;      // délai max (ms) entre les deux mouvements du double-regard
const UI_DWELL = 850;         // temps de regard (ms) pour activer un bouton d'interface MineRaft

/* ─── Génération de monde procédural ─── */
function worldIdx(x,y,z){ return x + z*WORLD_SIZE + y*WORLD_SIZE*WORLD_SIZE; }
function getBlock(x,y,z){
  x=x|0;y=y|0;z=z|0;
  if(x<0||x>=WORLD_SIZE||y<0||y>=WORLD_H||z<0||z>=WORLD_SIZE) return 0;
  return MRF.world[worldIdx(x,y,z)];
}
function setBlock(x,y,z,t){
  x=x|0;y=y|0;z=z|0;
  if(x<0||x>=WORLD_SIZE||y<0||y>=WORLD_H||z<0||z>=WORLD_SIZE) return;
  MRF.world[worldIdx(x,y,z)]=t;
}

function noise2D(x,z,seed){
  let v = Math.sin(x*127.1+seed)*43758.5453 + Math.cos(z*311.7+seed)*23421.6312;
  return (v - Math.floor(v));
}
function smoothNoise(x,z,seed=0){
  const ix=x|0, iz=z|0;
  const fx=x-ix, fz=z-iz;
  const a=noise2D(ix,iz,seed), b=noise2D(ix+1,iz,seed);
  const c=noise2D(ix,iz+1,seed), d=noise2D(ix+1,iz+1,seed);
  const ux=fx*fx*(3-2*fx), uz=fz*fz*(3-2*fz);
  return a*(1-ux)*(1-uz)+b*ux*(1-uz)+c*(1-ux)*uz+d*ux*uz;
}
function fbm(x,z,seed=0,octaves=4){
  let v=0,amp=1,freq=1,sum=0;
  for(let i=0;i<octaves;i++){v+=smoothNoise(x*freq,z*freq,seed+i*99)*amp;sum+=amp;amp*=.5;freq*=2;}
  return v/sum;
}

function generateWorld(){
  MRF.world = new Uint8Array(WORLD_SIZE*WORLD_SIZE*WORLD_H);
  const W=WORLD_SIZE;
  for(let x=0;x<W;x++){
    for(let z=0;z<W;z++){
      // Heightmap
      const h = (fbm(x/24,z/24,42)*16 + fbm(x/8,z/8,7)*4 + SEA_LEVEL)|0;
      const height = Math.max(2, Math.min(WORLD_H-3, h));
      const biome = fbm(x/40, z/40, 999);
      const isSnow = biome > .72;
      const isDesert = biome < .28;

      for(let y=0;y<height;y++){
        let block;
        if(y===height-1){
          block = isSnow ? 11 : isDesert ? 4 : 1;
        } else if(y>=height-4){
          block = isDesert ? 4 : 2;
        } else {
          block = y < 4 ? 7 : 3;
        }
        // Minerais
        if(y<12 && Math.random()<.012) block = 8;  // or
        if(y<8 && Math.random()<.006) block = 9;   // diamant
        setBlock(x,y,z,block);
      }
      // Eau
      for(let y=height;y<=SEA_LEVEL-1;y++){
        if(getBlock(x,y,z)===0) setBlock(x,y,z,13);
      }
      // Arbres (plaine/neige)
      if(!isDesert && height>SEA_LEVEL && Math.random()<.035){
        const th = 3+((Math.random()*3)|0);
        for(let dy=0;dy<th;dy++) setBlock(x,height+dy,z,5);
        for(let lx=-2;lx<=2;lx++) for(let lz=-2;lz<=2;lz++) for(let ly=0;ly<=2;ly++){
          if(Math.abs(lx)+Math.abs(lz)+Math.abs(ly)<=3) setBlock(x+lx,height+th+ly,z+lz,6);
        }
      }
      // Cactus (désert)
      if(isDesert && Math.random()<.02) {
        const ch=(1+Math.random()*3)|0;
        for(let cy=0;cy<ch;cy++) setBlock(x,height+cy,z,12);
      }
    }
  }
}

/* ─── Raycaster 3D ─── */
function raycast(ox,oy,oz,dx,dy,dz,maxDist){
  // DDA 3D
  let bx=Math.floor(ox), by=Math.floor(oy), bz=Math.floor(oz);
  const sx=dx>0?1:-1, sy=dy>0?1:-1, sz=dz>0?1:-1;
  const tDX=Math.abs(1/dx)||1e10, tDY=Math.abs(1/dy)||1e10, tDZ=Math.abs(1/dz)||1e10;
  let tX=(dx>0?Math.ceil(ox)-ox:ox-Math.floor(ox))*tDX;
  let tY=(dy>0?Math.ceil(oy)-oy:oy-Math.floor(oy))*tDY;
  let tZ=(dz>0?Math.ceil(oz)-oz:oz-Math.floor(oz))*tDZ;
  let dist=0, face=0, prevBx=bx, prevBy=by, prevBz=bz;
  while(dist<maxDist){
    const b=getBlock(bx,by,bz);
    if(b && BLOCKS[b] && !(BLOCKS[b].alpha)){
      return {bx,by,bz,face,dist,prevBx,prevBy,prevBz,block:b};
    }
    prevBx=bx;prevBy=by;prevBz=bz;
    if(tX<tY && tX<tZ){dist=tX;tX+=tDX;bx+=sx;face=sx>0?3:2;}
    else if(tY<tZ){dist=tY;tY+=tDY;by+=sy;face=sy>0?5:4;}
    else{dist=tZ;tZ+=tDZ;bz+=sz;face=sz>0?1:0;}
  }
  return null;
}

/* ─── Rendu raycasting-style "shader" (colonne par colonne, comme les anciens Doom/Wolfenstein mais adapté Minecraft) ───
   v2 : ciel dynamique avec étoiles/lune/dégradé HDR-like, eau animée
   (vagues + reflet du ciel + scintillement), textures procédurales par
   bloc (au lieu d'un bruit gris plat), brouillard volumétrique colorimétré
   selon l'heure, anti-aliasing vertical léger, et un cache de buffers
   pour limiter le travail par frame (fluidité VR360 double-écran). */

// --- Cache de ciel (un seul calcul de gradient par "tranche horaire", réutilisé sur les 2 yeux)
const SKY_CACHE = { key:null, topColor:null, midColor:null, botColor:null, sunCol:null, starAlpha:0, fogCol:null };

function lerp(a,b,t){ return a+(b-a)*t; }
function lerpColor(c1,c2,t){
  return [ lerp(c1[0],c2[0],t)|0, lerp(c1[1],c2[1],t)|0, lerp(c1[2],c2[2],t)|0 ];
}
function rgbStr(c,a){ return a===undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// Palette du cycle jour/nuit : aube → jour → crépuscule → nuit → aube
const SKY_KEYFRAMES = [
  { t:0.00, top:[10,12,30],   mid:[40,50,90],    bot:[90,70,110],  sun:[255,180,120], star:0.9 }, // nuit profonde / pré-aube
  { t:0.08, top:[40,55,110],  mid:[140,120,150], bot:[255,170,120],sun:[255,200,140], star:0.25}, // aube
  { t:0.18, top:[60,140,225], mid:[130,190,235], bot:[200,225,245],sun:[255,250,225], star:0   }, // matin
  { t:0.50, top:[60,150,235], mid:[110,185,235], bot:[190,222,245],sun:[255,253,235], star:0   }, // zénith
  { t:0.78, top:[50,110,200], mid:[160,140,150], bot:[255,140,90], sun:[255,140,80],  star:0.15}, // crépuscule
  { t:0.85, top:[15,18,55],   mid:[60,40,80],    bot:[130,80,90],  sun:[255,120,90],  star:0.6 }, // tombée de nuit
  { t:1.00, top:[10,12,30],   mid:[40,50,90],    bot:[90,70,110],  sun:[255,180,120], star:0.9 },
];

function computeSky(time){
  const key = Math.round(time*240); // ~4 min de résolution temporelle, largement assez pour un cycle de 2 min
  if(SKY_CACHE.key === key) return SKY_CACHE;
  let kf0=SKY_KEYFRAMES[0], kf1=SKY_KEYFRAMES[SKY_KEYFRAMES.length-1];
  for(let i=0;i<SKY_KEYFRAMES.length-1;i++){
    if(time>=SKY_KEYFRAMES[i].t && time<=SKY_KEYFRAMES[i+1].t){ kf0=SKY_KEYFRAMES[i]; kf1=SKY_KEYFRAMES[i+1]; break; }
  }
  const span = (kf1.t-kf0.t)||1;
  const t = Math.max(0,Math.min(1,(time-kf0.t)/span));
  SKY_CACHE.key = key;
  SKY_CACHE.topColor = lerpColor(kf0.top,kf1.top,t);
  SKY_CACHE.midColor = lerpColor(kf0.mid,kf1.mid,t);
  SKY_CACHE.botColor = lerpColor(kf0.bot,kf1.bot,t);
  SKY_CACHE.sunCol   = lerpColor(kf0.sun,kf1.sun,t);
  SKY_CACHE.starAlpha = lerp(kf0.star,kf1.star,t);
  // Couleur de brouillard ≈ couleur d'horizon, légèrement assombrie
  SKY_CACHE.fogCol = lerpColor(SKY_CACHE.botColor,[0,0,0],0.08);
  return SKY_CACHE;
}

// --- Étoiles : positions fixes (seedées), recalculées seulement si besoin
let STAR_FIELD = null;
function getStars(w,h){
  if(STAR_FIELD && STAR_FIELD.w===w && STAR_FIELD.h===h) return STAR_FIELD.pts;
  const pts=[];
  let s=1337;
  const rnd=()=>{ s=(s*9301+49297)%233280; return s/233280; };
  const n = 90;
  for(let i=0;i<n;i++){
    pts.push({ x:rnd()*w, y:rnd()*h*0.5, r:rnd()*1.4+0.3, tw:rnd()*6.28 });
  }
  STAR_FIELD = { w,h,pts };
  return pts;
}

// --- Textures procédurales par type de bloc : un petit motif déterministe
// (pas de bruit pur) qui évoque grain de pierre, brins d'herbe, fibres de
// bois, cristaux, etc. Calculé par cellule de bloc (hit.bx/by/bz), donc
// stable et sans scintillement, peu coûteux (quelques traits par colonne).
function drawBlockTexture(ctx, blockType, face, x, y, colW, bh, hitFracX){
  const seed = (blockType*131);
  ctx.save();
  switch(blockType){
    case 1: // Herbe : brins verticaux fins sur le dessus/côté supérieur
      if(face===4||face===5){
        ctx.globalAlpha=.16; ctx.strokeStyle='#3f7a22'; ctx.lineWidth=1;
        for(let i=0;i<colW;i+=2){
          const j=((x+i)*7+seed)%5;
          ctx.beginPath(); ctx.moveTo(x+i, y+bh*0.15+j); ctx.lineTo(x+i, y+bh*0.35+j); ctx.stroke();
        }
      } else {
        ctx.globalAlpha=.10; ctx.fillStyle='#5a9a36';
        ctx.fillRect(x, y, colW+1, Math.max(2,bh*0.12));
      }
      break;
    case 2: case 7: // Terre / Roche : taches sombres irrégulières
      ctx.globalAlpha=.10;
      ctx.fillStyle='#000';
      for(let i=0;i<bh;i+=6){
        if(((x|0)+(i|0)+seed)%9<3) ctx.fillRect(x, y+i, colW+1, 2);
      }
      break;
    case 3: case 9: // Pierre / Diamant : grain croisé clair/sombre
      ctx.globalAlpha=.09;
      ctx.fillStyle=((x|0)+seed)%2===0?'#fff':'#000';
      for(let i=0;i<bh;i+=5){ if(((i|0)+seed)%7<3) ctx.fillRect(x,y+i,colW+1,2); }
      break;
    case 4: // Sable : grain ondulé clair
      ctx.globalAlpha=.08; ctx.fillStyle='#fff8e0';
      for(let i=0;i<bh;i+=3){ if(((x|0)*3+(i|0)+seed)%11<3) ctx.fillRect(x,y+i,colW+1,1); }
      break;
    case 5: // Bois : fibres verticales
      ctx.globalAlpha=.18; ctx.strokeStyle='#7a4d18'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x+colW*0.3, y); ctx.lineTo(x+colW*0.3, y+bh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+colW*0.7, y); ctx.lineTo(x+colW*0.7, y+bh); ctx.stroke();
      break;
    case 6: // Feuillage : pointillé dense
      ctx.globalAlpha=.14; ctx.fillStyle='#0d3d10';
      for(let i=0;i<bh;i+=3){ if(((x|0)+(i|0)*3+seed)%6<2) ctx.fillRect(x,y+i,colW+1,2); }
      break;
    case 8: // Or : reflets brillants ponctuels
      ctx.globalAlpha=.28; ctx.fillStyle='#fff6c8';
      if(((x|0)+seed)%5===0) ctx.fillRect(x, y+bh*0.3, colW+1, Math.max(2,bh*0.08));
      break;
    case 11: // Neige : léger scintillement
      ctx.globalAlpha=.12; ctx.fillStyle='#fff';
      for(let i=0;i<bh;i+=4){ if(((x|0)+(i|0)+seed)%8<2) ctx.fillRect(x,y+i,colW+1,1); }
      break;
    case 12: // Cactus : rainures verticales
      ctx.globalAlpha=.16; ctx.strokeStyle='#0d4d18'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x+colW*0.5,y); ctx.lineTo(x+colW*0.5,y+bh); ctx.stroke();
      break;
    case 10: // Brique : joints horizontaux
      ctx.globalAlpha=.20; ctx.fillStyle='#8a2f1a';
      for(let i=0;i<bh;i+=8){ ctx.fillRect(x, y+i, colW+1, 1.5); }
      break;
    default: break;
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

function renderView(ctx, w, h, eyeOffset){
  const sky = computeSky(MRF.time);
  const isNight = MRF.time<0.18 || MRF.time>0.85 || (MRF.time>0.5 && MRF.time<0.78 && false);
  const isDay = MRF.time>=0.08 && MRF.time<=0.85;

  /* ── Ciel : dégradé 3 points (zenith/mi-hauteur/horizon) + étoiles + soleil/lune ── */
  const skyH = h*.55;
  const grad = ctx.createLinearGradient(0,0,0,skyH);
  grad.addColorStop(0, rgbStr(sky.topColor));
  grad.addColorStop(0.55, rgbStr(sky.midColor));
  grad.addColorStop(1, rgbStr(sky.botColor));
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,w,skyH);

  // Étoiles (apparaissent progressivement la nuit, scintillement doux)
  if(sky.starAlpha>0.02){
    const stars = getStars(w,h);
    const tNow = Date.now()/600;
    ctx.fillStyle='#fff';
    for(let i=0;i<stars.length;i++){
      const s=stars[i];
      const tw = 0.55+0.45*Math.sin(tNow+s.tw);
      ctx.globalAlpha = sky.starAlpha*tw*0.9;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // Sol de base (couleur de secours sous l'horizon, recouvert par le raycast)
  ctx.fillStyle= isDay ? '#7ec850' : '#16241a';
  ctx.fillRect(0,skyH,w,h-skyH);

  const FOV = Math.PI/2.2;
  const sinY = Math.sin(MRF.yaw + eyeOffset*0.032);
  const cosY = Math.cos(MRF.yaw + eyeOffset*0.032);
  const pitch = MRF.pitch;

  const cx=MRF.camX, cy=MRF.camY, cz=MRF.camZ;
  // Résolution adaptative : ajustée en continu par mainLoop() selon le
  // framerate réel, pour garder le jeu fluide même sur mobile (VR360
  // double-écran = deux rendus par frame, donc le coût compte double).
  const COLS = Math.max(70, Math.min(w, MRF.renderCols||180));
  const colW = w/COLS;
  const waterTime = Date.now()/1000;

  for(let col=0;col<COLS;col++){
    const a = FOV*(col/COLS - .5);
    const sa=Math.sin(a), ca2=Math.cos(a);
    const rdx = cosY*ca2 - sinY*sa;
    const rdz = sinY*ca2 + cosY*sa;
    const rdy = -pitch*ca2 - sa*0;

    const hit = raycast(cx,cy,cz,rdx,rdy,rdz,24);
    if(hit){
      const bd = BLOCKS[hit.block];
      if(!bd) continue;
      const isWater = hit.block===13;
      let dist = Math.max(0.1, hit.dist);

      // Vagues : on perturbe légèrement la distance perçue de l'eau pour
      // simuler un mouvement de surface sans recalculer tout le raycast.
      if(isWater){
        const wobble = Math.sin(waterTime*1.6 + hit.bx*0.6 + hit.bz*0.6)*0.18;
        dist = Math.max(0.1, dist + wobble);
      }

      const bh = Math.min(h, (h/dist)*0.85)|0;
      const xPix = col*colW|0;
      let by2 = ((h-bh)/2 - pitch*h*0.35)|0;
      if(isWater){
        // Léger flottement vertical de la ligne d'eau (clapot)
        by2 += Math.sin(waterTime*2.1 + hit.bx*0.9)*1.5|0;
      }

      let col_str;
      const shade = isDay ? 1 : 0.32;
      if(hit.face===4||hit.face===5){col_str=adjustBrightness(bd.top, shade);}
      else if(hit.face===0||hit.face===1){col_str=adjustBrightness(bd.side, shade*.75);}
      else{col_str=adjustBrightness(bd.side, shade*.88);}

      if(isWater){
        // Reflet du ciel mélangé à la couleur de l'eau + scintillement spéculaire
        const sparkle = Math.max(0, Math.sin(waterTime*3 + hit.bx*1.3 + hit.bz*0.7));
        const base = adjustBrightness(bd.top, shade);
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = base;
        ctx.fillRect(xPix, by2, colW+1, bh);
        // teinte ciel (reflet)
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = rgbStr(sky.midColor);
        ctx.fillRect(xPix, by2, colW+1, bh);
        if(sparkle>0.85){
          ctx.globalAlpha = (sparkle-0.85)*2.2;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(xPix, by2+bh*0.15, colW+1, Math.max(1,bh*0.05));
        }
        ctx.globalAlpha = 1;
      } else {
        const fogFactor = Math.min(1, (dist-1)/18);
        ctx.globalAlpha = bd.alpha || 1;
        ctx.fillStyle = col_str;
        ctx.fillRect(xPix, by2, colW+1, bh);
        if(fogFactor > 0.04){
          ctx.fillStyle = rgbStr(sky.fogCol, fogFactor*.72);
          ctx.fillRect(xPix, by2, colW+1, bh);
        }
        ctx.globalAlpha=1;

        // Texture procédurale par bloc (remplace le bruit gris générique)
        if(dist < 9 && bh > 8){
          drawBlockTexture(ctx, hit.block, hit.face, xPix, by2, colW, bh);
        }
      }
    }
  }

  /* ── Soleil / Lune avec halo doux ── */
  const sunAngle = MRF.time * Math.PI * 2 - Math.PI/2;
  const sunX = w*.5 + Math.cos(sunAngle)*w*.42;
  const sunY = h*.30 - Math.sin(sunAngle)*h*.26;
  const sunUp = Math.sin(sunAngle) > -0.05;
  if(sunUp){
    if(isDay){
      const haloGrad = ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,w*.07);
      haloGrad.addColorStop(0,'rgba(255,250,210,.55)');
      haloGrad.addColorStop(1,'rgba(255,250,210,0)');
      ctx.fillStyle=haloGrad;
      ctx.beginPath();ctx.arc(sunX,sunY,w*.07,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=rgbStr(sky.sunCol);
      ctx.beginPath();ctx.arc(sunX,sunY,w*.025,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle='rgba(220,230,255,.18)';
      ctx.beginPath();ctx.arc(sunX,sunY,w*.035,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e8eeff';
      ctx.beginPath();ctx.arc(sunX,sunY,w*.018,0,Math.PI*2);ctx.fill();
      // Cratères simples
      ctx.fillStyle='rgba(180,190,210,.5)';
      ctx.beginPath();ctx.arc(sunX-w*.006,sunY-w*.004,w*.004,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(sunX+w*.005,sunY+w*.006,w*.003,0,Math.PI*2);ctx.fill();
    }
  }

  /* ── Nuages : dérive lente + ombrage léger, seulement le jour ── */
  if(isDay){
    const ct = (Date.now()/22000)%1;
    for(let i=0;i<5;i++){
      const cx2=((ct+i*.21)%1)*w*1.3-w*.15;
      const cy2 = h*(.14+ (i%2)*.05);
      ctx.fillStyle='rgba(255,255,255,.5)';
      ctx.beginPath();ctx.ellipse(cx2,cy2,w*.06,h*.022,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(cx2+w*.045,cy2-h*.006,w*.04,h*.018,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(200,210,225,.25)';
      ctx.beginPath();ctx.ellipse(cx2+w*.01,cy2+h*.012,w*.05,h*.012,0,0,Math.PI*2);ctx.fill();
    }
  }
}

function adjustBrightness(hexColor, factor){
  let c=hexColor.replace('#','');
  if(c.length===3) c=c.split('').map(x=>x+x).join('');
  let r=parseInt(c.slice(0,2),16);
  let g=parseInt(c.slice(2,4),16);
  let b=parseInt(c.slice(4,6),16);
  r=Math.min(255,r*factor)|0;
  g=Math.min(255,g*factor)|0;
  b=Math.min(255,b*factor)|0;
  return `rgb(${r},${g},${b})`;
}

/* ─── Hotbar ─── */
function renderHotbar(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.innerHTML='';
  HOTBAR_BLOCKS.forEach((bt,i)=>{
    const s=document.createElement('div');
    s.className='mrf-slot'+(i===MRF.hotbarIdx?' active':'');
    s.setAttribute('data-gaze','');
    s.setAttribute('data-action','mrf:hotbar:select:'+i);
    const bd=BLOCKS[bt];
    s.textContent=bd?bd.emoji:'?';
    const cnt=document.createElement('span');
    cnt.className='mrf-slot-count';
    cnt.textContent='∞';
    s.appendChild(cnt);
    el.appendChild(s);
  });
}

/* ─── HUD update ─── */
function updateHUD(){
  const bx=Math.floor(MRF.camX), by=Math.floor(MRF.camY), bz=Math.floor(MRF.camZ);
  const coords=`X:${bx} Y:${by} Z:${bz}`;
  ['mrf-coords-L','mrf-coords-R'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent=coords;
  });
  const modeLabel=MRF.mode==='mine'?'⛏️ MINER':'🧱 PLACER';
  ['mrf-mode-L','mrf-mode-R'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent=modeLabel;
  });
  const dayStr=`Jour ${MRF.day}`;
  ['mrf-day-L','mrf-day-R'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent=dayStr;
  });
  ['mrf-autowalk-L','mrf-autowalk-R'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display = MRF.autoWalk ? 'block' : 'none';
  });
  renderHotbar('mrf-hotbar-L');
  renderHotbar('mrf-hotbar-R');
}

/* ─── Gaze ring ─── */
function setGazeProgress(p){
  const c1=document.getElementById('mrf-gaze-circle-L');
  const c2=document.getElementById('mrf-gaze-circle-R');
  const off=94.2*(1-p);
  if(c1) c1.setAttribute('stroke-dashoffset',off);
  if(c2) c2.setAttribute('stroke-dashoffset',off);
}

/* ─── Physique simple ─── */
function physicsStep(dt){
  MRF.velY -= 18*dt; // gravité
  const ny = MRF.camY + MRF.velY*dt;
  const bx=Math.floor(MRF.camX),bz=Math.floor(MRF.camZ);
  const floorY = getSurface(bx,bz)+1.7;
  if(ny <= floorY){
    MRF.camY=floorY; MRF.velY=0; MRF.onGround=true;
  } else {
    MRF.camY=ny; MRF.onGround=false;
  }
}

function getSurface(x,z){
  for(let y=WORLD_H-1;y>=0;y--){
    const b=getBlock(x,y,z);
    if(b && BLOCKS[b] && b!==13) return y;
  }
  return 0;
}

/* ─── Boucle principale ─── */
function mainLoop(ts){
  if(!MRF.active) return;
  const dt = Math.min(0.05, (ts - MRF.lastFrame)/1000);
  MRF.lastFrame=ts;

  // Suivi du framerate réel + ajustement adaptatif de la résolution de
  // rendu : si le jeu ralentit (dt élevé → fps bas), on réduit le nombre
  // de colonnes du raycaster pour retrouver de la fluidité ; si tout va
  // bien, on remonte progressivement la qualité. Lissage exponentiel pour
  // éviter les oscillations visibles.
  const instFps = dt>0 ? 1/dt : 60;
  MRF.fpsAvg = MRF.fpsAvg*0.9 + instFps*0.1;
  if(MRF.fpsAvg < 36 && MRF.renderCols > 90){
    MRF.renderCols = Math.max(90, MRF.renderCols - 4);
  } else if(MRF.fpsAvg > 50 && MRF.renderCols < 200){
    MRF.renderCols = Math.min(200, MRF.renderCols + 2);
  }

  // Temps / cycle jour-nuit
  MRF.time = (MRF.time + dt/120) % 1;
  if(MRF.time < dt/120 && ts>2000) MRF.day++;

  // Physique
  physicsStep(dt);

  // Gyroscope → regard
  applyGyro();

  // Détection du double-regard haut→bas / bas→haut → toggle marche auto
  detectNodGesture(ts);

  // Avance automatique si activée
  if(MRF.autoWalk){
    movePlayer('forward');
  }

  // Raycasting : bloc visé
  const yaw=MRF.yaw, pitch=MRF.pitch;
  const dx=Math.cos(pitch)*Math.sin(-yaw), dy=Math.sin(pitch), dz=Math.cos(pitch)*Math.cos(-yaw);
  const gazeHit=raycast(MRF.camX,MRF.camY,MRF.camZ,dx,dy,dz,6);
  MRF.gazeTarget=gazeHit||null;

  // Gaze dwell (minage / placement de blocs) — désactivé pendant qu'on regarde un bouton d'interface
  if(gazeHit && !MRF.uiGazeEl){
    MRF.dwell=Math.min(1,(MRF.dwell||0)+dt/1.2);
    setGazeProgress(MRF.dwell);
    if(MRF.dwell>=1 && MRF.actionCooldown<=0){
      MRF.dwell=0;
      doBlockAction(gazeHit);
      MRF.actionCooldown=0.5;
    }
  } else {
    MRF.dwell=0; setGazeProgress(0);
  }
  if(MRF.actionCooldown>0) MRF.actionCooldown-=dt;

  // Gaze sur l'interface (boutons HUD / hotbar) — on peut "toucher" les éléments du regard
  updateUIGaze(ts);

  // Rendu
  renderFrame();
  updateHUD();

  MRF.animId=requestAnimationFrame(mainLoop);
}

function renderFrame(){
  const eyeL=document.getElementById('mrf-canvas-L');
  const eyeR=document.getElementById('mrf-canvas-R');
  if(!eyeL||!eyeR) return;
  const eL=eyeL.parentElement, eR=eyeR.parentElement;
  const w=eL.offsetWidth||320, h=eL.offsetHeight||240;
  if(eyeL.width!==w||eyeL.height!==h){eyeL.width=w;eyeL.height=h;}
  if(eyeR.width!==w||eyeR.height!==h){eyeR.width=w;eyeR.height=h;}
  const ctxL=eyeL.getContext('2d'), ctxR=eyeR.getContext('2d');
  // Lissage désactivé : on dessine des aplats nets (style voxel), et ça
  // évite un coût de filtrage inutile à chaque fillRect → plus fluide.
  ctxL.imageSmoothingEnabled=false; ctxR.imageSmoothingEnabled=false;
  ctxL.clearRect(0,0,w,h);
  ctxR.clearRect(0,0,w,h);
  renderView(ctxL,w,h,-1);
  renderView(ctxR,w,h,+1);

  // Highlight bloc visé (masqué si on regarde un bouton d'interface)
  if(MRF.gazeTarget && !MRF.uiGazeEl){
    [ctxL,ctxR].forEach(ctx=>{
      ctx.strokeStyle='rgba(255,255,255,.6)';
      ctx.lineWidth=2;
      const cx=w/2, cy=h/2-MRF.pitch*h*.35;
      ctx.strokeRect(cx-18,cy-18,36,36);
      // Nom du bloc
      const bn=BLOCKS[MRF.gazeTarget.block]?.name||'?';
      ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(cx-30,cy-36,60,16);
      ctx.fillStyle='#fff';ctx.font='10px monospace';ctx.textAlign='center';
      ctx.fillText(bn,cx,cy-24);
    });
  }
}

function doBlockAction(hit){
  if(MRF.mode==='mine'){
    setBlock(hit.bx,hit.by,hit.bz,0);
    playMineSound();
  } else {
    const placeType=HOTBAR_BLOCKS[MRF.hotbarIdx];
    setBlock(hit.prevBx,hit.prevBy,hit.prevBz,placeType);
    playPlaceSound();
  }
}

/* ─── Tête / regard ───
   On réutilise directement la rotation de la caméra A-Frame principale
   (camL), déjà pilotée par le composant look-controls natif d'A-Frame
   (magicWindowTrackingEnabled). C'est la même rotation que celle utilisée
   partout ailleurs dans l'app pour suivre les mouvements de tête dans le
   casque : elle gère nativement la rotation complète à 360° (via
   quaternions internes), sans le saut/blocage qu'on a avec un calcul
   manuel à partir des angles alpha/beta bruts du capteur. */
function applyGyro(){
  if(!camL || !camL.object3D) return;
  const o3d = camL.object3D;
  if(MRF.gyroBase===null){
    MRF.gyroBase = { yaw:o3d.rotation.y, pitch:o3d.rotation.x };
  }
  MRF.yaw   = normalizeAngle(o3d.rotation.y - MRF.gyroBase.yaw);
  MRF.pitch = Math.max(-1.3, Math.min(1.3, o3d.rotation.x - MRF.gyroBase.pitch));
}

function setupGyro(){
  /* Conservé pour compatibilité mais ne fait plus rien : la lecture du
     regard se fait désormais via applyGyro() à chaque frame, branchée
     sur la vraie rotation de tête (look-controls). */
}

/* Ramène un angle dans l'intervalle [-PI, PI] pour permettre une rotation à 360° fluide */
function normalizeAngle(a){
  a = a % (Math.PI*2);
  if(a > Math.PI) a -= Math.PI*2;
  if(a < -Math.PI) a += Math.PI*2;
  return a;
}


/* ─── Double-regard haut→bas ou bas→haut rapide = bascule la marche automatique ───
   On suit le pitch réel de la tête (gyroscope du casque) et on détecte un
   "coup de tête" net : le regard part d'une position neutre, dépasse un
   seuil dans une direction (NOD_TRIGGER), puis repasse cette même
   amplitude dans l'autre sens en moins de NOD_MAX_GAP millisecondes.
   On compare donc à l'amplitude atteinte (l'extremum), pas à une simple
   différence entre deux frames qui serait toujours trop petite. */
function detectNodGesture(ts){
  if(ts < (MRF.nodCooldownUntil||0)) return; // anti-rebond juste après un toggle
  const p = MRF.pitch;

  if(MRF.nodPhase === 0){
    // En attente d'un premier mouvement franc vers le haut ou le bas
    if(p > NOD_TRIGGER){ MRF.nodPhase = 1; MRF.nodPhaseTime = ts; MRF.nodExtremum = p; }
    else if(p < -NOD_TRIGGER){ MRF.nodPhase = -1; MRF.nodPhaseTime = ts; MRF.nodExtremum = p; }
  } else if(MRF.nodPhase === 1){
    // On a regardé vers le haut : on retient le point le plus haut atteint
    if(p > MRF.nodExtremum) MRF.nodExtremum = p;
    // Puis on attend un retour net vers le bas, en dessous du seuil opposé
    if(p < -NOD_TRIGGER*0.4 && (ts - MRF.nodPhaseTime) < NOD_MAX_GAP){
      toggleAutoWalk();
      MRF.nodPhase = 0;
      MRF.nodCooldownUntil = ts + 600;
    } else if((ts - MRF.nodPhaseTime) > NOD_MAX_GAP){
      MRF.nodPhase = 0; // trop lent, geste expiré
    }
  } else if(MRF.nodPhase === -1){
    // Symétrique : on a regardé vers le bas, on attend le retour vers le haut
    if(p < MRF.nodExtremum) MRF.nodExtremum = p;
    if(p > NOD_TRIGGER*0.4 && (ts - MRF.nodPhaseTime) < NOD_MAX_GAP){
      toggleAutoWalk();
      MRF.nodPhase = 0;
      MRF.nodCooldownUntil = ts + 600;
    } else if((ts - MRF.nodPhaseTime) > NOD_MAX_GAP){
      MRF.nodPhase = 0;
    }
  }
}

function toggleAutoWalk(){
  MRF.autoWalk = !MRF.autoWalk;
  toast(MRF.autoWalk ? '🚶 Marche automatique activée' : '🛑 Marche automatique arrêtée');
}

/* ─── Gaze sur l'interface MineRaft (boutons HUD, hotbar) ───
   Permet de "toucher" les boutons et la barre d'objets uniquement avec le
   regard : on cherche, au centre de l'écran (où se trouve déjà le viseur),
   si un élément d'interface s'y trouve, puis on remplit une jauge de
   regard (UI_DWELL ms) avant de déclencher l'action — un retour visuel
   identique au viseur de minage, donc cohérent avec le reste du jeu. */
function getUIElementAtCenter(eyeId){
  const eye = document.getElementById(eyeId);
  if(!eye) return null;
  const bb = eye.getBoundingClientRect();
  const cx = bb.left + bb.width/2, cy = bb.top + bb.height/2;
  const stack = document.elementsFromPoint(cx, cy);
  return stack.find(n => n instanceof HTMLElement && n.hasAttribute('data-gaze')) || null;
}

function updateUIGaze(ts){
  const el = getUIElementAtCenter('mrf-eye-L');

  if(el !== MRF.uiGazeEl){
    if(MRF.uiGazeEl) MRF.uiGazeEl.setAttribute('data-gaze-active','false');
    MRF.uiGazeEl = el;
    MRF.uiGazeStart = ts;
    if(el){
      el.setAttribute('data-gaze-active','true');
      playMineSound();
    }
  }

  if(MRF.uiGazeEl){
    const progress = Math.min(1, (ts - MRF.uiGazeStart)/UI_DWELL);
    MRF.uiGazeProgress = progress;
    setGazeProgress(progress); // réutilise l'anneau de visée central comme jauge
    if(progress >= 1){
      const action = MRF.uiGazeEl.getAttribute('data-action');
      MRF.uiGazeEl.classList.add('gaze-flash');
      setTimeout(()=>{ if(MRF.uiGazeEl) MRF.uiGazeEl.classList.remove('gaze-flash'); }, 360);
      playPlaceSound();
      window.handleAction(action);
      MRF.uiGazeStart = ts + 450; // petit cooldown avant de pouvoir réactiver le même bouton
    }
  } else {
    MRF.uiGazeProgress = 0;
  }
}

/* ─── Sons ─── */
function playMineSound(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type='square';o.frequency.setValueAtTime(220,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+0.1);
    g.gain.setValueAtTime(0.18,ctx.currentTime);
    g.gain.linearRampToValueAtTime(0,ctx.currentTime+0.12);
    o.connect(g);g.connect(ctx.destination);
    o.start();o.stop(ctx.currentTime+0.14);
  }catch(_){}
}
function playPlaceSound(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type='triangle';o.frequency.setValueAtTime(500,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300,ctx.currentTime+0.06);
    g.gain.setValueAtTime(0.12,ctx.currentTime);
    g.gain.linearRampToValueAtTime(0,ctx.currentTime+0.08);
    o.connect(g);g.connect(ctx.destination);
    o.start();o.stop(ctx.currentTime+0.09);
  }catch(_){}
}

/* ─── Mouvement ─── */
function movePlayer(dir){
  const speed=0.6;
  const sinY=Math.sin(MRF.yaw), cosY=Math.cos(MRF.yaw);
  let dx=0,dz=0;
  if(dir==='forward'){dx=-sinY*speed;dz=-cosY*speed;}
  else if(dir==='back'){dx=sinY*speed;dz=cosY*speed;}
  else if(dir==='left'){dx=-cosY*speed;dz=sinY*speed;}
  else if(dir==='right'){dx=cosY*speed;dz=-sinY*speed;}
  const nx=MRF.camX+dx, nz=MRF.camZ+dz;
  // Collision blocs
  const bx=Math.floor(nx), bz=Math.floor(nz), by=Math.floor(MRF.camY-0.5);
  if(!getBlock(bx,by,Math.floor(MRF.camZ))&&!getBlock(bx,by+1,Math.floor(MRF.camZ))) MRF.camX=nx;
  if(!getBlock(Math.floor(MRF.camX),by,bz)&&!getBlock(Math.floor(MRF.camX),by+1,bz)) MRF.camZ=nz;
}

function jumpPlayer(){
  if(MRF.onGround){ MRF.velY=6; MRF.onGround=false; }
}

/* ─── API publique : lancer / quitter ─── */
window.launchMineRaft = function(){
  if(!MRF.world){
    toast('🌍 Génération du monde MineRaft…');
    setTimeout(()=>{
      generateWorld();
      // Spawn au-dessus du sol
      const sx=32,sz=32;
      MRF.camX=sx+.5; MRF.camZ=sz+.5;
      MRF.camY=getSurface(sx,sz)+2;
      MRF.yaw=0; MRF.pitch=0; MRF.gyroBase=null;
      MRF.time=0.25; MRF.day=1; MRF.dwell=0; MRF.hotbarIdx=0; MRF.mode='mine';
      MRF.velY=0;
      MRF.autoWalk=false; MRF.nodPhase=0; MRF.nodPhaseTime=0; MRF.nodExtremum=0; MRF.nodCooldownUntil=0;
      MRF.uiGazeEl=null; MRF.uiGazeStart=0; MRF.uiGazeProgress=0;
      MRF.renderCols=180; MRF.fpsAvg=60;
      _doLaunch();
    },80);
    return;
  }
  MRF.gyroBase=null; // recalibre le "zéro" sur la direction regardée à la relance
  MRF.autoWalk=false; MRF.nodPhase=0; MRF.nodPhaseTime=0; MRF.nodExtremum=0; MRF.nodCooldownUntil=0;
  MRF.uiGazeEl=null; MRF.uiGazeStart=0; MRF.uiGazeProgress=0;
  _doLaunch();
};
function _doLaunch(){
  const ov=document.getElementById('mineraft-overlay');
  if(ov) ov.classList.add('active');
  MRF.active=true;
  MRF.lastFrame=performance.now();
  MRF.animId=requestAnimationFrame(mainLoop);
  // Masquer le HUD principal
  document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.add('hidden'));
  toast('⛏️ MineRaft VR — Bouge la tête pour regarder, hoche-la pour avancer !');
}

window.closeMineRaft = function(){
  MRF.active=false;
  MRF.autoWalk=false;
  if(MRF.uiGazeEl){ MRF.uiGazeEl.setAttribute('data-gaze-active','false'); MRF.uiGazeEl=null; }
  if(MRF.animId){ cancelAnimationFrame(MRF.animId); MRF.animId=null; }
  const ov=document.getElementById('mineraft-overlay');
  if(ov) ov.classList.remove('active');
  // Restaurer le HUD
  document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.remove('hidden'));
  setGazeProgress(0);
};

/* ─── Gaze MineRaft : intercepter les actions ─── */
const _origHandleAction = window.handleAction;
window.handleAction = function(action){
  if(!action) return;
  if(action.startsWith('mrf:')){
    if(action==='mrf:exit'){ window.closeMineRaft(); return; }
    if(action==='mrf:mode:mine'){ MRF.mode='mine'; return; }
    if(action==='mrf:mode:place'){ MRF.mode='place'; return; }
    if(action==='mrf:hotbar:next'){ MRF.hotbarIdx=(MRF.hotbarIdx+1)%HOTBAR_BLOCKS.length; return; }
    if(action && action.startsWith('mrf:hotbar:select:')){
      const idx = parseInt(action.split(':')[3],10);
      if(!isNaN(idx) && idx>=0 && idx<HOTBAR_BLOCKS.length){ MRF.hotbarIdx=idx; MRF.mode='place'; }
      return;
    }
    if(action==='mrf:move:forward'){ movePlayer('forward'); return; }
    if(action==='mrf:move:back'){ movePlayer('back'); return; }
    if(action==='mrf:move:left'){ movePlayer('left'); return; }
    if(action==='mrf:move:right'){ movePlayer('right'); return; }
    if(action==='mrf:move:jump'){ jumpPlayer(); return; }
    return;
  }
  _origHandleAction(action);
};

// Intégrer dans gazeTick : quand MineRaft actif, le dwell est géré en interne
// mais les boutons latéraux (data-gaze) restent actifs via le système global

})();

/* ============================================================
   LOCKSCREEN — Fonctions globales
   ============================================================ */
// Charger le code sauvegardé
(function(){ try{ const s=localStorage.getItem('horizonPasscode'); if(s) state.lockscreenPasscode=s; }catch(_){} })();

function updateLockscreenBg(){
  const bg = state.lockscreenWallpaper ||
    'linear-gradient(160deg,#1a2a4a 0%,#0d1a35 40%,#0a1428 100%)';
  ['L','R'].forEach(s=>{
    const el = document.getElementById('ls-bg-'+s);
    if(!el) return;
    if(state.lockscreenWallpaper){
      el.style.backgroundImage = `url('${state.lockscreenWallpaper}')`;
      el.style.background = '';
    } else {
      el.style.backgroundImage = '';
      el.style.background = bg;
    }
  });
}

function openLockScreen(){
  const ov = document.getElementById('lockscreen-overlay');
  if(!ov) return;
  ov.classList.add('active');
  state.lockscreenActive = true;
  state.lockscreenInput = '';
  updateLockscreenBg();
  updateLockscreenTime();
  // Masquer le passcode panel au départ (affiche l'écran de veille)
  ['L','R'].forEach(s=>{
    const p = document.getElementById('ls-pc-panel-'+s);
    if(p) p.style.display='none';
  });
  // Masquer le HUD
  document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.add('hidden'));
  // Clic sur l'écran de veille → affiche le pavé
  ['L','R'].forEach(s=>{
    const eye = document.getElementById('ls-eye-'+s);
    if(!eye) return;
    eye.onclick = (e)=>{
      const panel = document.getElementById('ls-pc-panel-L');
      const panelR = document.getElementById('ls-pc-panel-R');
      if(panel && panel.style.display==='none'){
        panel.style.display='flex';
        if(panelR) panelR.style.display='flex';
      }
    };
  });
}

function closeLockScreen(){
  const ov = document.getElementById('lockscreen-overlay');
  if(!ov) return;
  ov.classList.remove('active');
  state.lockscreenActive = false;
  state.lockscreenInput = '';
  document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.remove('hidden'));
}

function updateLockscreenTime(){
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const timeStr = h+':'+m;
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = days[now.getDay()]+' '+months[now.getMonth()]+' '+now.getDate();
  ['L','R'].forEach(s=>{
    const tEl = document.getElementById('ls-time-'+s);
    const dEl = document.getElementById('ls-date-'+s);
    if(tEl) tEl.textContent = timeStr;
    if(dEl) dEl.textContent = dateStr;
  });
}
setInterval(updateLockscreenTime, 1000);

// Input lockscreen
let _lsInput = '';
function lsType(digit){
  if(!state.lockscreenActive) return;
  _lsInput += String(digit);
  // Mettre à jour les dots des deux yeux
  for(let i=0;i<6;i++){
    ['L','R'].forEach(s=>{
      const d = document.getElementById('ls-d-'+s+'-'+i);
      if(d) d.classList.toggle('filled', i < _lsInput.length);
    });
  }
  // Mettre à jour l'erreur
  ['L','R'].forEach(s=>{
    const e = document.getElementById('ls-err-'+s);
    if(e) e.textContent='';
  });
  if(_lsInput.length >= 6){
    setTimeout(()=>{
      if(_lsInput === state.lockscreenPasscode){
        closeLockScreen();
        toast('🔓 Déverrouillé !');
      } else {
        // Mauvais code
        ['L','R'].forEach(s=>{
          const e = document.getElementById('ls-err-'+s);
          if(e) e.textContent = 'Code incorrect. Réessayez.';
          for(let i=0;i<6;i++){
            const d = document.getElementById('ls-d-'+s+'-'+i);
            if(d) d.classList.remove('filled');
          }
        });
        _lsInput = '';
        // Shake animation
        ['L','R'].forEach(s=>{
          const pc = document.getElementById('ls-pc-panel-'+s);
          if(pc){
            pc.style.transition='transform .08s';
            pc.style.transform='translateX(8px)';
            setTimeout(()=>{ pc.style.transform='translateX(-8px)'; }, 80);
            setTimeout(()=>{ pc.style.transform='translateX(5px)'; }, 160);
            setTimeout(()=>{ pc.style.transform='translateX(0)'; }, 240);
          }
        });
      }
    }, 200);
  }
}

function lsBackspace(){
  if(_lsInput.length > 0){
    _lsInput = _lsInput.slice(0,-1);
    for(let i=0;i<6;i++){
      ['L','R'].forEach(s=>{
        const d = document.getElementById('ls-d-'+s+'-'+i);
        if(d) d.classList.toggle('filled', i < _lsInput.length);
      });
    }
  }
}

function lsCancel(){
  // Cacher le pavé
  ['L','R'].forEach(s=>{
    const p = document.getElementById('ls-pc-panel-'+s);
    if(p) p.style.display='none';
  });
  _lsInput = '';
}

// Ajouter "Verrouiller" dans la grille d'apps du menu principal
(function(){
  const orig = window.handleAction;
  window.handleAction = function(action){
    if(action === 'app:lockscreen'){ openLockScreen(); return; }
    orig(action);
  };
})();

/* ============================================================
   WOK & ZEN — Cooking Game : ouverture / fermeture de l'overlay
   (le moteur du jeu lui-même est défini plus bas, dans son propre
   <script>, et démarré à la demande via window.initCookingGame())
   ============================================================ */
(function(){
  window.openCookingGame = function(){
    const ov = document.getElementById('cooking-overlay');
    if(!ov) return;
    ov.classList.add('active');
    document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.add('hidden'));
    window.__forceHandMode = 'close';
    if(window.__handTrackAPI && !window.__handTrackAPI.isActive && typeof window.toggleHandTrack === 'function'){
      window.toggleHandTrack();
    }
    if(typeof window.__startCookingHandBridge === 'function') window.__startCookingHandBridge();
    if(typeof window.initCookingGame === 'function') window.initCookingGame();
    toast('🍳 Wok & Zen — Avance le doigt pour piocher, cercle pour remuer, secoue pour sauter !');
  };

  window.closeCookingGame = function(){
    window.__forceHandMode = null;
    const ov = document.getElementById('cooking-overlay');
    if(ov) ov.classList.remove('active');
    document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.remove('hidden'));
    if(typeof window.__stopCookingHandBridge === 'function') window.__stopCookingHandBridge();
    setGazeProgress(0);
    if(typeof window.destroyCookingGame === 'function') window.destroyCookingGame();
  };

  /* ─── Intercepter les actions du jeu de cuisine ─── */
  const _origHandleAction = window.handleAction;
  window.handleAction = function(action){
    if(!action) return;
    if(action === 'cooking:exit'){ window.closeCookingGame(); return; }
    if(action === 'cook:heat'){ if(window.cookToggleHeat) window.cookToggleHeat(); return; }
    if(action === 'cook:salt'){ if(window.cookAddSalt) window.cookAddSalt(); return; }
    if(action === 'cook:serve'){ if(window.cookServe) window.cookServe(); return; }
    _origHandleAction(action);
  };
})();

/* ============================================================
   COOKING GAME SIMULATOR — ouverture / fermeture de l'overlay
   (le moteur du jeu lui-même est défini plus bas, dans son propre
   <script>, et démarré à la demande via window.initCookingSimGame())
   ============================================================ */
(function(){
  window.openCookingSim = function(){
    const ov = document.getElementById('cksim-overlay');
    if(!ov) return;
    ov.classList.add('active');
    document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.add('hidden'));
    window.__forceHandMode = 'close';
    if(window.__handTrackAPI && !window.__handTrackAPI.isActive && typeof window.toggleHandTrack === 'function'){
      window.toggleHandTrack();
    }
    if(typeof window.__startCksimHandBridge === 'function') window.__startCksimHandBridge();
    if(typeof window.initCookingSimGame === 'function') window.initCookingSimGame();
    toast('🍔 Cooking Game Simulator — Avance le doigt pour piocher, cercle pour cuisiner, secoue pour retourner !');
  };

  window.closeCookingSim = function(){
    window.__forceHandMode = null;
    const ov = document.getElementById('cksim-overlay');
    if(ov) ov.classList.remove('active');
    document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.remove('hidden'));
    if(typeof window.__stopCksimHandBridge === 'function') window.__stopCksimHandBridge();
    setGazeProgress(0);
    if(typeof window.destroyCookingSimGame === 'function') window.destroyCookingSimGame();
  };

  /* ─── Intercepter les actions du jeu de cuisine ─── */
  const _origHandleAction3 = window.handleAction;
  window.handleAction = function(action){
    if(!action) return;
    if(action === 'cksim:exit'){ window.closeCookingSim(); return; }
    if(action === 'cksim:heat'){ if(window.cksimToggleHeat) window.cksimToggleHeat(); return; }
    if(action === 'cksim:salt'){ if(window.cksimAddSeason) window.cksimAddSeason(); return; }
    if(action === 'cksim:serve'){ if(window.cksimServe) window.cksimServe(); return; }
    _origHandleAction3(action);
  };
})();

/* ============================================================
   COOKING GAME SIMULATOR — Pilotage 100% mains : relie l'API
   globale de hand tracking aux événements souris que le moteur
   du jeu écoute nativement (mousedown/mousemove/mouseup).
   ============================================================ */
(function(){
  let bridgeActive = false;
  let wasPinching = false;

  function fireMouse(type, target, x, y){
    const ev = new MouseEvent(type, {
      clientX: x, clientY: y, bubbles: true, cancelable: true, view: window
    });
    target.dispatchEvent(ev);
  }

  function overDataGazeElement(x, y){
    const stack = document.elementsFromPoint(x, y);
    return stack.some(n => n instanceof HTMLElement && n.hasAttribute('data-gaze'));
  }

  function tick(){
    if(!bridgeActive) return;
    const ov = document.getElementById('cksim-overlay');
    const sceneWrap = document.getElementById('cksim-sceneWrap');
    const api = window.__handTrackAPI;
    const open = ov && ov.classList.contains('active');
    const active = open && sceneWrap && api && api.isActive && api.screen;

    if(active){
      const {pageX, pageY} = api.screen;
      const pinching = !!api.pinching;
      const onUI = overDataGazeElement(pageX, pageY);

      if(pinching && !wasPinching && !onUI){
        fireMouse('mousedown', sceneWrap, pageX, pageY);
      } else if(pinching && wasPinching){
        fireMouse('mousemove', window, pageX, pageY);
      } else if(!pinching && wasPinching){
        fireMouse('mouseup', window, pageX, pageY);
      }
      wasPinching = pinching && !onUI;
    } else if(wasPinching){
      fireMouse('mouseup', window, 0, 0);
      wasPinching = false;
    }
    requestAnimationFrame(tick);
  }

  window.__startCksimHandBridge = function(){
    if(bridgeActive) return;
    bridgeActive = true;
    wasPinching = false;
    requestAnimationFrame(tick);
  };
  window.__stopCksimHandBridge = function(){
    bridgeActive = false;
    if(wasPinching) fireMouse('mouseup', window, 0, 0);
    wasPinching = false;
  };
})();

/* ============================================================
   ECHOES OF YESTERDAY — ouverture / fermeture
   ============================================================ */
(function(){
  window.openEchoesGame = function(){
    const ov = document.getElementById('echoes-overlay');
    if(!ov) return;
    ov.classList.add('active');
    document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.add('hidden'));
    window.__forceHandMode = 'close';
    if(window.__handTrackAPI && !window.__handTrackAPI.isActive && typeof window.toggleHandTrack === 'function'){
      window.toggleHandTrack();
    }
    if(typeof window.__startEchoesBridge === 'function') window.__startEchoesBridge();
    if(typeof window.initEchoesGame === 'function') window.initEchoesGame();
  };
  window.closeEchoesGame = function(){
    if(window.speechSynthesis) speechSynthesis.cancel();
    window.__forceHandMode = null;
    const ov = document.getElementById('echoes-overlay');
    if(ov) ov.classList.remove('active');
    document.querySelectorAll('.hud-wrap').forEach(el=>el.classList.remove('hidden'));
    if(typeof window.__stopEchoesBridge === 'function') window.__stopEchoesBridge();
    setGazeProgress(0);
    if(typeof window.destroyEchoesGame === 'function') window.destroyEchoesGame();
  };
  /* ─── Intercepter les actions ─── */
  const _orig2 = window.handleAction;
  window.handleAction = function(action){
    if(!action) return;
    if(action === 'echoes:exit'){ window.closeEchoesGame(); return; }
    _orig2(action);
  };
})();

/* ============================================================
   WOK & ZEN — Pilotage 100% mains : relie l'API globale de hand
   tracking (window.__handTrackAPI, déjà utilisée pour le dwell/pinch
   de toute l'app) aux événements souris que le moteur du jeu écoute
   nativement (mousedown/mousemove/mouseup). Pincer au-dessus du wok
   = attraper/touiller/saler, exactement comme un glisser souris.
   ============================================================ */
(function(){
  let bridgeActive = false;
  let wasPinching = false;

  function fireMouse(type, target, x, y){
    const ev = new MouseEvent(type, {
      clientX: x, clientY: y, bubbles: true, cancelable: true, view: window
    });
    target.dispatchEvent(ev);
  }

  function overDataGazeElement(x, y){
    const stack = document.elementsFromPoint(x, y);
    return stack.some(n => n instanceof HTMLElement && n.hasAttribute('data-gaze'));
  }

  function tick(){
    if(!bridgeActive) return;
    const ov = document.getElementById('cooking-overlay');
    const sceneWrap = document.getElementById('cooking-sceneWrap');
    const api = window.__handTrackAPI;
    const open = ov && ov.classList.contains('active');
    const active = open && sceneWrap && api && api.isActive && api.screen;

    if(active){
      const {pageX, pageY} = api.screen;
      const pinching = !!api.pinching;
      // Si la main survole un bouton d'interface (ex: "✕ Quitter"), on laisse
      // le système de pinch-click global gérer ce clic et on ne touche pas au jeu.
      const onUI = overDataGazeElement(pageX, pageY);

      if(pinching && !wasPinching && !onUI){
        fireMouse('mousedown', sceneWrap, pageX, pageY);
      } else if(pinching && wasPinching){
        fireMouse('mousemove', window, pageX, pageY);
      } else if(!pinching && wasPinching){
        fireMouse('mouseup', window, pageX, pageY);
      }
      wasPinching = pinching && !onUI;
    } else if(wasPinching){
      fireMouse('mouseup', window, 0, 0);
      wasPinching = false;
    }
    requestAnimationFrame(tick);
  }

  window.__startCookingHandBridge = function(){
    if(bridgeActive) return;
    bridgeActive = true;
    wasPinching = false;
    requestAnimationFrame(tick);
  };
  window.__stopCookingHandBridge = function(){
    bridgeActive = false;
    if(wasPinching) fireMouse('mouseup', window, 0, 0);
    wasPinching = false;
  };
})();
