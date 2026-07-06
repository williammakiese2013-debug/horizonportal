/* ============================================================
   VR GAME MODULE — Dual-eye split-screen natif
   Injection dans les a-scene existants (eyeLeft / eyeRight)
   ============================================================ */
(function(){

  /* ---- Etat global ---- */
  const VRG = {
    hp:100, score:0, weapon:0,
    droids:[], crystals:[],
    spawnTimer:1, crystalTimer:8,
    gazeTarget:null, gazeTime:0,
    running:false, animId:null,
    lastFrame:0,
    gazeColor:'#ff2244',
  };

  const WEAPONS = [
    { name:'🔫 Pistolet', dmg:10,  color:'#44aaff', killTime:0.9 },
    { name:'⚡ Plasma',   dmg:30,  color:'#aa44ff', killTime:0.45 },
    { name:'💥 Canon',    dmg:100, color:'#ff4422', killTime:0.12 },
  ];

  /* Les deux scenes A-Frame existantes */
  function sceneL(){ return document.querySelector('#eyeLeft a-scene'); }
  function sceneR(){ return document.querySelector('#eyeRight a-scene'); }

  /* ---- Audio synth ---- */
  function beep(freq=440,dur=0.08,vol=0.3,type='square'){
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=type;o.frequency.value=freq;
      g.gain.setValueAtTime(vol,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      o.connect(g);g.connect(ctx.destination);
      o.start();o.stop(ctx.currentTime+dur);
    }catch(e){}
  }

  /* ---- Rand helper ---- */
  function rand(a,b){return a+Math.random()*(b-a);}

  /* ---- Crée un élément miroir dans la scène droite ---- */
  function mirror(elL){
    const elR = elL.cloneNode(true);
    elR.id = elL.id ? elL.id+'_R' : '';
    elR.setAttribute('data-vrg-mirror','');
    sceneR().appendChild(elR);
    return elR;
  }

  /* ---- Supprimer entité des deux scènes ---- */
  function removeEntity(entry){
    if(entry.elL && entry.elL.parentNode) entry.elL.parentNode.removeChild(entry.elL);
    if(entry.elR && entry.elR.parentNode) entry.elR.parentNode.removeChild(entry.elR);
  }

  /* ---- Construire l'environnement dans les deux scènes ---- */
  function buildEnv(){
    ['L','R'].forEach(side=>{
      const sc = side==='L'? sceneL() : sceneR();
      if(!sc) return;

      // Retirer l'ancien environnement VRG si présent
      sc.querySelectorAll('[data-vrg-env]').forEach(e=>e.remove());

      // Ciel noir étoilé
      const sky = document.createElement('a-sky');
      sky.setAttribute('color','#050510');
      sky.setAttribute('data-vrg-env','');
      sc.appendChild(sky);

      // Sol grille futuriste
      const ground = document.createElement('a-plane');
      ground.setAttribute('rotation','-90 0 0');
      ground.setAttribute('width','400');ground.setAttribute('height','400');
      ground.setAttribute('position','0 0 0');
      ground.setAttribute('material','color:#001133;wireframe:true');
      ground.setAttribute('data-vrg-env','');
      sc.appendChild(ground);

      // Lignes lumineuses sur le sol
      for(let x=-12;x<=12;x+=2){
        const ln=document.createElement('a-box');
        ln.setAttribute('width','0.04');ln.setAttribute('height','0.015');ln.setAttribute('depth','400');
        ln.setAttribute('position',x+' 0.01 0');
        ln.setAttribute('material','color:#0055ff;shader:flat;opacity:0.35');
        ln.setAttribute('data-vrg-env','');
        sc.appendChild(ln);
      }

      // Étoiles
      for(let i=0;i<120;i++){
        const theta=rand(0,Math.PI*2), phi=rand(0,Math.PI), r=rand(50,100);
        const s=document.createElement('a-sphere');
        s.setAttribute('position',{
          x:r*Math.sin(phi)*Math.cos(theta),
          y:r*Math.cos(phi),
          z:r*Math.sin(phi)*Math.sin(theta),
        });
        s.setAttribute('radius',rand(0.02,0.1));
        s.setAttribute('material','color:#ffffff;shader:flat;opacity:'+rand(0.4,1));
        s.setAttribute('data-vrg-env','');
        sc.appendChild(s);
      }
    });
  }

  /* ---- Masquer / restaurer le ciel photo original ---- */
  function hideSky(yes){
    ['skyL','skyR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.setAttribute('visible', yes?'false':'true');
    });
  }

  /* ---- Spawn droïde dans les deux scènes ---- */
  const DROID_COLS=['#ff3333','#ff6600','#ff00aa','#00ffcc'];
  function spawnDroid(){
    const angle=rand(0,Math.PI*2), dist=rand(8,22);
    const x=Math.sin(angle)*dist, z=-Math.cos(angle)*dist;
    const col=DROID_COLS[0|Math.random()*4];
    const hp = 50 + VRG.score*0.5;
    const speed = 0.5 + Math.min(VRG.score*0.01,1.5);

    function makeDroid(sc){
      const ent=document.createElement('a-entity');
      ent.setAttribute('position',x+' 1.6 '+z);
      ent.setAttribute('data-vrg-droid','');
      const body=document.createElement('a-box');
      body.setAttribute('width','0.5');body.setAttribute('height','0.7');body.setAttribute('depth','0.3');
      body.setAttribute('material','color:'+col+';emissive:'+col+';emissiveIntensity:0.4');
      ent.appendChild(body);
      const eye=document.createElement('a-sphere');
      eye.setAttribute('radius','0.12');eye.setAttribute('position','0 0.18 0.18');
      eye.setAttribute('material','color:#ff0000;emissive:#ff0000;emissiveIntensity:1;shader:flat');
      ent.appendChild(eye);
      sc.appendChild(ent);
      return ent;
    }

    const elL=makeDroid(sceneL());
    const elR=makeDroid(sceneR());
    VRG.droids.push({elL,elR,hp,maxHp:hp,speed,x,z});
  }

  /* ---- Spawn cristal ---- */
  function spawnCrystal(wIdx){
    if(wIdx>2) return;
    const angle=rand(0,Math.PI*2), dist=rand(4,14);
    const x=Math.sin(angle)*dist, z=-Math.cos(angle)*dist;
    const cols=['#44aaff','#aa44ff','#ff4422'];
    const col=cols[wIdx];

    function makeCrystal(sc){
      const ent=document.createElement('a-entity');
      ent.setAttribute('position',x+' 1.0 '+z);
      ent.setAttribute('data-vrg-crystal','');
      const gem=document.createElement('a-octahedron');
      gem.setAttribute('radius','0.38');
      gem.setAttribute('material','color:'+col+';emissive:'+col+';emissiveIntensity:0.7;transparent:true;opacity:0.88');
      ent.appendChild(gem);
      const ring=document.createElement('a-torus');
      ring.setAttribute('radius','0.55');ring.setAttribute('radius-tubular','0.025');
      ring.setAttribute('material','color:'+col+';emissive:'+col+';emissiveIntensity:0.5;shader:flat');
      ent.appendChild(ring);
      sc.appendChild(ent);
      return ent;
    }

    const elL=makeCrystal(sceneL());
    const elR=makeCrystal(sceneR());
    VRG.crystals.push({elL,elR,weaponIdx:wIdx,x,z});
  }

  /* ---- Mise à jour HUD ---- */
  function updateHUD(){
    const hp=Math.max(0,VRG.hp);
    const hf=document.getElementById('vrg-hp-fill');
    const sc=document.getElementById('vrg-score');
    const wl=document.getElementById('vrg-weapon-label');
    if(hf) hf.style.width=hp+'%';
    if(sc) sc.textContent=VRG.score;
    if(wl) wl.textContent=WEAPONS[VRG.weapon].name+' · '+WEAPONS[VRG.weapon].dmg+' dmg';
  }

  function flashWeapon(){
    const wl=document.getElementById('vrg-weapon-label');
    if(!wl) return;
    wl.classList.add('show');
    clearTimeout(wl._t);
    wl._t=setTimeout(()=>wl.classList.remove('show'),2500);
  }

  /* ---- Gaze arc de charge ---- */
  function setGazeArc(pct, col='#ffffff'){
    const c=document.getElementById('vrg-gaze-circle');
    if(!c) return;
    const circ=2*Math.PI*17; // r=17
    c.style.strokeDashoffset = circ*(1-pct);
    c.style.stroke=col;
  }

  function setCursorState(state){
    // state: 'idle' | 'aim' | 'pickup'
    const d=document.getElementById('vrg-cursor-div');
    if(!d) return;
    d.classList.remove('aim','pickup');
    if(state!=='idle') d.classList.add(state);
  }

  /* ---- Game Over ---- */
  function gameOver(){
    VRG.running=false;
    cancelAnimationFrame(VRG.animId);
    const go=document.getElementById('vrg-gameover');
    const gs=document.getElementById('vrg-go-score');
    if(go) go.classList.add('show');
    if(gs) gs.textContent='Score : '+VRG.score;
    beep(150,0.6,0.5,'sawtooth');
  }

  /* ---- Raycasting simplifié : distance droïde/cristal vs regard ---- */
  function getGazedEntity(){
    // Utilise camL (oeil gauche interactif) pour le vecteur de regard
    const camEl=document.getElementById('camL');
    if(!camEl||!camEl.object3D) return null;

    const camPos=new THREE.Vector3();
    const camDir=new THREE.Vector3();
    camEl.object3D.getWorldPosition(camPos);
    camEl.object3D.getWorldDirection(camDir);

    let bestDist=Infinity, bestEntry=null, bestType=null;

    // Teste chaque droïde
    VRG.droids.forEach(d=>{
      if(!d.elL) return;
      const ep=new THREE.Vector3(d.x,1.6,d.z);
      const toE=ep.clone().sub(camPos);
      const dotD=toE.dot(camDir);
      if(dotD<0.5) return; // derrière
      const proj=camPos.clone().add(camDir.clone().multiplyScalar(dotD));
      const lateral=ep.distanceTo(proj);
      if(lateral<0.7 && dotD<bestDist){bestDist=dotD;bestEntry=d;bestType='droid';}
    });

    // Teste chaque cristal
    VRG.crystals.forEach(c=>{
      if(!c.elL) return;
      const ep=new THREE.Vector3(c.x,1.0,c.z);
      const toE=ep.clone().sub(camPos);
      const dotD=toE.dot(camDir);
      if(dotD<0.5) return;
      const proj=camPos.clone().add(camDir.clone().multiplyScalar(dotD));
      const lateral=ep.distanceTo(proj);
      if(lateral<0.9 && dotD<bestDist){bestDist=dotD;bestEntry=c;bestType='crystal';}
    });

    return bestEntry?{entry:bestEntry,type:bestType,dist:bestDist}:null;
  }

  /* ---- Boucle de jeu principale ---- */
  function gameTick(ts){
    if(!VRG.running) return;
    VRG.animId=requestAnimationFrame(gameTick);
    const dt=Math.min((ts-VRG.lastFrame)/1000,0.08);
    VRG.lastFrame=ts;

    /* -- Déplacement automatique : avance dans la direction du regard -- */
    const camL_el=document.getElementById('camL');
    if(camL_el&&camL_el.object3D){
      const dir=new THREE.Vector3();
      camL_el.object3D.getWorldDirection(dir);
      dir.y=0;
      if(dir.length()>0.001) dir.normalize();
      const spd=2.5;
      // Déplace toutes les entités en sens INVERSE (monde se déplace, caméra fixe)
      const dx=dir.x*spd*dt, dz=dir.z*spd*dt;

      VRG.droids.forEach(d=>{
        d.x-=dx; d.z-=dz;
        if(d.elL) d.elL.object3D.position.set(d.x,1.6,d.z);
        if(d.elR) d.elR.object3D.position.set(d.x,1.6,d.z);
      });
      VRG.crystals.forEach(c=>{
        c.x-=dx; c.z-=dz;
      });
      // Décale aussi les lignes du sol (looping)
      // (simplifié : on déplace l'origine du rig s'il existe — ici camL fixe, monde bouge)
    }

    /* -- Timers spawn -- */
    VRG.spawnTimer-=dt;
    VRG.crystalTimer-=dt;
    if(VRG.spawnTimer<=0){
      spawnDroid();
      VRG.spawnTimer=Math.max(0.8,3.0-VRG.score*0.02);
    }
    if(VRG.crystalTimer<=0&&VRG.crystals.length<3){
      const nw=Math.min(VRG.weapon+1,2);
      if(nw>0||Math.random()<0.4) spawnCrystal(nw);
      VRG.crystalTimer=12;
    }

    /* -- IA droïdes : ils avancent vers la caméra (0,1.6,0) -- */
    const camPos=new THREE.Vector3(0,1.6,0);
    for(let i=VRG.droids.length-1;i>=0;i--){
      const d=VRG.droids[i];
      if(!d.elL||!d.elL.parentNode){VRG.droids.splice(i,1);continue;}
      const dx=camPos.x-d.x, dz=camPos.z-d.z;
      const dist=Math.sqrt(dx*dx+dz*dz);
      if(dist<1.4){
        VRG.hp-=12*dt;
        if(VRG.hp<=0){gameOver();return;}
        updateHUD();
        continue;
      }
      const step=d.speed*dt;
      d.x+=dx/dist*step; d.z+=dz/dist*step;
      const ry=Math.atan2(dx,dz);
      if(d.elL) d.elL.object3D.position.set(d.x,1.6,d.z);
      if(d.elR) d.elR.object3D.position.set(d.x,1.6,d.z);
      if(d.elL) d.elL.object3D.rotation.y=ry;
      if(d.elR) d.elR.object3D.rotation.y=ry;
      // Pulse de l'œil
      const t=Date.now()/400;
      const sc=1+0.15*Math.sin(t);
      const eye=d.elL.querySelector('a-sphere');
      if(eye) eye.object3D.scale.set(sc,sc,sc);
      const eyeR=d.elR&&d.elR.querySelector('a-sphere');
      if(eyeR) eyeR.object3D.scale.set(sc,sc,sc);
    }

    /* -- Flottement cristaux -- */
    const t2=Date.now()/800;
    VRG.crystals.forEach(c=>{
      const py=1.0+0.2*Math.sin(t2);
      if(c.elL){c.elL.object3D.position.set(c.x,py,c.z);c.elL.object3D.rotation.y+=0.015;}
      if(c.elR){c.elR.object3D.position.set(c.x,py,c.z);c.elR.object3D.rotation.y+=0.015;}
    });

    /* -- Gaze : raycasting custom depuis camL -- */
    let gazed=null;
    try{ gazed=getGazedEntity(); }catch(e){}

    if(gazed){
      const killTime=gazed.type==='droid'?WEAPONS[VRG.weapon].killTime:2.0;
      if(VRG.gazeTarget!==gazed.entry){ VRG.gazeTarget=gazed.entry; VRG.gazeTime=0; }
      VRG.gazeTime+=dt;
      const pct=Math.min(VRG.gazeTime/killTime,1);
      const isShoot=gazed.type==='droid';
      setCursorState(isShoot?'aim':'pickup');
      setGazeArc(pct, isShoot?'#ff8800':'#44ffaa');

      if(VRG.gazeTime>=killTime){
        VRG.gazeTime=0;
        VRG.gazeTarget=null;
        if(gazed.type==='droid'){
          const d=gazed.entry;
          d.hp-=WEAPONS[VRG.weapon].dmg;
          if(d.hp<=0){
            removeEntity(d);
            VRG.droids.splice(VRG.droids.indexOf(d),1);
            VRG.score+=10+VRG.weapon*15;
            updateHUD();
            beep(880,0.06,0.25,'square');
          } else {
            beep(660,0.04,0.18,'square');
          }
        } else {
          // Ramassage cristal
          const c=gazed.entry;
          VRG.weapon=c.weaponIdx;
          removeEntity(c);
          VRG.crystals.splice(VRG.crystals.indexOf(c),1);
          updateHUD();flashWeapon();
          beep(660,0.12,0.3,'sine');
          setTimeout(()=>beep(880,0.12,0.3,'sine'),120);
        }
        setGazeArc(0);
        setCursorState('idle');
      }
    } else {
      VRG.gazeTarget=null; VRG.gazeTime=0;
      setCursorState('idle'); setGazeArc(0);
    }
  }

  /* ---- Réinitialiser jeu ---- */
  function resetGame(){
    VRG.hp=100;VRG.score=0;VRG.weapon=0;
    VRG.spawnTimer=1;VRG.crystalTimer=8;
    VRG.gazeTarget=null;VRG.gazeTime=0;VRG.running=true;

    // Supprimer entités précédentes
    VRG.droids.forEach(removeEntity); VRG.droids=[];
    VRG.crystals.forEach(removeEntity); VRG.crystals=[];

    // Effacer anciens env VRG
    ['L','R'].forEach(side=>{
      const sc=side==='L'?sceneL():sceneR();
      if(sc) sc.querySelectorAll('[data-vrg-env],[data-vrg-droid],[data-vrg-crystal]').forEach(e=>e.remove());
    });

    buildEnv();
    hideSky(true);
    const go=document.getElementById('vrg-gameover');
    if(go) go.classList.remove('show');
    updateHUD();flashWeapon();
    setCursorState('idle');setGazeArc(0);
  }

  /* ---- API publique ---- */
  window.openVRGame=function(){
    const hud=document.getElementById('vrg-hud');
    if(hud) hud.classList.add('active');
    resetGame();
    VRG.lastFrame=performance.now();
    VRG.animId=requestAnimationFrame(gameTick);
    beep(440,0.12,0.3,'sine');
    setTimeout(()=>beep(550,0.12,0.3,'sine'),120);
    // Masquer les HUD habituels pendant le jeu
    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.opacity='0';
    });
  };

  window.closeVRGame=function(){
    VRG.running=false;
    cancelAnimationFrame(VRG.animId);
    const hud=document.getElementById('vrg-hud');
    if(hud) hud.classList.remove('active');
    // Nettoyer entités VRG des scènes
    VRG.droids.forEach(removeEntity); VRG.droids=[];
    VRG.crystals.forEach(removeEntity); VRG.crystals=[];
    ['L','R'].forEach(side=>{
      const sc=side==='L'?sceneL():sceneR();
      if(sc) sc.querySelectorAll('[data-vrg-env],[data-vrg-droid],[data-vrg-crystal]').forEach(e=>e.remove());
    });
    hideSky(false);
    setCursorState('idle');setGazeArc(0);
    // Restaurer HUD habituels
    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.opacity='';
    });
  };

  window.restartVRGame=function(){
    cancelAnimationFrame(VRG.animId);
    resetGame();
    VRG.lastFrame=performance.now();
    VRG.animId=requestAnimationFrame(gameTick);
  };

})();

