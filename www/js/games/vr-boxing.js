/* ============================================================
   VR BOXING — GigaBox 3D (Seyran Veyron Boss Fight)
   Adapté au Game Launcher Horizon VR :
   - Rendu stéréo réel (deux caméras/canvas, une scène 3D partagée)
   - Déplacement par la tête : tourner le regard vers un endroit où
     le bot n'est PAS présent fait avancer automatiquement le joueur
     dans cette direction (pas de joystick).
   - Coup de poing par hand tracking : un mouvement rapide de la main
     détectée (via window.__handTrackAPI, MediaPipe) déclenche un jab
     (main côté gauche de l'écran) ou un cross (côté droit).
   - Plus de bouton garde/esquive : contrôles volontairement réduits
     à "cogner" + "avancer du regard", comme demandé.
   ============================================================ */
(function(){

  const VRB = {
    running:false, animId:null,
    scene:null, camL:null, camR:null, rendererL:null, rendererR:null,
    canvasL:null, canvasR:null,
    headPos:null, eyeHeight:1.65,
    yaw:0, pitch:0, gyroBase:null,
    opponent:null, hurtboxHead:null, hurtboxBody:null,
    aiSkinMat:null,
    leftGloveGuard:null, rightGloveGuard:null,
    glovesL:{left:null,right:null}, glovesR:{left:null,right:null},
    aiLeftGlove:null, aiRightGlove:null, aiLeftGloveGuard:null, aiRightGloveGuard:null,
    particleGroup:null, activeParticles:[],
    crowdEntities:[], crowdAnimationIntensity:1,
    raycaster:null, camShakeIntensity:0,
    handPrevPt:null, punchCooldown:0,
    clock:null,
    state:{
      player:{ health:100, stamina:100, isBlocking:false, isDodging:false },
      ai:{ health:100, stamina:100, currentPunchType:null },
      matchActive:false, timer:90, hitStopTimer:0
    },
    controls:{ activePunch:null, punchProgress:0 },
    aiCurrentState:0, aiStateTimer:0, aiOrbitAngle:0, aiPunchProgress:0
  };

  const AI_STATES = { IDLE:0, CHASE:1, ATTACK:2, HIT:3 };
  const IPD_HALF = 0.032;               // demi-écart inter-oculaire (mètres)
  const MOVE_ANGLE_THRESHOLD = 0.55;    // ~31° : au-delà, on considère qu'on regarde "à côté" du bot
  const MOVE_SPEED = 1.9;
  const RING_BOUND = 2.65;
  const PUNCH_SPEED_THRESHOLD = 1.35;   // vitesse normalisée écran/seconde qui déclenche un coup
  const PUNCH_COOLDOWN = 0.32;

  function camLElement(){ return document.getElementById('camL'); }

  /* ---- AUDIO (réutilise le système partagé de l'app) ---- */
  function playSoundPunch(){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(380,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(70,ctx.currentTime+0.14);
      g.gain.setValueAtTime(0.25,ctx.currentTime);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+0.14);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime+0.14);
    }catch(_){}
  }
  function playSoundHit(){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      const o=ctx.createOscillator(), g=ctx.createGain(), filter=ctx.createBiquadFilter();
      o.type='sawtooth'; o.frequency.setValueAtTime(110,ctx.currentTime);
      o.frequency.linearRampToValueAtTime(35,ctx.currentTime+0.16);
      filter.type='lowpass'; filter.frequency.setValueAtTime(280,ctx.currentTime);
      g.gain.setValueAtTime(0.75,ctx.currentTime);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+0.16);
      o.connect(filter); filter.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime+0.16);
    }catch(_){}
  }
  function playSoundBell(){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      const o1=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
      o1.type='sine'; o1.frequency.setValueAtTime(880,ctx.currentTime);
      o2.type='sine'; o2.frequency.setValueAtTime(1220,ctx.currentTime);
      g.gain.setValueAtTime(0.4,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.4);
      o1.connect(g); o2.connect(g); g.connect(ctx.destination);
      o1.start(); o2.start(); o1.stop(ctx.currentTime+1.4); o2.stop(ctx.currentTime+1.4);
    }catch(_){}
  }
  let crowdNoiseSource=null, crowdGain=null, crowdFilter=null;
  function startCrowdAudio(){
    try{
      const ctx=_getAudioCtx(); if(!ctx || crowdNoiseSource) return;
      const bufferSize=ctx.sampleRate*2;
      const buf=ctx.createBuffer(1,bufferSize,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<bufferSize;i++) d[i]=Math.random()*2-1;
      crowdNoiseSource=ctx.createBufferSource();
      crowdNoiseSource.buffer=buf; crowdNoiseSource.loop=true;
      crowdFilter=ctx.createBiquadFilter(); crowdFilter.type='lowpass';
      crowdFilter.frequency.setValueAtTime(280,ctx.currentTime);
      crowdGain=ctx.createGain(); crowdGain.gain.setValueAtTime(0.06,ctx.currentTime);
      crowdNoiseSource.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(ctx.destination);
      crowdNoiseSource.start();
    }catch(_){}
  }
  function stopCrowdAudio(){
    try{ if(crowdNoiseSource){ crowdNoiseSource.stop(); crowdNoiseSource.disconnect(); } }catch(_){}
    crowdNoiseSource=null; crowdGain=null; crowdFilter=null;
  }
  function triggerCrowdCheer(){
    try{
      const ctx=_getAudioCtx(); if(!ctx||!crowdGain||!crowdFilter) return;
      const now=ctx.currentTime;
      crowdGain.gain.cancelScheduledValues(now);
      crowdFilter.frequency.cancelScheduledValues(now);
      crowdGain.gain.setValueAtTime(crowdGain.gain.value,now);
      crowdGain.gain.linearRampToValueAtTime(0.35,now+0.08);
      crowdGain.gain.exponentialRampToValueAtTime(0.06,now+1.8);
      crowdFilter.frequency.setValueAtTime(crowdFilter.frequency.value,now);
      crowdFilter.frequency.linearRampToValueAtTime(650,now+0.1);
      crowdFilter.frequency.exponentialRampToValueAtTime(280,now+2.0);
      VRB.crowdAnimationIntensity=4.0;
    }catch(_){}
  }

  /* ---- MATÉRIAU TOON ---- */
  let toonGradient=null;
  function getToonMaterial(colorHex){
    if(!toonGradient){
      const c=document.createElement('canvas'); c.width=2;c.height=1;
      const g=c.getContext('2d');
      g.fillStyle='#555555'; g.fillRect(0,0,1,1);
      g.fillStyle='#ffffff'; g.fillRect(1,0,1,1);
      toonGradient=new THREE.CanvasTexture(c);
      toonGradient.minFilter=THREE.NearestFilter; toonGradient.magFilter=THREE.NearestFilter;
    }
    return new THREE.MeshToonMaterial({ color:colorHex, gradientMap:toonGradient });
  }

  /* ---- CONSTRUCTION DU MONDE (ring, foule, adversaire, gants) ---- */
  function buildWorld(){
    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x050508);
    scene.fog=new THREE.FogExp2(0x050508,0.07);

    const dirLight=new THREE.DirectionalLight(0xffffff,1.3);
    dirLight.position.set(5,11,4);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x24243a,0.65));

    /* Ring */
    const ringFloor=new THREE.Mesh(new THREE.BoxGeometry(8,0.5,8),getToonMaterial(0x121217));
    ringFloor.position.y=-0.25; scene.add(ringFloor);
    const canvasCenter=new THREE.Mesh(new THREE.BoxGeometry(6,0.51,6),getToonMaterial(0x56000f));
    canvasCenter.position.y=-0.25; scene.add(canvasCenter);

    const postGeo=new THREE.CylinderGeometry(0.1,0.1,2,8);
    const postMat=getToonMaterial(0x101014);
    [[3.8,3.8],[-3.8,3.8],[3.8,-3.8],[-3.8,-3.8]].forEach(c=>{
      const post=new THREE.Mesh(postGeo,postMat); post.position.set(c[0],1,c[1]); scene.add(post);
    });
    const ropeGeo=new THREE.CylinderGeometry(0.02,0.02,7.6,6);
    const ropeMat=getToonMaterial(0xcbcbcb);
    for(let h=0.5; h<=1.7; h+=0.5){
      let r1=new THREE.Mesh(ropeGeo,ropeMat); r1.rotation.z=Math.PI/2; r1.position.set(0,h,3.78); scene.add(r1);
      let r2=new THREE.Mesh(ropeGeo,ropeMat); r2.rotation.z=Math.PI/2; r2.position.set(0,h,-3.78); scene.add(r2);
      let r3=new THREE.Mesh(ropeGeo,ropeMat); r3.rotation.x=Math.PI/2; r3.position.set(3.78,h,0); scene.add(r3);
      let r4=new THREE.Mesh(ropeGeo,ropeMat); r4.rotation.x=Math.PI/2; r4.position.set(-3.78,h,0); scene.add(r4);
    }

    /* Foule (simplifiée pour perf mobile) */
    const crowdGroup=new THREE.Group();
    const bodyGeo=new THREE.CylinderGeometry(0.12,0.15,0.4,6);
    const headGeo=new THREE.SphereGeometry(0.1,8,8);
    const colors=[0x3a3d52,0x5a2d36,0x224455,0x443355,0x1c2d3d,0x665544];
    function createSpectator(x,y,z){
      const peep=new THREE.Group(); peep.position.set(x,y,z);
      const shirtMat=getToonMaterial(colors[Math.floor(Math.random()*colors.length)]);
      const headMat=getToonMaterial(0xdfa07e);
      const body=new THREE.Mesh(bodyGeo,shirtMat); body.position.y=0.2;
      const head=new THREE.Mesh(headGeo,headMat); head.position.y=0.45;
      peep.add(body,head); crowdGroup.add(peep);
      VRB.crowdEntities.push({ mesh:peep, baseY:y, phase:Math.random()*Math.PI*2, speedMultiplier:0.8+Math.random()*0.5 });
    }
    const sides=[
      { dir:'north', z:-5.5, startX:-6, endX:6 },
      { dir:'south', z:5.5,  startX:-6, endX:6 },
      { dir:'east',  x:5.5,  startZ:-6, endZ:6 },
      { dir:'west',  x:-5.5, startZ:-6, endZ:6 }
    ];
    sides.forEach(side=>{
      for(let step=0; step<2; step++){
        const rowY=0.1+step*0.35, rowDepth=step*0.5;
        if(side.dir==='north'||side.dir==='south'){
          for(let x=side.startX; x<=side.endX; x+=0.8){
            if(Math.random()>0.2) createSpectator(x,rowY, side.z+(side.dir==='north'?-rowDepth:rowDepth));
          }
        } else {
          for(let z=side.startZ; z<=side.endZ; z+=0.8){
            if(Math.random()>0.2) createSpectator(side.x+(side.dir==='east'?rowDepth:-rowDepth),rowY,z);
          }
        }
      }
    });
    scene.add(crowdGroup);

    /* Gants joueur (guard positions, dupliqués par oeil plus bas) */
    const gloveGeo=new THREE.SphereGeometry(0.14,14,14); gloveGeo.scale(1,1,1.4);
    const playerGloveMat=getToonMaterial(0x00d2ff);
    VRB.leftGloveGuard=new THREE.Vector3(-0.25,-0.25,-0.45);
    VRB.rightGloveGuard=new THREE.Vector3(0.25,-0.25,-0.45);
    VRB.gloveGeo=gloveGeo; VRB.playerGloveMat=playerGloveMat;

    /* Adversaire — Seyran Veyron */
    const opponent=new THREE.Group();
    opponent.position.set(0,0,-1.8);
    const aiSkinMat=getToonMaterial(0xdfa07e);
    const aiShortsMat=getToonMaterial(0x2b2d42);
    const aiGloveMat=getToonMaterial(0xd4af37);
    VRB.aiSkinMat=aiSkinMat;

    const aiPelvis=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.3,0.32,16),aiShortsMat); aiPelvis.position.y=0.55;
    const aiAbsBase=new THREE.Mesh(new THREE.CylinderGeometry(0.37,0.32,0.32,16),aiSkinMat); aiAbsBase.position.y=0.85;
    const aiChest=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.37,0.45,16),aiSkinMat); aiChest.position.y=1.22;
    const pecGeo=new THREE.SphereGeometry(0.2,14,10); pecGeo.scale(1,0.65,0.4);
    const leftPec=new THREE.Mesh(pecGeo,aiSkinMat); leftPec.position.set(-0.17,1.28,0.46); leftPec.rotation.z=0.1;
    const rightPec=new THREE.Mesh(pecGeo,aiSkinMat); rightPec.position.set(0.17,1.28,0.46); rightPec.rotation.z=-0.1;
    const shoulderGeo=new THREE.SphereGeometry(0.19,14,10);
    const leftShoulder=new THREE.Mesh(shoulderGeo,aiSkinMat); leftShoulder.position.set(-0.56,1.35,0);
    const rightShoulder=new THREE.Mesh(shoulderGeo,aiSkinMat); rightShoulder.position.set(0.56,1.35,0);
    const aiNeck=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.15,0.15,12),aiSkinMat); aiNeck.position.y=1.52;
    const aiHead=new THREE.Mesh(new THREE.SphereGeometry(0.23,14,14),aiSkinMat); aiHead.position.y=1.68;

    opponent.add(aiPelvis,aiAbsBase,aiChest,leftPec,rightPec,leftShoulder,rightShoulder,aiNeck,aiHead);

    const aiLeftGlove=new THREE.Mesh(gloveGeo,aiGloveMat);
    const aiRightGlove=new THREE.Mesh(gloveGeo,aiGloveMat);
    const aiLeftGloveGuard=new THREE.Vector3(-0.32,1.4,0.35);
    const aiRightGloveGuard=new THREE.Vector3(0.32,1.4,0.35);
    aiLeftGlove.position.copy(aiLeftGloveGuard);
    aiRightGlove.position.copy(aiRightGloveGuard);
    opponent.add(aiLeftGlove,aiRightGlove);

    const hurtboxHead=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,8),new THREE.MeshBasicMaterial({visible:false}));
    hurtboxHead.position.y=1.68; hurtboxHead.name='head';
    const hurtboxBody=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.3,1.1,8),new THREE.MeshBasicMaterial({visible:false}));
    hurtboxBody.position.y=1.1; hurtboxBody.name='body';
    opponent.add(hurtboxHead,hurtboxBody);
    scene.add(opponent);

    VRB.opponent=opponent;
    VRB.hurtboxHead=hurtboxHead; VRB.hurtboxBody=hurtboxBody;
    VRB.aiLeftGlove=aiLeftGlove; VRB.aiRightGlove=aiRightGlove;
    VRB.aiLeftGloveGuard=aiLeftGloveGuard; VRB.aiRightGloveGuard=aiRightGloveGuard;

    /* Particules d'impact */
    const particleGroup=new THREE.Group(); scene.add(particleGroup);
    VRB.particleGroup=particleGroup;

    VRB.scene=scene;
    VRB.raycaster=new THREE.Raycaster();
  }

  function makePlayerGloves(){
    const l=new THREE.Mesh(VRB.gloveGeo, VRB.playerGloveMat);
    const r=new THREE.Mesh(VRB.gloveGeo, VRB.playerGloveMat);
    l.position.copy(VRB.leftGloveGuard); r.position.copy(VRB.rightGloveGuard);
    return { left:l, right:r };
  }

  function spawnImpactParticles(pos){
    const pCount=10;
    const pGeo=new THREE.BoxGeometry(0.022,0.022,0.022);
    const pMat=new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.85 });
    for(let i=0;i<pCount;i++){
      const mesh=new THREE.Mesh(pGeo,pMat);
      mesh.position.copy(pos);
      const velocity=new THREE.Vector3((Math.random()-0.5)*4.2,(Math.random()-0.1)*3.8,(Math.random()-0.5)*4.2);
      VRB.particleGroup.add(mesh);
      VRB.activeParticles.push({ mesh, velocity, life:0.28+Math.random()*0.22 });
    }
  }
  function updateParticles(dt){
    for(let i=VRB.activeParticles.length-1;i>=0;i--){
      const p=VRB.activeParticles[i];
      p.life-=dt;
      p.mesh.position.addScaledVector(p.velocity,dt);
      p.velocity.y-=9.81*dt;
      p.mesh.material.opacity=Math.max(0,p.life/0.5);
      if(p.life<=0){ VRB.particleGroup.remove(p.mesh); p.mesh.geometry.dispose(); VRB.activeParticles.splice(i,1); }
    }
  }
  function removeAllParticles(){
    VRB.activeParticles.forEach(p=>{ VRB.particleGroup.remove(p.mesh); p.mesh.geometry.dispose(); });
    VRB.activeParticles=[];
  }
  function updateCrowd(dt){
    VRB.crowdAnimationIntensity=THREE.MathUtils.lerp(VRB.crowdAnimationIntensity,1.0,dt*2.5);
    const time=performance.now()*0.003;
    VRB.crowdEntities.forEach(peep=>{
      let wave=Math.sin(time*3.5*peep.speedMultiplier+peep.phase);
      let offset=wave*0.03*VRB.crowdAnimationIntensity;
      if(VRB.crowdAnimationIntensity>1.8) offset+=Math.max(0,wave)*0.18*(VRB.crowdAnimationIntensity-1.0);
      peep.mesh.position.y=peep.baseY+offset;
    });
  }

  /* ---- RENDU STÉRÉO : deux canvases, deux caméras, une seule scène ---- */
  function ensureRenderers(){
    VRB.canvasL=document.getElementById('vrbox-canvas-L');
    VRB.canvasR=document.getElementById('vrbox-canvas-R');
    if(!VRB.rendererL){
      VRB.rendererL=new THREE.WebGLRenderer({ canvas:VRB.canvasL, antialias:true, powerPreference:'high-performance' });
      VRB.rendererL.setPixelRatio(Math.min(window.devicePixelRatio,2));
      VRB.camL=new THREE.PerspectiveCamera(70,1,0.1,50);
    }
    if(!VRB.rendererR){
      VRB.rendererR=new THREE.WebGLRenderer({ canvas:VRB.canvasR, antialias:true, powerPreference:'high-performance' });
      VRB.rendererR.setPixelRatio(Math.min(window.devicePixelRatio,2));
      VRB.camR=new THREE.PerspectiveCamera(70,1,0.1,50);
    }
    resizeRenderers();
  }
  function resizeRenderers(){
    if(!VRB.canvasL||!VRB.canvasR) return;
    const wL=VRB.canvasL.clientWidth||window.innerWidth/2, hL=VRB.canvasL.clientHeight||window.innerHeight;
    const wR=VRB.canvasR.clientWidth||window.innerWidth/2, hR=VRB.canvasR.clientHeight||window.innerHeight;
    VRB.rendererL.setSize(wL,hL,false);
    VRB.camL.aspect=wL/hL; VRB.camL.updateProjectionMatrix();
    VRB.rendererR.setSize(wR,hR,false);
    VRB.camR.aspect=wR/hR; VRB.camR.updateProjectionMatrix();
  }
  function onResize(){ if(VRB.running) resizeRenderers(); }

  /* ---- TÊTE / REGARD : on réutilise la rotation de la caméra A-Frame
     principale (camL du portail), pilotée par look-controls, exactement
     comme le fait mineraft-and-cooking-overlays.js. ---- */
  function applyGyro(){
    const el=camLElement();
    if(!el || !el.object3D) return;
    const o3d=el.object3D;
    if(VRB.gyroBase===null) VRB.gyroBase={ yaw:o3d.rotation.y, pitch:o3d.rotation.x };
    VRB.yaw=normalizeAngle(o3d.rotation.y - VRB.gyroBase.yaw);
    VRB.pitch=Math.max(-1.2,Math.min(1.2, o3d.rotation.x - VRB.gyroBase.pitch));
  }
  function normalizeAngle(a){
    a=a%(Math.PI*2); if(a>Math.PI) a-=Math.PI*2; if(a<-Math.PI) a+=Math.PI*2; return a;
  }

  /* ---- DÉPLACEMENT AUTOMATIQUE PAR LE REGARD ----
     Si le joueur regarde un endroit qui n'est pas occupé par le bot
     (angle entre le regard et la direction du bot au-delà du seuil),
     il avance automatiquement dans cette direction. Sinon (il fait
     face au bot), il reste sur place pour combattre. */
  function forwardVector(){
    const v=new THREE.Vector3(0,0,-1);
    v.applyEuler(new THREE.Euler(VRB.pitch,VRB.yaw,0,'YXZ'));
    v.y=0; if(v.lengthSq()>0) v.normalize();
    return v;
  }
  function updateAutoMove(dt){
    if(!VRB.state.matchActive) return;
    const fwd=forwardVector();
    const toward=new THREE.Vector3(VRB.opponent.position.x-VRB.headPos.x,0,VRB.opponent.position.z-VRB.headPos.z);
    if(toward.lengthSq()>0.0001) toward.normalize();
    const dot=THREE.MathUtils.clamp(fwd.dot(toward),-1,1);
    const cross=fwd.x*toward.z - fwd.z*toward.x;
    const angleOff=Math.atan2(cross,dot);
    if(Math.abs(angleOff) > MOVE_ANGLE_THRESHOLD){
      VRB.headPos.x=THREE.MathUtils.clamp(VRB.headPos.x+fwd.x*MOVE_SPEED*dt,-RING_BOUND,RING_BOUND);
      VRB.headPos.z=THREE.MathUtils.clamp(VRB.headPos.z+fwd.z*MOVE_SPEED*dt,-RING_BOUND,RING_BOUND);
    }
  }

  /* ---- HAND TRACKING : un mouvement rapide de la main détectée
     déclenche un coup de poing (jab si la main est côté gauche de
     l'écran, cross si côté droit). ---- */
  function pollHandPunch(dt){
    const api=window.__handTrackAPI;
    if(!api || !api.isActive){ VRB.handPrevPt=null; return; }
    const hands = api.allHands;
    if(!hands || !hands.length){ VRB.handPrevPt=null; return; }
    const wrist = hands[0][0]; // point 0 = poignet
    if(!wrist){ VRB.handPrevPt=null; return; }
    if(VRB.handPrevPt){
      const dx=wrist.x-VRB.handPrevPt.x, dy=wrist.y-VRB.handPrevPt.y;
      const speed=Math.sqrt(dx*dx+dy*dy)/Math.max(dt,0.001);
      if(VRB.punchCooldown<=0 && speed>PUNCH_SPEED_THRESHOLD && !VRB.controls.activePunch && VRB.state.player.stamina>=12){
        triggerPlayerPunch(wrist.x<0.5 ? 'jab':'cross');
        VRB.punchCooldown=PUNCH_COOLDOWN;
      }
    }
    VRB.handPrevPt={ x:wrist.x, y:wrist.y };
  }

  function triggerPlayerPunch(type){
    if(VRB.controls.activePunch) return;
    VRB.controls.activePunch=type;
    VRB.controls.punchProgress=0;
    playSoundPunch();
    if(type==='jab') VRB.state.player.stamina=Math.max(0,VRB.state.player.stamina-12);
    if(type==='cross') VRB.state.player.stamina=Math.max(0,VRB.state.player.stamina-18);
  }

  function animatePlayerPunches(dt){
    const g=VRB.controls.activePunch;
    if(!g){
      VRB.glovesL.left.position.lerp(VRB.leftGloveGuard,0.18);
      VRB.glovesL.right.position.lerp(VRB.rightGloveGuard,0.18);
      VRB.glovesR.left.position.copy(VRB.glovesL.left.position);
      VRB.glovesR.right.position.copy(VRB.glovesL.right.position);
      return;
    }
    VRB.controls.punchProgress += dt*3.5;
    const extension=Math.sin(VRB.controls.punchProgress*Math.PI);
    if(g==='jab'){
      VRB.glovesL.left.position.set(VRB.leftGloveGuard.x+0.1*extension, VRB.leftGloveGuard.y+0.05*extension, VRB.leftGloveGuard.z-1.2*extension);
    } else if(g==='cross'){
      VRB.glovesL.right.position.set(VRB.rightGloveGuard.x-0.2*extension, VRB.rightGloveGuard.y+0.05*extension, VRB.rightGloveGuard.z-1.4*extension);
    }
    VRB.glovesR.left.position.copy(VRB.glovesL.left.position);
    VRB.glovesR.right.position.copy(VRB.glovesL.right.position);

    if(VRB.controls.punchProgress>=0.45 && VRB.controls.punchProgress<=0.55) executePlayerRaycastDetection();
    if(VRB.controls.punchProgress>=1.0) VRB.controls.activePunch=null;
  }

  function executePlayerRaycastDetection(){
    VRB.raycaster.setFromCamera(new THREE.Vector2(0,0), VRB.camL);
    const hits=VRB.raycaster.intersectObjects([VRB.hurtboxHead,VRB.hurtboxBody]);
    if(hits.length>0 && hits[0].distance<2.3){
      const hitPart=hits[0].object.name;
      let damage=4;
      if(VRB.controls.activePunch==='cross') damage=8;
      VRB.state.ai.health=Math.max(0,VRB.state.ai.health-damage);
      playSoundHit();
      spawnImpactParticles(hits[0].point);
      triggerCrowdCheer();
      VRB.state.hitStopTimer=0.06;
      triggerAiHitReaction();
    }
  }

  function triggerAiHitReaction(){
    VRB.aiCurrentState=AI_STATES.HIT; VRB.aiStateTimer=0; VRB.aiPunchProgress=0;
    VRB.aiLeftGlove.position.copy(VRB.aiLeftGloveGuard);
    VRB.aiRightGlove.position.copy(VRB.aiRightGloveGuard);
    VRB.camShakeIntensity=0.15;
  }

  function processAiStateMachine(dt){
    VRB.aiStateTimer+=dt;
    const dist=VRB.opponent.position.distanceTo(new THREE.Vector3(VRB.headPos.x,VRB.opponent.position.y,VRB.headPos.z));
    VRB.opponent.lookAt(VRB.headPos.x, VRB.opponent.position.y, VRB.headPos.z);

    switch(VRB.aiCurrentState){
      case AI_STATES.IDLE:
        VRB.aiOrbitAngle += dt*0.75;
        const ox=VRB.headPos.x+Math.sin(VRB.aiOrbitAngle)*2.1;
        const oz=VRB.headPos.z+Math.cos(VRB.aiOrbitAngle)*2.1;
        VRB.opponent.position.lerp(new THREE.Vector3(ox,VRB.opponent.position.y,oz),0.09);
        if(VRB.aiStateTimer>1.0){
          VRB.aiCurrentState = Math.random()>0.3 ? AI_STATES.CHASE : AI_STATES.ATTACK;
          VRB.aiStateTimer=0;
        }
        break;
      case AI_STATES.CHASE:
        if(dist>1.6) VRB.opponent.translateZ(dt*1.8);
        else {
          VRB.aiCurrentState=AI_STATES.ATTACK; VRB.aiStateTimer=0;
          VRB.state.ai.currentPunchType = Math.random()>0.5 ? 'left':'right';
          playSoundPunch();
        }
        break;
      case AI_STATES.ATTACK:
        VRB.aiPunchProgress += dt*3.4;
        const punchExt=Math.sin(VRB.aiPunchProgress*Math.PI);
        if(VRB.state.ai.currentPunchType==='left'){
          VRB.aiLeftGlove.position.set(VRB.aiLeftGloveGuard.x, VRB.aiLeftGloveGuard.y, VRB.aiLeftGloveGuard.z+punchExt*1.35);
        } else {
          VRB.aiRightGlove.position.set(VRB.aiRightGloveGuard.x, VRB.aiRightGloveGuard.y, VRB.aiRightGloveGuard.z+punchExt*1.35);
        }
        if(VRB.aiPunchProgress>=0.45 && VRB.aiPunchProgress<=0.55 && dist<1.9){
          VRB.state.player.health=Math.max(0,VRB.state.player.health-8);
          VRB.camShakeIntensity=0.3;
          playSoundHit();
          spawnImpactParticles(new THREE.Vector3(VRB.headPos.x,VRB.eyeHeight-0.2,VRB.headPos.z-0.5));
          VRB.aiPunchProgress=0.6;
        }
        if(VRB.aiPunchProgress>=1.0){
          VRB.aiLeftGlove.position.copy(VRB.aiLeftGloveGuard);
          VRB.aiRightGlove.position.copy(VRB.aiRightGloveGuard);
          VRB.aiCurrentState=AI_STATES.IDLE; VRB.aiStateTimer=0; VRB.aiPunchProgress=0;
        }
        break;
      case AI_STATES.HIT:
        VRB.aiSkinMat.color.setHex(0xffffff);
        VRB.opponent.translateZ(-dt*2.2);
        if(VRB.aiStateTimer>0.12){
          VRB.aiSkinMat.color.setHex(0xdfa07e);
          VRB.aiCurrentState=AI_STATES.IDLE; VRB.aiStateTimer=0;
        }
        break;
    }
    VRB.opponent.position.x=THREE.MathUtils.clamp(VRB.opponent.position.x,-RING_BOUND,RING_BOUND);
    VRB.opponent.position.z=THREE.MathUtils.clamp(VRB.opponent.position.z,-RING_BOUND,RING_BOUND);
  }

  /* ---- HUD ---- */
  function updateHUD(){
    ['L','R'].forEach(side=>{
      const ph=document.getElementById('vrbox-p-health-'+side);
      const ps=document.getElementById('vrbox-p-stamina-'+side);
      const eh=document.getElementById('vrbox-e-health-'+side);
      const es=document.getElementById('vrbox-e-stamina-'+side);
      if(ph) ph.style.width=VRB.state.player.health+'%';
      if(ps) ps.style.width=VRB.state.player.stamina+'%';
      if(eh) eh.style.width=VRB.state.ai.health+'%';
      if(es) es.style.width=VRB.state.ai.stamina+'%';
    });
    const mins=Math.floor(Math.max(0,VRB.state.timer)/60), secs=Math.floor(Math.max(0,VRB.state.timer)%60);
    const timerEl=document.getElementById('vrbox-timer');
    if(timerEl) timerEl.textContent = String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
  }

  /* ---- BOUCLE PRINCIPALE ---- */
  function renderStereo(){
    const fwd=forwardVector();
    const right=new THREE.Vector3(fwd.z,0,-fwd.x); // perpendiculaire horizontale
    const py=VRB.eyeHeight + (VRB.camShakeIntensity>0.01 ? (Math.sin(performance.now()*0.07)*VRB.camShakeIntensity) : 0);

    VRB.camL.position.set(VRB.headPos.x-right.x*IPD_HALF, py, VRB.headPos.z-right.z*IPD_HALF);
    VRB.camR.position.set(VRB.headPos.x+right.x*IPD_HALF, py, VRB.headPos.z+right.z*IPD_HALF);
    VRB.camL.rotation.order='YXZ'; VRB.camR.rotation.order='YXZ';
    VRB.camL.rotation.set(VRB.pitch,VRB.yaw,0);
    VRB.camR.rotation.set(VRB.pitch,VRB.yaw,0);

    VRB.rendererL.render(VRB.scene, VRB.camL);
    VRB.rendererR.render(VRB.scene, VRB.camR);
  }

  function endBoxingMatch(){
    VRB.state.matchActive=false;
    playSoundBell();
    const scr=document.getElementById('vrbox-overlay-screen');
    const title=document.getElementById('vrbox-screen-title');
    if(scr) scr.style.display='flex';
    if(title){
      if(VRB.state.player.health<=0) title.innerHTML="K.O.<br><span style='color:#ff0055;'>SEYRAN VEYRON TRIOMPHE</span>";
      else if(VRB.state.ai.health<=0) title.innerHTML="VICTOIRE PAR K.O.<br><span style='color:#00fff0;'>SEYRAN EST AU TAPIS !</span>";
      else title.innerHTML = VRB.state.player.health>=VRB.state.ai.health ? "VICTOIRE AUX POINTS" : "DÉFAITE AUX POINTS";
    }
    const btn=document.getElementById('vrbox-btn-start');
    if(btn) btn.textContent='REVANCHER SEYRAN';
  }

  function gameTick(ts){
    if(!VRB.running) return;
    VRB.animId=requestAnimationFrame(gameTick);
    const dt=Math.min(VRB.clock.getDelta(),0.1);

    applyGyro();

    if(VRB.state.hitStopTimer>0){
      VRB.state.hitStopTimer-=dt;
      renderStereo();
      return;
    }

    if(VRB.state.matchActive){
      VRB.state.timer -= dt;
      if(VRB.state.timer<=0 || VRB.state.player.health<=0 || VRB.state.ai.health<=0) endBoxingMatch();

      if(!VRB.controls.activePunch && VRB.state.player.stamina<100){
        VRB.state.player.stamina=Math.min(100,VRB.state.player.stamina+dt*28);
      }
      if(VRB.punchCooldown>0) VRB.punchCooldown-=dt;

      pollHandPunch(dt);
      updateAutoMove(dt);
      animatePlayerPunches(dt);
      processAiStateMachine(dt);
      updateParticles(dt);
      updateCrowd(dt);
    }

    if(VRB.camShakeIntensity>0.01) VRB.camShakeIntensity*=0.86; else VRB.camShakeIntensity=0;

    updateHUD();
    renderStereo();
  }

  function resetGame(){
    VRB.state.player.health=100; VRB.state.player.stamina=100;
    VRB.state.ai.health=100; VRB.state.ai.stamina=100;
    VRB.state.timer=90; VRB.state.hitStopTimer=0;
    VRB.controls.activePunch=null; VRB.controls.punchProgress=0;
    VRB.aiCurrentState=AI_STATES.IDLE; VRB.aiStateTimer=0; VRB.aiOrbitAngle=0; VRB.aiPunchProgress=0;
    VRB.camShakeIntensity=0; VRB.punchCooldown=0; VRB.handPrevPt=null;
    VRB.headPos=new THREE.Vector3(0,0,2.2);
    VRB.yaw=0; VRB.pitch=0; VRB.gyroBase=null;
    if(VRB.opponent) VRB.opponent.position.set(0,0,-1.8);
    if(VRB.aiLeftGlove) VRB.aiLeftGlove.position.copy(VRB.aiLeftGloveGuard);
    if(VRB.aiRightGlove) VRB.aiRightGlove.position.copy(VRB.aiRightGloveGuard);
    removeAllParticles();
    updateHUD();
  }

  /* ---- API PUBLIQUE ---- */
  window.openVRBoxing = function(){
    const overlay=document.getElementById('vrbox-overlay');
    if(overlay) overlay.classList.add('active');

    if(!VRB.scene) buildWorld();
    ensureRenderers();
    if(!VRB.glovesL.left){
      VRB.glovesL=makePlayerGloves();
      VRB.glovesR=makePlayerGloves();
      VRB.camL.add(VRB.glovesL.left); VRB.camL.add(VRB.glovesL.right);
      VRB.camR.add(VRB.glovesR.left); VRB.camR.add(VRB.glovesR.right);
    }
    if(!VRB.clock) VRB.clock=new THREE.Clock();

    resetGame();

    const scr=document.getElementById('vrbox-overlay-screen');
    if(scr) scr.style.display='flex';

    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.style.opacity='0';
    });
    if(window.__handTrackAPI && !window.__handTrackAPI.isActive && typeof window.toggleHandTrack==='function'){
      window.toggleHandTrack();
    }

    window.addEventListener('resize', onResize);
    VRB.running=true;
    VRB.clock.getDelta();
    VRB.animId=requestAnimationFrame(gameTick);
    if(typeof toast==='function') toast('🥊 GigaBox 3D — tourne la tête pour te déplacer, bouge la main pour cogner !');
  };

  window.closeVRBoxing = function(){
    VRB.running=false;
    cancelAnimationFrame(VRB.animId);
    window.removeEventListener('resize', onResize);
    stopCrowdAudio();
    const overlay=document.getElementById('vrbox-overlay');
    if(overlay) overlay.classList.remove('active');
    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.style.opacity='';
    });
  };

  window.restartVRBoxing = function(){
    cancelAnimationFrame(VRB.animId);
    resetGame();
    const scr=document.getElementById('vrbox-overlay-screen');
    if(scr) scr.style.display='none';
    VRB.state.matchActive=true;
    startCrowdAudio();
    playSoundBell();
    VRB.clock.getDelta();
    VRB.running=true;
    VRB.animId=requestAnimationFrame(gameTick);
  };

  function wireStartButton(){
    const startBtn=document.getElementById('vrbox-btn-start');
    if(!startBtn) return;
    startBtn.addEventListener('pointerdown', function(e){
      e.stopPropagation();
      startCrowdAudio();
      playSoundBell();
      window.restartVRBoxing();
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', wireStartButton);
  } else {
    wireStartButton();
  }

})();
