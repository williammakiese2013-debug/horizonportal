/* ============================================================
   VR TENNIS — Amélioré : raquette texturée, bot adverse,
   monde vivant (public, arbres), sons réalistes
   ============================================================ */
(function(){

  const VRT = {
    running:false, animId:null, lastFrame:0,
    score:0, lives:3,
    racketHeld:false,
    restX:0, restY:1.05,
    prevRx:0, prevRy:1.05,
    smoothRx:0, smoothRy:1.05,
    ballActive:false, playerHit:false,
    ballPos:null, ballVel:null, bounces:0, hitCooldown:0,
    serveTimer:1.0, netHitCount:0,
    gravity:7.2, ballRadius:0.033,
    message:'', msgTimeout:null,
    racketL:null, racketR:null,
    ballL:null, ballR:null, shadowL:null, shadowR:null,
    particles:[], trail:[], trailTimer:0,
    touchActive:false, touchNX:0.5, touchNY:0.5,
    /* ---- BOT ---- */
    botL:null, botR:null,
    botRacketL:null, botRacketR:null,
    botX:0, botZ:-11.5, botTargetX:0,
    botSpeed:4.2, botReaction:0.2, botReactionTimer:0,
    botHitPrediction:null, botHitCooldown:0,
    botAnimTilt:0,
    /* ---- ENVIRONNEMENT ---- */
    crowdAmbi:null, crowdCheerCount:0,
    crowdPeople:[], crowdAnimPhase:0,
    realEnv: false,
  };
  const RACKET_SMOOTH_TAU = 0.05;

  function sceneL(){ return document.querySelector('#eyeLeft a-scene'); }
  function sceneR(){ return document.querySelector('#eyeRight a-scene'); }

  /* ---- SON RÉALISTE avec bruit blanc + oscillateurs ---- */
  function playBallHit(power){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      const vol=0.25+power*0.2;
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(500+power*400,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(200,ctx.currentTime+0.08);
      g.gain.setValueAtTime(vol,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.1);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime+0.1);
      const n=ctx.createBufferSource(), ng=ctx.createGain();
      const buf=ctx.createBuffer(1,ctx.sampleRate*0.05,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      n.buffer=buf; n.connect(ng);
      ng.gain.setValueAtTime(vol*0.6,ctx.currentTime);
      ng.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.04);
      ng.connect(ctx.destination); n.start(); n.stop(ctx.currentTime+0.05);
    }catch(_){}
  }
  function playRacketSwing(){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(200,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(120,ctx.currentTime+0.12);
      g.gain.setValueAtTime(0.06,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime+0.12);
    }catch(_){}
  }
  function playBounce(){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(380,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(120,ctx.currentTime+0.05);
      g.gain.setValueAtTime(0.12,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.06);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime+0.06);
    }catch(_){}
  }
  function playCrowd(cheer){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      const vol=cheer?0.15:0.06;
      const n=ctx.createBufferSource(),g=ctx.createGain();
      const dur=cheer?0.9:0.5;
      const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++){
        const t=i/ctx.sampleRate;
        d[i]=(Math.random()*2-1)*(cheer?Math.sin(t*2)*0.3+0.7:1);
      }
      n.buffer=buf;
      g.gain.setValueAtTime(vol,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      n.connect(g); g.connect(ctx.destination);
      n.start(); n.stop(ctx.currentTime+dur);
    }catch(_){}
  }
  function playGameOverSound(){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      [300,250,180,120].forEach((f,i)=>{
        setTimeout(()=>{
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sawtooth'; o.frequency.value=f;
          g.gain.setValueAtTime(0.2,ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25);
          o.connect(g); g.connect(ctx.destination);
          o.start(); o.stop(ctx.currentTime+0.25);
        },i*150);
      });
    }catch(_){}
  }
  function playScore(){
    try{
      const ctx=_getAudioCtx(); if(!ctx) return;
      [660,880,1100].forEach((f,i)=>{
        setTimeout(()=>{
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sine'; o.frequency.value=f;
          g.gain.setValueAtTime(0.2,ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
          o.connect(g); g.connect(ctx.destination);
          o.start(); o.stop(ctx.currentTime+0.15);
        },i*80);
      });
    }catch(_){}
  }

  function rand(a,b){return a+Math.random()*(b-a);}

  /* ---- CONSTRUCTION DU MONDE ---- */
  function isPassthroughActive(){
    return window.__passthroughAPI && window.__passthroughAPI.active;
  }
  function buildCourt(){
    const minimal = VRT.realEnv || isPassthroughActive();
    ['L','R'].forEach(side=>{
      const sc = side==='L'? sceneL() : sceneR();
      if(!sc) return;
      sc.querySelectorAll('[data-vrt-env]').forEach(e=>e.remove());

      if(!minimal){
        const sky=document.createElement('a-sky');
        sky.setAttribute('color','#7ec8e3');
        sky.setAttribute('data-vrt-env','');
        sc.appendChild(sky);
      }

      if(!minimal){
        const apron=document.createElement('a-plane');
        apron.setAttribute('rotation','-90 0 0');
        apron.setAttribute('width','16');apron.setAttribute('height','28');
        apron.setAttribute('position','0 0 -6');
        apron.setAttribute('material','color:#2e7d4f;roughness:1');
        apron.setAttribute('data-vrt-env','');
        sc.appendChild(apron);
      }

      const court=document.createElement('a-plane');
      court.setAttribute('rotation','-90 0 0');
      court.setAttribute('width','11');court.setAttribute('height','24');
      court.setAttribute('position','0 0.01 -6');
      court.setAttribute('material','color:#2f7fc1;roughness:1');
      court.setAttribute('data-vrt-env','');
      sc.appendChild(court);

      function line(x,z,w,d){
        const ln=document.createElement('a-box');
        ln.setAttribute('width',w);ln.setAttribute('height','0.02');ln.setAttribute('depth',d);
        ln.setAttribute('position',x+' 0.03 '+z);
        ln.setAttribute('material','color:#ffffff;shader:flat');
        ln.setAttribute('data-vrt-env','');
        sc.appendChild(ln);
      }
      line(-5,-6,0.08,20);
      line(5,-6,0.08,20);
      line(0,-15.5,10.1,0.08);
      line(0,5.5,10.1,0.08);
      line(0,-4,10.1,0.06);
      /* Ligne centrale de service */
      line(0,-9.75,0.06,0.08);
      line(0,1.75,0.06,0.08);
      /* Ligne médiane verticale (moitié de terrain) */
      line(0,-9.75,0.04,5.75);
      line(0,1.75,0.04,5.75);

      const net=document.createElement('a-plane');
      net.setAttribute('width','10.4');net.setAttribute('height','0.9');
      net.setAttribute('position','0 0.45 -4');
      net.setAttribute('material','color:#ffffff;opacity:0.18;transparent:true;side:double;shader:flat');
      net.setAttribute('data-vrt-env','');
      sc.appendChild(net);
      /* Grille du filet (fils horizontaux) */
      for(let r=1;r<9;r++){
        const wire=document.createElement('a-box');
        wire.setAttribute('width','10.4');wire.setAttribute('height','0.008');wire.setAttribute('depth','0.008');
        wire.setAttribute('position','0 '+(r*0.1)+' -4');
        wire.setAttribute('material','color:#ffffff;shader:flat;opacity:0.6;transparent:true');
        wire.setAttribute('data-vrt-env','');
        sc.appendChild(wire);
      }
      /* Bande blanche supérieure */
      const tape=document.createElement('a-box');
      tape.setAttribute('width','10.4');tape.setAttribute('height','0.06');tape.setAttribute('depth','0.05');
      tape.setAttribute('position','0 0.9 -4');
      tape.setAttribute('material','color:#ffffff;shader:flat');
      tape.setAttribute('data-vrt-env','');
      sc.appendChild(tape);
      [-5.25,5.25].forEach(px=>{
        const post=document.createElement('a-cylinder');
        post.setAttribute('radius','0.045');post.setAttribute('height','1.05');
        post.setAttribute('position',px+' 0.52 -4');
        post.setAttribute('material','color:#555555;metalness:0.6');
        post.setAttribute('data-vrt-env','');
        sc.appendChild(post);
      });

      if(!minimal){
        const fence=document.createElement('a-plane');
        fence.setAttribute('width','13');fence.setAttribute('height','3');
        fence.setAttribute('position','0 1.5 -17.9');
        fence.setAttribute('material','color:#0e3d24;opacity:0.9;side:double');
        fence.setAttribute('data-vrt-env','');
        sc.appendChild(fence);

        /* ---- ARBRES ---- */
        function tree(px,py,pz,s){
          const t=document.createElement('a-entity');
          t.setAttribute('position',px+' '+py+' '+pz);
          const trunk=document.createElement('a-cylinder');
          trunk.setAttribute('radius',0.08*s);trunk.setAttribute('height',1.2*s);
          trunk.setAttribute('position','0 0.6 0');
          trunk.setAttribute('material','color:#5a3a1a;roughness:1');
          t.appendChild(trunk);
          const crown=document.createElement('a-sphere');
          crown.setAttribute('radius',0.7*s);crown.setAttribute('position','0 '+(1.2*s+0.3*s)+' 0');
          crown.setAttribute('material','color:#1a6a2a;roughness:1');
          t.appendChild(crown);
          t.setAttribute('data-vrt-env','');
          sc.appendChild(t);
        }
        tree(-7.5,0,-16,1.2);
        tree(7.5,0,-16,1.0);
        tree(-7.8,0,-8.5,0.9);
        tree(7.8,0,-8.5,1.1);
        tree(-7.3,0,1,1.3);
        tree(7.3,0,1,0.8);
        tree(-7.5,0,5,1.0);
        tree(7.5,0,5,1.2);
        tree(-4.5,0,-18.5,1.1);
        tree(4.5,0,-18.5,1.0);

        /* ---- BANCS (gradins) ---- */
        function bench(bx,bz){
          for(let r=0;r<3;r++){
            const row=document.createElement('a-box');
            row.setAttribute('width','1.8');row.setAttribute('height','0.12');row.setAttribute('depth','0.5');
            row.setAttribute('position',bx+' '+(0.06+r*0.2)+' '+(bz-r*0.5));
            row.setAttribute('material','color:#8a7a5a;roughness:0.9');
            row.setAttribute('data-vrt-env','');
            sc.appendChild(row);
          }
        }
        bench(-6.5,5.5);
        bench(6.5,5.5);
        bench(-6.5,6.8);
        bench(6.5,6.8);

        /* ---- PUBLIC (silhouettes stylisées avec animation) ---- */
        const isRefSide = side==='L'; // une seule référence pour l'animation
        function person(px,py,pz,color){
          const p=document.createElement('a-entity');
          p.setAttribute('position',px+' '+py+' '+pz);
          const body=document.createElement('a-box');
          body.setAttribute('width','0.2');body.setAttribute('height','0.45');body.setAttribute('depth','0.2');
          body.setAttribute('position','0 0.45 0');
          body.setAttribute('material','color:'+color+';roughness:1');
          p.appendChild(body);
          const head=document.createElement('a-sphere');
          head.setAttribute('radius','0.08');
          head.setAttribute('position','0 0.78 0');
          head.setAttribute('material','color:#e6b68a;roughness:1');
          p.appendChild(head);
          /* Bras levés (2 cylindres fins) pour le mouvement de joie */
          const armL=document.createElement('a-cylinder');
          armL.setAttribute('radius','0.015');armL.setAttribute('height','0.18');
          armL.setAttribute('position','-0.13 0.6 0');armL.setAttribute('rotation','0 0 -30');
          armL.setAttribute('material','color:'+color+';roughness:1');
          p.appendChild(armL);
          const armR=document.createElement('a-cylinder');
          armR.setAttribute('radius','0.015');armR.setAttribute('height','0.18');
          armR.setAttribute('position','0.13 0.6 0');armR.setAttribute('rotation','0 0 30');
          armR.setAttribute('material','color:'+color+';roughness:1');
          p.appendChild(armR);
          p.setAttribute('data-vrt-env','');
          p.setAttribute('data-vrt-person','');
          sc.appendChild(p);
          if(isRefSide) VRT.crowdPeople.push({el:p,baseY:py,phase:rand(0,Math.PI*2),bobSpeed:1.5+rand(0,1.5),cheerUntil:0});
        }
        const crowdColors=['#c0392b','#2980b9','#27ae60','#8e44ad','#d35400','#1abc9c','#e67e22','#2c3e50'];
        for(let i=0;i<12;i++){
          const side=i<6?-1:1;
          const px=side*(6.5+rand(0,1.2));
          const pz=6+rand(0,2.5);
          const c=crowdColors[i%crowdColors.length];
          person(px,0,pz,c);
        }
        for(let i=0;i<6;i++){
          const px=-4+rand(0,8);
          const pz=-18+rand(0,1.5);
          person(px,0,pz,crowdColors[i%crowdColors.length]);
        }
      }

      /* ---- LIGNE DE FOND BOT ---- */
      const bl=document.createElement('a-box');
      bl.setAttribute('width','5.8');bl.setAttribute('height','0.015');bl.setAttribute('depth','0.04');
      bl.setAttribute('position','0 0.025 -15.5');
      bl.setAttribute('material','color:rgba(255,255,255,0.3);shader:flat');
      bl.setAttribute('data-vrt-env','');
      sc.appendChild(bl);
    });
  }

  function rebuildCourt(){
    if(!VRT.running) return;
    VRT.crowdPeople = [];
    removeAllParticles();
    removeBallEntities();
    removeRacketEntities();
    removeBotEntities();
    buildCourt();
    createRacketEntities();
    createBotEntities();
    createBallEntities();
    if(VRT.ballActive){
      [VRT.ballL,VRT.ballR].forEach(e=>{if(e)e.object3D.position.copy(VRT.ballPos);});
      [VRT.shadowL,VRT.shadowR].forEach(e=>{if(e)e.object3D.position.set(VRT.ballPos.x,0.008,VRT.ballPos.z);});
    }
    if(VRT.racketHeld){
      [VRT.racketL,VRT.racketR].forEach(e=>{
        if(!e) return;
        const camEl=document.getElementById('camL');
        if(!camEl||!camEl.object3D) return;
        const camPos=new THREE.Vector3(); camEl.object3D.getWorldPosition(camPos);
        const q=new THREE.Quaternion(); camEl.object3D.getWorldQuaternion(q);
        const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(q);
        const right=new THREE.Vector3(1,0,0).applyQuaternion(q);
        const up=new THREE.Vector3(0,1,0).applyQuaternion(q);
        const yaw=Math.atan2(fwd.x,fwd.z);
        const rp=camPos.clone().add(fwd.clone().multiplyScalar(0.85)).add(right.clone().multiplyScalar(VRT.smoothRx)).add(up.clone().multiplyScalar(VRT.smoothRy-1.6));
        e.object3D.position.copy(rp);
        e.object3D.rotation.set(0,yaw,0);
      });
    }
  }

  window.toggleTennisRealEnv=function(){
    VRT.realEnv = !VRT.realEnv;
    rebuildCourt();
    const btn=document.getElementById('vrt-realen-btn');
    if(btn){
      btn.textContent=VRT.realEnv?'🏟️':'🌲';
      btn.classList.toggle('active',VRT.realEnv);
    }
    if(typeof toast==='function') toast(VRT.realEnv ? '🏟️ Mode réel — fond désactivé' : '🌲 Fond réactivé');
  };

  function hideSky(yes){
    ['skyL','skyR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.setAttribute('visible', yes?'false':'true');
    });
  }

  /* ---- RAQUETTE JOUEUR (texturée / colorée) ---- */
  function makeRacket(sc, color){
    const ent=document.createElement('a-entity');
    ent.setAttribute('data-vrt-racket','');
    const grip=document.createElement('a-cylinder');
    grip.setAttribute('radius','0.022');grip.setAttribute('height','0.18');
    grip.setAttribute('position','0 -0.42 0');
    grip.setAttribute('material','color:#c0392b;roughness:0.9');
    ent.appendChild(grip);
    const handle=document.createElement('a-cylinder');
    handle.setAttribute('radius','0.016');handle.setAttribute('height','0.3');
    handle.setAttribute('position','0 -0.2 0');
    handle.setAttribute('material','color:#8a6a3a;roughness:0.8');
    ent.appendChild(handle);
    const neck=document.createElement('a-cylinder');
    neck.setAttribute('radius','0.014');neck.setAttribute('height','0.14');
    neck.setAttribute('position','0 -0.06 0');
    neck.setAttribute('material','color:#2c2c2c;metalness:0.5');
    ent.appendChild(neck);
    const rim=document.createElement('a-torus');
    rim.setAttribute('radius','0.16');rim.setAttribute('radius-tubular','0.012');
    rim.setAttribute('position','0 0.13 0');rim.setAttribute('rotation','90 0 0');
    rim.setAttribute('material','color:'+color+';emissive:'+color+';emissiveIntensity:0.25;shader:flat;metalness:0.7');
    ent.appendChild(rim);
    const strings=document.createElement('a-circle');
    strings.setAttribute('radius','0.148');
    strings.setAttribute('position','0 0.13 0.001');strings.setAttribute('rotation','90 0 0');
    strings.setAttribute('material','color:#f4f4f4;opacity:0.35;transparent:true;side:double;shader:flat;wireframe:true');
    ent.appendChild(strings);
    const glow=document.createElement('a-torus');
    glow.setAttribute('data-vrt-glow','');
    glow.setAttribute('radius','0.25');glow.setAttribute('radius-tubular','0.006');
    glow.setAttribute('position','0 0.13 0');glow.setAttribute('rotation','90 0 0');
    glow.setAttribute('material','color:#44ffaa;emissive:#44ffaa;emissiveIntensity:0.9;shader:flat;opacity:0.8;transparent:true');
    ent.appendChild(glow);
    sc.appendChild(ent);
    return ent;
  }

  function createRacketEntities(){
    removeRacketEntities();
    if(sceneL()) VRT.racketL = makeRacket(sceneL(),'#ff5500');
    if(sceneR()) VRT.racketR = makeRacket(sceneR(),'#ff5500');
  }
  function removeRacketEntities(){
    [VRT.racketL, VRT.racketR].forEach(e=>{ if(e && e.parentNode) e.parentNode.removeChild(e); });
    VRT.racketL = null; VRT.racketR = null;
  }

  /* ---- RAQUETTE + CORPS DU BOT ---- */
  function makeBot(sc){
    const bot=document.createElement('a-entity');
    bot.setAttribute('data-vrt-bot','');
    const body=document.createElement('a-box');
    body.setAttribute('width','0.35');body.setAttribute('height','0.5');body.setAttribute('depth','0.2');
    body.setAttribute('position','0 0.45 0');
    body.setAttribute('material','color:#2c3e50;roughness:0.8');
    bot.appendChild(body);
    const head=document.createElement('a-sphere');
    head.setAttribute('radius','0.12');
    head.setAttribute('position','0 0.78 0');
    head.setAttribute('material','color:#e6b68a;roughness:0.9');
    bot.appendChild(head);
    const hat=document.createElement('a-cylinder');
    hat.setAttribute('radius','0.11');hat.setAttribute('height','0.06');
    hat.setAttribute('position','0 0.86 0');
    hat.setAttribute('material','color:#ecf0f1;roughness:0.6');
    bot.appendChild(hat);
    const cap=document.createElement('a-cylinder');
    cap.setAttribute('radius','0.04');cap.setAttribute('height','0.04');
    cap.setAttribute('position','0 0.92 0');
    cap.setAttribute('material','color:#e74c3c');
    bot.appendChild(cap);
    sc.appendChild(bot);
    return bot;
  }
  function makeBotRacket(sc){
    const r=makeRacket(sc,'#3498db');
    r.setAttribute('data-vrt-botracket','');
    r.object3D.scale.set(0.85,0.85,0.85);
    const g=r.querySelector('[data-vrt-glow]');
    if(g) g.setAttribute('visible','false');
    return r;
  }
  function createBotEntities(){
    removeBotEntities();
    if(sceneL()){ VRT.botL=makeBot(sceneL()); VRT.botRacketL=makeBotRacket(sceneL()); }
    if(sceneR()){ VRT.botR=makeBot(sceneR()); VRT.botRacketR=makeBotRacket(sceneR()); }
  }
  function removeBotEntities(){
    [VRT.botL,VRT.botR,VRT.botRacketL,VRT.botRacketR].forEach(e=>{ if(e&&e.parentNode) e.parentNode.removeChild(e); });
    VRT.botL=VRT.botR=VRT.botRacketL=VRT.botRacketR=null;
  }

  /* ---- BALLE + OMBRE ---- */
  function makeBall(sc){
    const ball=document.createElement('a-sphere');
    ball.setAttribute('radius', VRT.ballRadius);
    ball.setAttribute('material','color:#ccff33;shader:flat;emissive:#aadd22;emissiveIntensity:0.2');
    ball.setAttribute('data-vrt-ball','');
    sc.appendChild(ball);
    return ball;
  }
  function makeShadow(sc){
    const sh=document.createElement('a-circle');
    sh.setAttribute('radius','0.14');
    sh.setAttribute('rotation','-90 0 0');
    sh.setAttribute('position','0 0.008 0');
    sh.setAttribute('material','color:#000000;opacity:0.32;transparent:true;shader:flat');
    sh.setAttribute('data-vrt-shadow','');
    sc.appendChild(sh);
    return sh;
  }
  function createBallEntities(){
    removeBallEntities();
    if(sceneL()){ VRT.ballL=makeBall(sceneL()); VRT.shadowL=makeShadow(sceneL()); }
    if(sceneR()){ VRT.ballR=makeBall(sceneR()); VRT.shadowR=makeShadow(sceneR()); }
  }
  function spawnHitParticles(pos, color, count){
    const sc = sceneL();
    if(!sc) return;
    for(let i=0;i<count;i++){
      const p=document.createElement('a-sphere');
      p.setAttribute('radius','0.01');
      p.setAttribute('material','color:'+color+';shader:flat;emissive:'+color+';emissiveIntensity:0.8');
      p.object3D.position.copy(pos);
      p.object3D.position.x+=rand(-0.05,0.05);
      p.object3D.position.y+=rand(-0.05,0.05);
      p.object3D.position.z+=rand(-0.05,0.05);
      sc.appendChild(p);
      const vel=new THREE.Vector3(rand(-2,2),rand(1,3.5),rand(-1.5,1.5));
      VRT.particles.push({el:p,vel:vel,lifespan:0.3+rand(0,0.2),age:0});
    }
  }
  function updateParticles(dt){
    for(let i=VRT.particles.length-1;i>=0;i--){
      const pt=VRT.particles[i];
      if(!pt){ VRT.particles.splice(i,1); continue; }
      pt.age+=dt;
      if(pt.age>=pt.lifespan || !pt.el || !pt.el.parentNode){
        if(pt.el && pt.el.parentNode) pt.el.parentNode.removeChild(pt.el);
        VRT.particles.splice(i,1);
        continue;
      }
      pt.vel.y-=5*dt;
      pt.el.object3D.position.addScaledVector(pt.vel,dt);
      const fade=1-pt.age/pt.lifespan;
      pt.el.setAttribute('material','opacity:'+fade+';transparent:true');
    }
  }
  function removeAllParticles(){
    VRT.particles.forEach(pt=>{ if(pt.el && pt.el.parentNode) pt.el.parentNode.removeChild(pt.el); });
    VRT.particles=[];
  }
  function updateTrail(dt, ballPos){
    if(!ballPos || !VRT.ballActive) return;
    VRT.trailTimer+=dt;
    if(VRT.trailTimer<0.035) return;
    VRT.trailTimer=0;
    const sc=sceneL();
    if(!sc) return;
    const t=document.createElement('a-sphere');
    t.setAttribute('radius','0.015');
    t.setAttribute('material','color:#aaff55;shader:flat;transparent:true;opacity:0.6');
    t.object3D.position.copy(ballPos);
    t.object3D.position.y+=0.01;
    sc.appendChild(t);
    VRT.trail.push({el:t,age:0});
    if(VRT.trail.length>18){
      const old=VRT.trail.shift();
      if(old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
  }
  function updateTrailFade(dt){
    for(let i=VRT.trail.length-1;i>=0;i--){
      const tr=VRT.trail[i];
      if(!tr || !tr.el) continue;
      tr.age+=dt;
      if(tr.age>0.35 || !tr.el.parentNode){
        if(tr.el.parentNode) tr.el.parentNode.removeChild(tr.el);
        VRT.trail.splice(i,1);
        continue;
      }
      tr.el.setAttribute('radius', 0.015+tr.age*0.02);
      tr.el.setAttribute('material','opacity:'+Math.max(0,0.6-tr.age*1.7)+';transparent:true');
    }
  }
  function removeTrail(){
    VRT.trail.forEach(t=>{ if(t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el); });
    VRT.trail=[];
  }
  function removeBallEntities(){
    removeAllParticles(); removeTrail();
    [VRT.ballL, VRT.ballR, VRT.shadowL, VRT.shadowR].forEach(e=>{ if(e && e.parentNode) e.parentNode.removeChild(e); });
    VRT.ballL=null; VRT.ballR=null; VRT.shadowL=null; VRT.shadowR=null;
  }

  function handTrackActiveNow(){
    const a=window.__handTrackAPI;
    return !!(a && a.isActive && a.screen);
  }

  /* ---- CONTRÔLE TACTILE ---- */
  let vrtTouchEl = null;
  function vrtUpdateTouchPos(ev){
    const t = (ev.touches&&ev.touches[0])||ev;
    VRT.touchNX=Math.min(1,Math.max(0,t.clientX/window.innerWidth));
    VRT.touchNY=Math.min(1,Math.max(0,t.clientY/window.innerHeight));
  }
  function vrtOnPointerDown(ev){ VRT.touchActive=true; vrtUpdateTouchPos(ev); if(ev.cancelable) ev.preventDefault(); }
  function vrtOnPointerMove(ev){ if(!VRT.touchActive) return; vrtUpdateTouchPos(ev); if(ev.cancelable) ev.preventDefault(); }
  function vrtOnPointerUp(){ VRT.touchActive=false; }
  function attachTouchControls(){
    if(vrtTouchEl) return;
    vrtTouchEl=document.querySelector('.vr-stage')||document.body;
    vrtTouchEl.addEventListener('pointerdown',vrtOnPointerDown,{passive:false});
    vrtTouchEl.addEventListener('pointermove',vrtOnPointerMove,{passive:false});
    window.addEventListener('pointerup',vrtOnPointerUp);
    window.addEventListener('pointercancel',vrtOnPointerUp);
  }
  function detachTouchControls(){
    if(!vrtTouchEl) return;
    vrtTouchEl.removeEventListener('pointerdown',vrtOnPointerDown);
    vrtTouchEl.removeEventListener('pointermove',vrtOnPointerMove);
    window.removeEventListener('pointerup',vrtOnPointerUp);
    window.removeEventListener('pointercancel',vrtOnPointerUp);
    vrtTouchEl=null; VRT.touchActive=false;
  }

  /* ---- SERVICE ---- */
  function spawnServe(){
    const startX=rand(-2.6,2.6),startY=2.6,startZ=-15;
    const targetX=rand(-2.2,2.2),targetY=0,targetZ=rand(0.2,1.1);
    const T=Math.max(1.2,1.9-VRT.score*0.009);
    const vx=(targetX-startX)/T,vz=(targetZ-startZ)/T;
    const vy=((targetY-startY)+0.5*VRT.gravity*T*T)/T;
    VRT.ballPos=new THREE.Vector3(startX,startY,startZ);
    VRT.ballVel=new THREE.Vector3(vx,vy,vz);
    VRT.ballActive=true; VRT.playerHit=false; VRT.bounces=0; VRT.hitCooldown=0;
    createBallEntities();
    playBallHit(0.3);
    VRT.message='🎾 Service !';
    if(VRT.msgTimeout) clearTimeout(VRT.msgTimeout);
    VRT.msgTimeout=setTimeout(()=>{if(VRT.running&&VRT.message==='🎾 Service !')VRT.message='';},700);
  }

  /* ---- FRAPPE JOUEUR ---- */
  function hitBall(power, rx){
    const targetX=Math.max(-4,Math.min(4,rx*2.4));
    const targetZ=-12-Math.random()*3.5;
    const speed=7.5+power*5.5;
    const dir=new THREE.Vector3(targetX-VRT.ballPos.x,0,targetZ-VRT.ballPos.z);
    const dist=Math.max(0.6,dir.length());
    dir.normalize();
    const T=dist/speed;
    VRT.ballVel.x=dir.x*speed;
    VRT.ballVel.z=dir.z*speed;
    VRT.ballVel.y=((0-VRT.ballPos.y)+0.5*VRT.gravity*T*T)/T+1.4;
    VRT.playerHit=true;
    VRT.bounces=0;
    VRT.hitCooldown=0.28;
    playBallHit(power);
    playRacketSwing();
  }

  /* ---- BOT : prédire où la balle va tomber ---- */
  function botPredictLanding(){
    if(!VRT.ballActive||!VRT.ballVel) return null;
    const p=VRT.ballPos.clone(),v=VRT.ballVel.clone();
    for(let i=0;i<300;i++){
      v.y-=VRT.gravity*0.016;
      p.addScaledVector(v,0.016);
      if(p.y<=VRT.ballRadius){
        return new THREE.Vector2(p.x,p.z);
      }
      if(p.z>-4||p.z<-16) break;
    }
    return null;
  }

  /* ---- BOT : frapper la balle ---- */
  function botHitBall(){
    const targetX=rand(-3.5,3.5);
    const targetZ=rand(0.5,4.5);
    const speed=9+Math.random()*4;
    const dir=new THREE.Vector3(targetX-VRT.ballPos.x,0,targetZ-VRT.ballPos.z);
    const dist=Math.max(0.6,dir.length());
    dir.normalize();
    const T=dist/speed;
    VRT.ballVel.x=dir.x*speed+rand(-0.5,0.5);
    VRT.ballVel.z=dir.z*speed;
    VRT.ballVel.y=((0-VRT.ballPos.y)+0.5*VRT.gravity*T*T)/T+1.0+rand(0,0.8);
    VRT.playerHit=false;
    VRT.bounces=0;
    VRT.botHitCooldown=0.3;
    playBallHit(0.5+Math.random()*0.4);
    VRT.botAnimTilt=0.4;
  }

  function endRally(success){
    removeBallEntities();
    VRT.ballActive=false;
    VRT.serveTimer=1.1;
    VRT.message=success?'👏 Point !':'❌ Raté !';
    if(VRT.msgTimeout) clearTimeout(VRT.msgTimeout);
    VRT.msgTimeout=setTimeout(()=>{if(VRT.running)VRT.message='';},900);
    if(success) playCrowd(true);
    else playCrowd(false);
  }

  function triggerCrowdCheer(duration){
    const until=performance.now()+duration;
    VRT.crowdPeople.forEach(p=>{ p.cheerUntil=until; });
  }
  function triggerCrowdGroan(){
    VRT.crowdPeople.forEach(p=>{
      p.cheerUntil=performance.now()+300;
      p.bobSpeed*=-1; // inversion brève pour effet de sursaut
      setTimeout(()=>{ p.bobSpeed=Math.abs(p.bobSpeed)||1.5; },300);
    });
  }
  function scorePoint(){
    VRT.score+=1;
    playScore();
    playCrowd(true);
    triggerCrowdCheer(2000);
    /* Popup score flottant */
    const pop=document.getElementById('vrt-score');
    if(pop){
      pop.style.transition='none';
      pop.style.transform='scale(1.8)';
      pop.style.color='#ccff33';
      setTimeout(()=>{
        pop.style.transition='transform 0.4s ease, color 0.6s ease';
        pop.style.transform='scale(1)';
        pop.style.color='#fff';
      },150);
    }
    endRally(true);
  }
  function missPoint(){
    VRT.lives-=1;
    if(VRT.msgTimeout) clearTimeout(VRT.msgTimeout);
    VRT.message='❌ Raté !';
    VRT.msgTimeout=setTimeout(()=>{if(VRT.running)VRT.message='';},900);
    if(VRT.lives<=0){
      spawnHitParticles(new THREE.Vector3(0,0.5,-6),'#ff4444',40);
      spawnHitParticles(new THREE.Vector3(0,0.5,-6),'#ffaa00',30);
      gameOver();
    }
    else{ endRally(false); triggerCrowdGroan(); }
  }

  function updateHUD(){
    const sc=document.getElementById('vrt-score'); if(sc) sc.textContent=VRT.score;
    const lv=document.getElementById('vrt-lives');
    if(lv) lv.textContent='❤️'.repeat(Math.max(0,VRT.lives))+'🖤'.repeat(Math.max(0,3-VRT.lives));
    const msg=document.getElementById('vrt-msg');
    if(msg){
      let text=VRT.message;
      if(!text&&!VRT.racketHeld){
        text=handTrackActiveNow()
          ?"🎾 Pince pour attraper la raquette"
          :'🎾 Touche l\'écran pour jouer';
      }
      msg.textContent=text;
      msg.style.opacity=text?'1':'0';
    }
  }

  function gameOver(){
    VRT.running=false;
    cancelAnimationFrame(VRT.animId);
    removeBallEntities();
    const go=document.getElementById('vrt-gameover');
    const gs=document.getElementById('vrt-go-score');
    if(go) go.classList.add('show');
    if(gs) gs.textContent='Score : '+VRT.score+' pts';
    playGameOverSound();
    playCrowd(false);
  }

  /* ---- BOUCLE PRINCIPALE ---- */
  function gameTick(ts){
    if(!VRT.running) return;
    VRT.animId=requestAnimationFrame(gameTick);
    const dt=Math.min((ts-VRT.lastFrame)/1000,0.05);
    VRT.lastFrame=ts;

    const camEl=document.getElementById('camL');
    if(!camEl||!camEl.object3D){ updateHUD(); return; }
    const camPos=new THREE.Vector3(); camEl.object3D.getWorldPosition(camPos);
    const q=new THREE.Quaternion(); camEl.object3D.getWorldQuaternion(q);
    const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(q);
    const right=new THREE.Vector3(1,0,0).applyQuaternion(q);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(q);
    const yaw=Math.atan2(fwd.x,fwd.z);

    const handAPI=window.__handTrackAPI;
    const handActive=!!(handAPI&&handAPI.isActive&&handAPI.screen);
    let targetX=VRT.restX,targetY=VRT.restY;
    if(VRT.touchActive){
      targetX=(VRT.touchNX-0.5)*3.2;
      targetY=(1-VRT.touchNY)*1.7+0.5;
    }else if(handActive){
      const eyeEl=document.getElementById('eyeLeft');
      const eyeRect=eyeEl?eyeEl.getBoundingClientRect():{left:0,top:0,width:window.innerWidth,height:window.innerHeight};
      let nx=(handAPI.screen.pageX-eyeRect.left)/Math.max(1,eyeRect.width);
      let ny=(handAPI.screen.pageY-eyeRect.top)/Math.max(1,eyeRect.height);
      nx=Math.min(1,Math.max(0,nx)); ny=Math.min(1,Math.max(0,ny));
      targetX=(nx-0.5)*3.2;
      targetY=(1-ny)*1.7+0.5;
    }

    if(!VRT.racketHeld){
      if(VRT.touchActive||(handActive&&handAPI.pinching)){
        VRT.racketHeld=true;
        VRT.message='🎾 En jeu !';
        if(VRT.msgTimeout) clearTimeout(VRT.msgTimeout);
        VRT.msgTimeout=setTimeout(()=>{if(VRT.running)VRT.message='';},600);
      }
    }

    const inputActive=VRT.touchActive||handActive;
    const finalTargetX=inputActive?targetX:VRT.restX;
    const finalTargetY=inputActive?targetY:VRT.restY;
    const smoothAlpha=1-Math.exp(-dt/RACKET_SMOOTH_TAU);
    VRT.smoothRx+=(finalTargetX-VRT.smoothRx)*smoothAlpha;
    VRT.smoothRy+=(finalTargetY-VRT.smoothRy)*smoothAlpha;
    const rx=VRT.smoothRx,ry=VRT.smoothRy;

    const racketWorld=camPos.clone()
      .add(fwd.clone().multiplyScalar(0.85))
      .add(right.clone().multiplyScalar(rx))
      .add(up.clone().multiplyScalar(ry-1.6));
    const swingVX=(rx-VRT.prevRx)/Math.max(dt,0.001);
    const swingVY=(ry-VRT.prevRy)/Math.max(dt,0.001);
    const tiltZ=THREE.MathUtils.clamp(-swingVX*0.09,-0.62,0.62);
    const tiltX=THREE.MathUtils.clamp(swingVY*0.09,-0.44,0.44);
    [VRT.racketL,VRT.racketR].forEach(e=>{
      if(!e) return;
      e.object3D.position.copy(racketWorld);
      e.object3D.rotation.set(tiltX,yaw,tiltZ);
      const g=e.querySelector('[data-vrt-glow]');
      if(g) g.setAttribute('visible',VRT.racketHeld?'false':'true');
    });

    /* ---- TRAÎNÉE DE RAQUETTE ---- */
    const swingSpeed=Math.hypot(swingVX,swingVY);
    const trailAlpha=THREE.MathUtils.clamp((swingSpeed-1)*0.15,0,0.35);
    [VRT.racketL,VRT.racketR].forEach(e=>{
      if(!e) return;
      let trailer=e.querySelector('[data-vrt-swing]');
      if(!trailer && trailAlpha>0.05){
        const tr=document.createElement('a-torus');
        tr.setAttribute('radius','0.07');tr.setAttribute('radiusTubular','0.008');
        tr.setAttribute('material','color:#ffcc33;shader:flat;transparent:true;opacity:0.3');
        tr.setAttribute('data-vrt-swing','');
        tr.setAttribute('rotation','90 0 0');
        e.appendChild(tr);
        trailer=tr;
      }
      if(trailer){
        if(trailAlpha>0.05){
          trailer.setAttribute('visible','true');
          trailer.setAttribute('material','opacity:'+trailAlpha);
          const tp=e.object3D.position.clone().sub(new THREE.Vector3(0,0,0.08));
          trailer.object3D.position.set(0,0,-0.08);
        } else {
          trailer.setAttribute('visible','false');
        }
      }
    });

    /* ---- BOT ---- */
    if(VRT.running){
      if(VRT.ballActive&&!VRT.playerHit&&VRT.ballVel.z<0&&VRT.ballPos.z<-4){
        const pred=botPredictLanding();
        if(pred){
          VRT.botTargetX=THREE.MathUtils.clamp(pred.x,-3.5,3.5);
          const dx=VRT.botTargetX-VRT.botX;
          const urgency=Math.min(1,Math.abs(dx)*0.3);
          const moveSpeed=(VRT.botSpeed+urgency*2)*dt;
          if(Math.abs(dx)>0.1) VRT.botX+=Math.sign(dx)*Math.min(Math.abs(dx),moveSpeed);
          if(VRT.botReactionTimer>0) VRT.botReactionTimer-=dt;
          const hitDist=0.55+Math.min(0.2,Math.abs(VRT.botTargetX-VRT.botX)*0.05);
          if(!VRT.botHitCooldown&&VRT.ballPos.distanceTo(new THREE.Vector3(VRT.botX,0.5,VRT.botZ))<hitDist){
            botHitBall();
          }
        }
      }else if(VRT.ballActive&&VRT.playerHit&&VRT.ballVel.z<0){
        if(Math.abs(VRT.botX)>0.5) VRT.botX*=0.95;
        else VRT.botX=0;
      }
      if(VRT.botHitCooldown>0) VRT.botHitCooldown-=dt;
      if(VRT.botAnimTilt>0) VRT.botAnimTilt-=dt*2;

      const botPos=new THREE.Vector3(VRT.botX,0,VRT.botZ);
      [VRT.botL,VRT.botR].forEach(e=>{if(e) e.object3D.position.copy(botPos);});
      [VRT.botRacketL,VRT.botRacketR].forEach(e=>{
        if(!e) return;
        const rp=new THREE.Vector3(VRT.botX,0.55+VRT.botAnimTilt*0.3,VRT.botZ+0.3);
        e.object3D.position.copy(rp);
        e.object3D.rotation.set(-0.3+VRT.botAnimTilt*1.5,0,0);
      });
    }

    /* ---- ANIMATION DU PUBLIC ---- */
    VRT.crowdAnimPhase += dt;
    VRT.crowdPeople.forEach(p => {
      if(!p.el || !p.el.object3D) return;
      const t = VRT.crowdAnimPhase * p.bobSpeed + p.phase;
      const bob = Math.sin(t) * 0.02;
      const isCheering = p.cheerUntil > performance.now();
      const cheerBob = isCheering ? Math.abs(Math.sin(t * 4)) * 0.04 : 0;
      p.el.object3D.position.y = p.baseY + bob + cheerBob;
      const armEls = p.el.querySelectorAll('a-cylinder');
      if(armEls.length >= 2){
        const armAngle = isCheering ? -50 + Math.sin(t * 4) * 20 : -30;
        armEls[0].setAttribute('rotation', '0 0 ' + armAngle);
        armEls[1].setAttribute('rotation', '0 0 ' + (-armAngle));
      }
    });

    /* ---- SERVICE ---- */
    if(VRT.racketHeld&&!VRT.ballActive){
      VRT.serveTimer-=dt;
      if(VRT.serveTimer<=0) spawnServe();
    }

    /* ---- PHYSIQUE BALLE ---- */
    if(VRT.ballActive){
      VRT.ballVel.y-=VRT.gravity*dt;
      VRT.ballPos.addScaledVector(VRT.ballVel,dt);
      /* Collision filet : le ballon touche le filet (z=-4, y entre 0 et 0.9) */
      if(VRT.ballPos.z > -4.15 && VRT.ballPos.z < -3.85 && VRT.ballPos.y < 0.92 && VRT.ballPos.y > 0.02){
        VRT.netHitCount++;
        if(VRT.netHitCount < 3){
          playBounce();
          VRT.ballVel.z *= -0.3;
          VRT.ballVel.y = Math.abs(VRT.ballVel.y) * 0.5;
          VRT.ballVel.x *= 0.7;
          VRT.ballPos.z = VRT.ballPos.z > -4 ? -3.86 : -4.14;
        } else {
          VRT.ballVel.set(0,0,0);
          playCrowd(false);
          VRT.message='🎾 Filet !';
          setTimeout(()=>{ if(VRT.running){ VRT.ballActive=false; VRT.playerHit=false; VRT.serveTimer=0.8; } }, 500);
        }
      }
      if(VRT.ballPos.y<=VRT.ballRadius&&VRT.ballVel.y<0){
        VRT.ballPos.y=VRT.ballRadius;
        VRT.ballVel.y*=-0.5;
        VRT.ballVel.x*=0.92;VRT.ballVel.z*=0.92;
        VRT.bounces++;
        playBounce();
      }
      if(VRT.hitCooldown>0) VRT.hitCooldown-=dt;
      if(!VRT.hitCooldown&&VRT.ballVel.z>0){
        const d=VRT.ballPos.distanceTo(racketWorld);
        if(d<0.55){
          const power=Math.min(1,Math.hypot(rx-VRT.prevRx,ry-VRT.prevRy)/Math.max(dt,0.001)/6);
          spawnHitParticles(VRT.ballPos,'#ccff33',8+Math.floor(power*10));
          hitBall(power,rx);
        }
      }
      if(VRT.ballActive&&VRT.ballVel.z>0&&VRT.ballPos.z>1.6){
        missPoint();
      }else if(VRT.ballActive&&VRT.playerHit&&VRT.ballVel.z<0&&VRT.ballPos.z<-13.5){
        scorePoint();
      }
      if(VRT.ballActive){
        [VRT.ballL,VRT.ballR].forEach(e=>{if(e)e.object3D.position.copy(VRT.ballPos);});
        [VRT.shadowL,VRT.shadowR].forEach(e=>{if(e)e.object3D.position.set(VRT.ballPos.x,0.008,VRT.ballPos.z);});
        updateTrail(dt, VRT.ballPos);
      } else {
        removeTrail();
      }
    }
    updateTrailFade(dt);
    updateParticles(dt);

    VRT.prevRx=rx;VRT.prevRy=ry;
    updateHUD();
  }

  function resetGame(){
    VRT.score=0;VRT.lives=3;VRT.racketHeld=false;
    VRT.prevRx=VRT.restX;VRT.prevRy=VRT.restY;
    VRT.smoothRx=VRT.restX;VRT.smoothRy=VRT.restY;
    VRT.touchActive=false;
    VRT.ballActive=false;VRT.playerHit=false;VRT.bounces=0;VRT.hitCooldown=0;
    VRT.serveTimer=1.0;VRT.message='';VRT.netHitCount=0;
    VRT.botX=0;VRT.botZ=-11.5;VRT.botTargetX=0;VRT.botReactionTimer=0;VRT.botHitCooldown=0;VRT.botAnimTilt=0;
    VRT.crowdPeople=[]; VRT.trailTimer=0;
    removeAllParticles(); removeTrail();
    if(VRT.msgTimeout) clearTimeout(VRT.msgTimeout);
    removeBallEntities();
    buildCourt();
    createRacketEntities();
    createBotEntities();
    hideSky(true);
    const go=document.getElementById('vrt-gameover');
    if(go) go.classList.remove('show');
    VRT.running=true;
    updateHUD();
  }

  /* ---- API PUBLIQUE ---- */
  window.openVRTennis=function(){
    const hud=document.getElementById('vrt-hud');
    if(hud) hud.classList.add('active');
    resetGame();
    const btn=document.getElementById('vrt-realen-btn');
    if(btn){
      btn.textContent=VRT.realEnv||isPassthroughActive()?'🏟️':'🌲';
      btn.classList.toggle('active',VRT.realEnv||isPassthroughActive());
    }
    attachTouchControls();
    VRT.lastFrame=performance.now();
    VRT.animId=requestAnimationFrame(gameTick);
    VRT.message='🎾 Prêt — touche l\'écran !';
    if(VRT.msgTimeout) clearTimeout(VRT.msgTimeout);
    VRT.msgTimeout=setTimeout(()=>{if(VRT.running)VRT.message='';},1500);
    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.opacity='0';
    });
    if(window.__handTrackAPI&&!window.__handTrackAPI.isActive&&typeof window.toggleHandTrack==='function'){
      window.toggleHandTrack();
    }
    playCrowd(true);
    if(typeof toast==='function') toast("🎾 Tennis VR — Bot actif ! Touche l'écran pour jouer.");
  };

  window.closeVRTennis=function(){
    VRT.running=false;
    cancelAnimationFrame(VRT.animId);
    detachTouchControls();
    const hud=document.getElementById('vrt-hud');
    if(hud) hud.classList.remove('active');
    removeBallEntities();
    removeRacketEntities();
    removeBotEntities();
    ['L','R'].forEach(side=>{
      const sc=side==='L'?sceneL():sceneR();
      if(sc) sc.querySelectorAll('[data-vrt-env]').forEach(e=>e.remove());
    });
    hideSky(false);
    ['hudWrapL','hudWrapR','appDockWrapL','appDockWrapR'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.opacity='';
    });
  };

  window.restartVRTennis=function(){
    cancelAnimationFrame(VRT.animId);
    resetGame();
    VRT.lastFrame=performance.now();
    VRT.animId=requestAnimationFrame(gameTick);
  };

})();

