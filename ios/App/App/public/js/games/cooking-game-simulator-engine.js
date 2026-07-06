(function(){
  var $ = THREE, DEG = $.MathUtils.degToRad, PI2 = Math.PI*2;
  var S = { r:null, heat:false, stir:0, toss:0, day:1, money:0,
    step:0, phase:'recipe', items:[], camYaw:0, nextIngIdx:0 };
  var scene, camL, camR, renL, renR, rig;
  var clickables=[], hovered=null, anims=[];
  var hand={x:0,y:0,poke:false,wPoke:false,posHist:[]};
  var drag={on:false,sx:0};
  var grillY=0.85, grillPos, shelfY=1.7, shelfZ=-1.2;
  var IPD=0.028, EY=1.55;
  var WALL_R=7, WALL_H=3.8;

  // ---- INGREDIENT MODELS (Diner) ----
  var ING = {
    bun:{name:'Pain burger',c:0xe8a848,mat:'toon',shape:'bun',eff:'fly',color:0xe8a848,sz:0.09},
    patty:{name:'Steak haché',c:0x5a3018,mat:'standard',shape:'rounded',eff:'fly',color:0x5a3018,sz:0.09},
    cheese:{name:'Fromage',c:0xffcc33,mat:'toon',shape:'slice',eff:'fly',color:0xffcc33,sz:0.08},
    lettuce:{name:'Salade',c:0x6ab04c,mat:'toon',shape:'wavy',eff:'fly',color:0x6ab04c,sz:0.08},
    tomato:{name:'Tomate',c:0xe94b3c,mat:'standard',shape:'sphere',eff:'fly',color:0xe94b3c,sz:0.06},
    bacon:{name:'Bacon',c:0x9c3c2e,mat:'standard',shape:'strip',eff:'fly',color:0x9c3c2e,sz:0.08},
    egg:{name:'Œuf',c:0xfff8e7,mat:'standard',shape:'egg',eff:'fly',color:0xffaa33,sz:0.07},
    potato:{name:'Pomme de terre',c:0xe8c88a,mat:'standard',shape:'oval',eff:'fly',color:0xe8c88a,sz:0.07},
    onion:{name:'Oignon',c:0xc88bca,mat:'standard',shape:'sphere',eff:'fly',color:0xe8c8e8,sz:0.06},
    pickle:{name:'Cornichon',c:0x5f9e3d,mat:'standard',shape:'tube',eff:'fly',color:0x5f9e3d,sz:0.05},
    ketchup:{name:'Ketchup',c:0xc0392b,mat:'standard',shape:'bottle',eff:'pour',color:0xc0392b,sz:0.08},
    mustard:{name:'Moutarde',c:0xe6c229,mat:'standard',shape:'bottle',eff:'pour',color:0xe6c229,sz:0.08},
    salt:{name:'Sel',c:0xf5f5f0,mat:'toon',shape:'box',eff:'particle',color:0xffffff,sz:0.06}
  };

  // ---- RECIPES (Diner) ----
  var RECIPES = [
    {id:'cheeseburger',name:'Cheeseburger',ings:['bun','patty','cheese','lettuce','tomato','ketchup'],score:300},
    {id:'bacon_egg',name:'Bacon & Œuf',ings:['bun','egg','bacon','cheese','ketchup'],score:280},
    {id:'classic_burger',name:'Burger classique',ings:['bun','patty','lettuce','pickle','mustard'],score:260},
    {id:'veggie_burger',name:'Burger végé',ings:['bun','onion','tomato','lettuce','cheese','mustard'],score:270},
    {id:'fries_basket',name:'Panier de frites',ings:['potato','potato','salt'],score:200}
  ];

  // ---- MAKE INGREDIENT 3D MODEL ----
  function mkIng(ing){
    var g, mat=new $.MeshStandardMaterial({color:ing.c,roughness:0.7,metalness:0.05});
    if(ing.mat==='toon') mat=new $.MeshToonMaterial({color:ing.c});
    switch(ing.shape){
      case'bun': g=new $.SphereGeometry(0.09,14,10,0,PI2,0,PI2*0.35); break;
      case'rounded': g=new $.CylinderGeometry(0.09,0.09,0.035,16); break;
      case'slice': g=new $.BoxGeometry(0.16,0.012,0.16); break;
      case'wavy': g=new $.SphereGeometry(0.09,10,6); g.scale(1,0.3,1); break;
      case'sphere': g=new $.SphereGeometry(0.06,10,10); break;
      case'strip': g=new $.BoxGeometry(0.14,0.015,0.05); break;
      case'egg': g=new $.SphereGeometry(0.07,10,10); g.scale(1,1.3,1); break;
      case'oval': g=new $.SphereGeometry(0.06,10,10); g.scale(1,0.8,0.6); break;
      case'tube': g=new $.CylinderGeometry(0.02,0.02,0.11,8); break;
      case'bottle': g=new $.CylinderGeometry(0.05,0.07,0.2,10); break;
      case'box': g=new $.BoxGeometry(0.14,0.1,0.14); break;
      default: g=new $.SphereGeometry(0.06,8,8);
    }
    var m=new $.Mesh(g,mat); m.userData={id:ing.id,type:'ingredient'};
    m.castShadow=true;
    return m;
  }

  // ---- SCENE SETUP ----
  function init(){
    var el=document.getElementById('cksim-sceneWrap');
    if(!el) return;
    var cL=document.getElementById('cksim-canvas-L');
    var cR=document.getElementById('cksim-canvas-R');
    if(!cL||!cR) return;

    scene=new $.Scene(); scene.background=new $.Color(0x1a1210);
    scene.fog=new $.Fog(0x1a1210,4,12);

    renL=new $.WebGLRenderer({canvas:cL,antialias:true});
    renR=new $.WebGLRenderer({canvas:cR,antialias:true});
    renL.setPixelRatio(Math.min(devicePixelRatio,2)); renR.setPixelRatio(Math.min(devicePixelRatio,2));
    renL.shadowMap.enabled=true; renL.shadowMap.type=$.PCFSoftShadowMap;
    renR.shadowMap.enabled=true; renR.shadowMap.type=$.PCFSoftShadowMap;

    var a=$.MathUtils.degToRad(55);
    camL=new $.PerspectiveCamera(a,1,0.1,30); camL.position.set(-IPD,0,0);
    camR=new $.PerspectiveCamera(a,1,0.1,30); camR.position.set(IPD,0,0);
    camL.rotation.set(0,0,0); camR.rotation.set(0,0,0);

    rig=new $.Object3D(); rig.position.set(0,EY,0); rig.rotation.x=-0.12;
    rig.add(camL); rig.add(camR); scene.add(rig);

    // Lights
    var amb=new $.AmbientLight(0x554438,0.55); scene.add(amb);
    var sun=new $.DirectionalLight(0xffe8cc,1.1); sun.position.set(3,6,1); sun.castShadow=true;
    sun.shadow.mapSize.width=512; sun.shadow.mapSize.height=512;
    scene.add(sun);
    var neon=new $.PointLight(0xff3355,0.5,6); neon.position.set(-2,2.4,-3); scene.add(neon);
    var neon2=new $.PointLight(0x33bbff,0.4,6); neon2.position.set(2,2.4,-3); scene.add(neon2);
    var fill=new $.HemisphereLight(0xf0d9b5,0x2a1a0a,0.35); scene.add(fill);

    buildDiner(); buildGrill(); buildShelf(); buildFlipper();
    populateShelf();
    resize(); nextRecipe();

    document.getElementById('cksim-loading').classList.add('done');
    startLoop();
  }

  function destroy(){
    anims=[]; clickables=[]; S.phase='recipe'; S.heat=false;
    if(typeof document!=='undefined'){
      var l=document.getElementById('cksim-loading');
      if(l) l.classList.remove('done');
    }
  }

  // ---- RESIZE ----
  function resize(){
    if(!renL||!renR) return;
    var w=window.innerWidth, h=window.innerHeight;
    var hw=Math.floor(w/2);
    renL.setSize(hw,h,false); renR.setSize(hw,h,false);
    camL.aspect=camR.aspect=hw/h; camL.updateProjectionMatrix(); camR.updateProjectionMatrix();
  }
  window.addEventListener('resize',resize);

  // ---- BUILD DINER ----
  function buildDiner(){
    // Checkered floor
    var floorGroup=new $.Group();
    var n=16, tile=WALL_R*2/n;
    for(var i=0;i<n;i++){
      for(var j=0;j<n;j++){
        var x=-WALL_R+i*tile+tile/2, z=-WALL_R+j*tile+tile/2;
        if(Math.sqrt(x*x+z*z)>WALL_R) continue;
        var even=(i+j)%2===0;
        var fMat=new $.MeshStandardMaterial({color:even?0xf0ece0:0xb02020,roughness:0.5});
        var t=new $.Mesh(new $.PlaneGeometry(tile,tile),fMat);
        t.rotation.x=-Math.PI/2; t.position.set(x,0,z); t.receiveShadow=true;
        floorGroup.add(t);
      }
    }
    scene.add(floorGroup);

    // Wall
    var wMat=new $.MeshStandardMaterial({color:0x8a3838,roughness:0.85,side:$.BackSide});
    var wall=new $.Mesh(new $.CylinderGeometry(WALL_R,WALL_R,WALL_H,48,1,true),wMat);
    wall.position.y=WALL_H/2; scene.add(wall);

    // Wainscoting strip (chrome diner trim)
    var waMat=new $.MeshStandardMaterial({color:0xcccccc,roughness:0.3,metalness:0.7});
    for(var k=0;k<24;k++){
      var ang=k/24*PI2; var p=new $.BoxGeometry(0.9,0.1,0.04);
      var s=new $.Mesh(p,waMat);
      s.position.set(Math.cos(ang)*WALL_R,1.35,Math.sin(ang)*WALL_R);
      s.lookAt(0,1.35,0); scene.add(s);
    }

    // Counter
    var cMat=new $.MeshStandardMaterial({color:0xd0d0d0,roughness:0.3,metalness:0.5});
    var cnt=new $.Mesh(new $.BoxGeometry(2.4,0.7,1),cMat);
    cnt.position.set(0,0.35,-2.5); cnt.receiveShadow=true; cnt.castShadow=true;
    scene.add(cnt);
    var tMat=new $.MeshStandardMaterial({color:0x2a2a2a,roughness:0.4,metalness:0.6});
    var top=new $.Mesh(new $.BoxGeometry(2.6,0.05,1.1),tMat);
    top.position.set(0,0.725,-2.5); top.receiveShadow=true;
    scene.add(top);

    // Shelf
    var sMat=new $.MeshStandardMaterial({color:0x5a3c28,roughness:0.7});
    var sh=new $.Mesh(new $.BoxGeometry(3.4,0.05,0.5),sMat);
    sh.position.set(0,shelfY,shelfZ); sh.receiveShadow=true; scene.add(sh);
    for(var j2=-1.5;j2<=1.5;j2+=3){
      var sp=new $.Mesh(new $.BoxGeometry(0.05,1,0.05),sMat);
      sp.position.set(j2,1.1,shelfZ); scene.add(sp);
    }

    grillPos=new $.Vector3(0,grillY,-2.5);
  }

  // ---- BUILD GRILL ----
  function buildGrill(){
    var gMat=new $.MeshStandardMaterial({color:0x2c2c2c,roughness:0.4,metalness:0.8});
    var top=new $.Mesh(new $.BoxGeometry(1.0,0.05,0.7),gMat);
    top.position.copy(grillPos); top.userData={id:'grill',type:'grill'};
    scene.add(top);
    var rim=new $.Mesh(new $.BoxGeometry(1.06,0.08,0.76),gMat);
    rim.position.set(grillPos.x,grillPos.y-0.03,grillPos.z);
    scene.add(rim);

    // Fire glow beneath grill (invisible by default)
    var fG=new $.PlaneGeometry(0.9,0.6);
    var fMat=new $.MeshStandardMaterial({color:0xff6600,emissive:0xff4400,transparent:true,opacity:0,side:$.DoubleSide});
    var fire=new $.Mesh(fG,fMat);
    fire.rotation.x=-Math.PI/2;
    fire.position.set(grillPos.x,grillPos.y+0.001,grillPos.z);
    fire.userData={id:'fire',type:'fire',mat:fMat};
    scene.add(fire);

    clickables.push(top);
  }

  // ---- BUILD SHELF & INGREDIENTS ----
  function buildShelf(){}

  function populateShelf(){
    var toRemove=[];
    scene.traverse(function(o){if(o.userData&&o.userData.type==='shelf_item')toRemove.push(o);});
    toRemove.forEach(function(o){scene.remove(o);});

    if(!S.r) return;
    var ings=S.r.ings;
    var n=ings.length; var spacing=Math.min(2.8/(n+1),0.6);
    var startX=-(n-1)*spacing/2;
    for(var i=0;i<n;i++){
      var def=ING[ings[i]];
      if(!def) continue;
      var mesh=mkIng(def);
      mesh.position.set(startX+i*spacing,shelfY+0.12,shelfZ+0.05);
      mesh.userData={id:ings[i],type:'shelf_item',def:def,idx:i};
      scene.add(mesh);
      clickables.push(mesh);
    }
  }

  // ---- BUILD FLIPPER (spatula) ----
  var spatula;
  function buildFlipper(){
    spatula=new $.Group();
    var hMat=new $.MeshStandardMaterial({color:0x2a2a2a,roughness:0.6,metalness:0.4});
    var handle=new $.Mesh(new $.CylinderGeometry(0.025,0.03,0.3,8),hMat);
    handle.rotation.x=PI2/4; handle.position.y=0.15;
    spatula.add(handle);
    var sMat=new $.MeshStandardMaterial({color:0xcccccc,roughness:0.4,metalness:0.6});
    var head=new $.Mesh(new $.BoxGeometry(0.1,0.005,0.14),sMat);
    head.position.set(0,0.3,0.06); head.rotation.x=-0.15;
    spatula.add(head);
    spatula.visible=false; scene.add(spatula);
  }

  // ---- PARTICLES ----
  var particles;
  function initParticles(){
    var maxP=2000;
    var geom=new $.BufferGeometry();
    var pos=new Float32Array(maxP*3); var col=new Float32Array(maxP*3);
    var siz=new Float32Array(maxP); var vel=[]; var life=[];
    for(var i=0;i<maxP;i++){ pos[i*3]=0; pos[i*3+1]=-10; pos[i*3+2]=0; siz[i]=0; vel.push({x:0,y:0,z:0}); life.push(0); }
    geom.setAttribute('position',new $.BufferAttribute(pos,3));
    geom.setAttribute('color',new $.BufferAttribute(col,3));
    geom.setAttribute('size',new $.BufferAttribute(siz,1));
    var pMat=new $.PointsMaterial({
      size:0.04,vertexColors:true,transparent:true,opacity:1,
      blending:$.AdditiveBlending,depthWrite:false,sizeAttenuation:true
    });
    particles=new $.Points(geom,pMat); scene.add(particles);
    particles.userData={vel:vel,life:life,maxP:maxP};
  }
  initParticles();

  var pIdx=0;
  function emitParticles(pos3,cnt,color,spd,sz,lifeLen){
    var g=particles.geometry;
    var pa=g.attributes.position.array;
    var ca=g.attributes.color.array;
    var sa=g.attributes.size.array;
    var vel=particles.userData.vel;
    var life=particles.userData.life;
    var c=new $.Color(color);
    for(var i=0;i<cnt;i++){
      var idx=pIdx%particles.userData.maxP;
      pa[idx*3]=pos3.x+(Math.random()-0.5)*0.15;
      pa[idx*3+1]=pos3.y+0.1+(Math.random()-0.5)*0.1;
      pa[idx*3+2]=pos3.z+(Math.random()-0.5)*0.15;
      ca[idx*3]=c.r; ca[idx*3+1]=c.g; ca[idx*3+2]=c.b;
      sa[idx]=sz||0.04;
      vel[idx]={x:(Math.random()-0.5)*spd,y:Math.random()*spd+0.3,z:(Math.random()-0.5)*spd};
      life[idx]=lifeLen||1.2;
      pIdx++;
    }
    g.attributes.position.needsUpdate=true;
    g.attributes.color.needsUpdate=true;
    g.attributes.size.needsUpdate=true;
  }

  function updateParticles(dt){
    var g=particles.geometry;
    var pa=g.attributes.position.array;
    var sa=g.attributes.size.array;
    var vel=particles.userData.vel;
    var life=particles.userData.life;
    var up=false;
    for(var i=0;i<particles.userData.maxP;i++){
      if(life[i]<=0) continue;
      life[i]-=dt;
      if(life[i]<=0){ sa[i]=0; continue; }
      pa[i*3]+=vel[i].x*dt;
      pa[i*3+1]+=vel[i].y*dt;
      pa[i*3+2]+=vel[i].z*dt;
      vel[i].y-=1.5*dt;
      sa[i]*=0.98;
      up=true;
    }
    if(up){ g.attributes.position.needsUpdate=true; g.attributes.size.needsUpdate=true; }
  }

  // ---- POUR ANIMATION (ketchup/mustard squeeze) ----
  function startPour(from,to,color){
    var mat=new $.MeshStandardMaterial({
      color:color,transparent:true,opacity:0.85,
      roughness:0.3,metalness:0.1
    });
    var mesh=new $.Mesh(new $.CylinderGeometry(0.015,0.04,1,8),mat);
    var dir=new $.Vector3().copy(to).sub(from);
    var len=dir.length(); var mid=new $.Vector3().copy(from).add(to).multiplyScalar(0.5);
    if(len<0.01) return;
    mesh.position.copy(mid); mesh.scale.y=len;
    mesh.quaternion.setFromUnitVectors(new $.Vector3(0,1,0),dir.clone().normalize());
    mesh.userData={type:'pour',t:0,mat:mat};
    scene.add(mesh);
    anims.push(mesh);
  }

  // ---- INGREDIENT FLY ANIMATION ----
  function startFly(mesh,to){
    var from=mesh.position.clone();
    mesh.userData.fly={from:from,to:to,t:0,dur:0.6};
    if(!anims.includes(mesh)) anims.push(mesh);
  }

  // ---- UPDATE ANIMS ----
  function updateAnims(dt){
    for(var i=anims.length-1;i>=0;i--){
      var a=anims[i];
      var ud=a.userData;
      if(ud.type==='pour'){
        ud.t+=dt;
        ud.mat.opacity=Math.max(0,0.9-ud.t*2);
        var s=Math.min(1,ud.t*8);
        a.scale.y=s; a.scale.x=0.3+0.7*s;
        if(ud.t>1.2){ scene.remove(a); anims.splice(i,1); }
      } else if(ud.fly){
        ud.fly.t+=dt;
        var p=Math.min(1,ud.fly.t/ud.fly.dur);
        var e=p<0.5?2*p*p:1-(-2*p+2)*(-2*p+2)/2;
        a.position.lerpVectors(ud.fly.from,ud.fly.to,e);
        if(p>=1){
          var def=ING[ud.id];
          if(def&&def.eff==='pour'&&ud.id!==undefined){
            startPour(ud.fly.to,new $.Vector3(grillPos.x,grillPos.y+0.06,grillPos.z),def.color);
          }
          if(def&&def.eff==='particle'){
            emitParticles(new $.Vector3(grillPos.x,grillPos.y+0.15,grillPos.z),150,0xffffff,0.8,0.04,1.2);
          }
          if(S.r&&ud.id&&!S.items.includes(ud.id)){
            S.items.push(ud.id);
            updateRecipeUI();
          }
          scene.remove(a); anims.splice(i,1);
        }
      }
    }
  }

  // ---- HAND INTERACTION ----
  function getNDC(px,py){
    var rect=document.getElementById('cksim-eye-L').getBoundingClientRect();
    return {x:((px-rect.left)/rect.width)*2-1,y:-((py-rect.top)/rect.height)*2+1};
  }

  var dt=0;
  function updateHand(){
    var api=window.__handTrackAPI;
    if(!api||!api.isActive||!api.screen){ hand.poke=false; hand.wPoke=false; return; }
    var s=api.screen; hand.x=s.pageX; hand.y=s.pageY;
    hand.poke=!!api.pinching;

    var ndc=getNDC(hand.x,hand.y);
    var ray=new $.Raycaster();
    ray.setFromCamera(new $.Vector2(ndc.x,ndc.y),camL);

    var hits=ray.intersectObjects(clickables,true);
    var hitObj=null;
    if(hits.length>0){
      var o=hits[0].object;
      while(o){
        if(o.userData&&(o.userData.type==='shelf_item'||o.userData.type==='grill')){
          hitObj=o; break;
        }
        o=o.parent;
      }
    }
    if(hitObj!==hovered){ hovered=hitObj; }

    if(hand.poke&&!hand.wPoke){
      if(hitObj){
        if(hitObj.userData.type==='shelf_item'){
          doIngredientClick(hitObj);
        } else if(hitObj.userData.type==='grill'&&S.heat){
          S.stir=1;
        }
      }
    } else if(!hand.poke&&hand.wPoke){
      if(hitObj&&hitObj.userData.type==='grill'&&S.stir>0.5){
        detectFlip();
      }
      S.stir=0;
    }
    hand.wPoke=hand.poke;

    if(hand.poke){
      var plane=new $.Plane(new $.Vector3(0,1,0),-grillPos.y);
      var pt=new $.Vector3();
      var hitPlane=ray.ray.intersectPlane(plane,pt);
      if(hitPlane){
        var dist=pt.distanceTo(grillPos);
        if(dist<1.2){
          spatula.position.copy(pt); spatula.position.y=grillPos.y+0.02;
          spatula.visible=true;
          hand.posHist.push({x:pt.x,z:pt.z,t:performance.now()});
          if(hand.posHist.length>30) hand.posHist.shift();
          if(dist<0.5){
            var totAng=0,prevAng=0;
            for(var k=1;k<hand.posHist.length;k++){
              var dx=hand.posHist[k].x-hand.posHist[k-1].x;
              var dz=hand.posHist[k].z-hand.posHist[k-1].z;
              var ang=Math.atan2(dz,dx);
              if(k>1){
                var da=ang-prevAng;
                if(da>Math.PI) da-=PI2;
                if(da<-Math.PI) da+=PI2;
                totAng+=Math.abs(da);
              }
              prevAng=ang;
            }
            if(totAng>PI2*2){ S.stir=Math.min(1,S.stir+dt*2); }
          }
          if(hand.posHist.length>1){
            var p0=hand.posHist[hand.posHist.length-2];
            var p1=hand.posHist[hand.posHist.length-1];
            var dxS=p1.x-p0.x, dzS=p1.z-p0.z;
            if(Math.abs(dxS)>0.001||Math.abs(dzS)>0.001){
              spatula.rotation.y=Math.atan2(dxS,dzS);
              spatula.rotation.x=-0.15+Math.sin(performance.now()*0.005)*0.05;
            }
          }
        } else { spatula.visible=false; }
      }
    } else { spatula.visible=false; hand.posHist=[]; }
  }

  function detectFlip(){
    var hist=hand.posHist;
    if(hist.length<5) return;
    var last=hist[hist.length-1];
    var prev=hist[Math.max(0,hist.length-5)];
    var dtF=last.t-prev.t;
    if(dtF<0.01) return;
    if(S.stir>0.3&&S.heat&&S.items.length>0){
      emitParticles(grillPos,30,0xffaa33,1.5,0.06,0.8);
      emitParticles(grillPos,20,0xff6600,1.2,0.04,0.6);
      S.toss=Math.min(1,S.toss+0.5);
    }
  }

  // ---- INGREDIENT CLICK ----
  function doIngredientClick(mesh){
    if(!S.r) return;
    var id=mesh.userData.id;
    var def=ING[id];
    if(!def) return;
    var expected=S.r.ings[S.nextIngIdx];
    if(id!==expected) return;

    var to=new $.Vector3(grillPos.x,grillPos.y+0.25,grillPos.z);

    if(def.eff==='pour'){
      startPour(mesh.position,new $.Vector3(grillPos.x,grillPos.y+0.06,grillPos.z),def.color);
      var animMesh=mesh.clone();
      animMesh.userData={id:id,fly:{from:mesh.position.clone(),to:to,t:0,dur:0.3},type:'fly'};
      animMesh.scale.set(0.3,0.3,0.3);
      scene.add(animMesh);
      anims.push(animMesh);
    } else {
      mesh.userData.fly={from:mesh.position.clone(),to:to,t:0,dur:0.5};
      mesh.userData.id=id;
      mesh.scale.set(1,1,1);
      if(!anims.includes(mesh)) anims.push(mesh);
    }

    var idx=clickables.indexOf(mesh);
    if(idx>=0) clickables.splice(idx,1);

    S.nextIngIdx++;

    if(S.nextIngIdx>=S.r.ings.length){
      showFeedback('✅ Prêt ! Allume la plancha et cuisine !','good');
    }

    if(window.playAppleClick) window.playAppleClick();
  }

  // ---- GAME ACTIONS ----
  function toggleHeat(){
    S.heat=!S.heat;
    var btn=document.getElementById('cksim-btn-heat');
    if(btn) btn.classList.toggle('active',S.heat);
    scene.traverse(function(o){
      if(o.userData&&o.userData.type==='fire'){
        o.userData.mat.opacity=S.heat?0.75:0;
      }
    });
    if(window.playAppleClick) window.playAppleClick();
  }

  function addSeason(){
    if(!S.r||S.nextIngIdx>=S.r.ings.length) return;
    var expected=S.r.ings[S.nextIngIdx];
    if(expected==='salt'){
      for(var i=0;i<clickables.length;i++){
        var o=clickables[i];
        if(o.userData&&o.userData.id===expected){
          doIngredientClick(o); return;
        }
      }
    }
    emitParticles(grillPos,80,0xffffff,1.2,0.04,1.5);
    if(window.playAppleClick) window.playAppleClick();
  }

  function cksimServe(){
    if(!S.r||S.nextIngIdx<S.r.ings.length||!S.heat){
      showFeedback('❌ Pas encore prêt !','bad'); return;
    }
    var bonus=Math.round(S.stir*50)+Math.round(S.toss*30);
    var score=S.r.score+bonus;
    S.money+=score;
    showFeedback('💰 +'+score+' pièces !','good');
    if(window.playAppleClick) window.playAppleClick();
    setTimeout(function(){
      S.day++; S.step=0; S.stir=0; S.toss=0; S.items=[];
      S.heat=false; S.phase='recipe'; S.nextIngIdx=0;
      var btn=document.getElementById('cksim-btn-heat');
      if(btn) btn.classList.remove('active');
      nextRecipe();
    },1500);
  }

  function showFeedback(msg,cls){
    var el=document.getElementById('cksim-feedback-L');
    if(!el) return;
    el.textContent=msg; el.className='cksim-feedback show'+(cls?' '+cls:'');
    clearTimeout(el._hide);
    el._hide=setTimeout(function(){el.className='cksim-feedback';},2000);
  }

  // ---- RECIPE SYSTEM ----
  function nextRecipe(){
    var idx=(S.day-1)%RECIPES.length;
    S.r=RECIPES[idx];
    S.nextIngIdx=0; S.items=[]; S.stir=0; S.toss=0;
    populateShelf();
    updateRecipeUI();
    showFeedback('🍔 Commande : '+S.r.name,'good');
  }

  function updateRecipeUI(){
    if(!S.r) return;
    ['L','R'].forEach(function(side){
      var dayEl=document.getElementById('cksim-day-'+side);
      var moneyEl=document.getElementById('cksim-money-'+side);
      var recipeEl=document.getElementById('cksim-recipe-'+side);
      var listEl=document.getElementById('cksim-recipeList-'+side);
      if(dayEl) dayEl.textContent='Jour '+S.day;
      if(moneyEl) moneyEl.textContent='💰 '+S.money;
      if(recipeEl) recipeEl.textContent=S.r.name;
      if(listEl){
        listEl.innerHTML='';
        S.r.ings.forEach(function(id,i){
          var def=ING[id]; if(!def) return;
          var div=document.createElement('div');
          div.className='cksim-ing-item'+(i<S.nextIngIdx?' done':'');
          div.textContent=(i<S.nextIngIdx?'✅':'⬜')+' '+def.name;
          listEl.appendChild(div);
        });
      }
    });
  }

  // ---- DRAG TO LOOK ----
  function setupDrag(){
    var wrap=document.getElementById('cksim-sceneWrap');
    if(!wrap) return;
    wrap.addEventListener('mousedown',function(e){
      if(!e.isTrusted) return;
      drag.on=true; drag.sx=e.clientX; wrap.style.cursor='grabbing';
    });
    window.addEventListener('mousemove',function(e){
      if(!drag.on) return;
      var dx=e.clientX-drag.sx;
      S.camYaw+=dx*0.004; drag.sx=e.clientX;
    });
    window.addEventListener('mouseup',function(){drag.on=false;var w=document.getElementById('cksim-sceneWrap');if(w)w.style.cursor='grab';});
    wrap.addEventListener('touchstart',function(e){
      if(e.touches.length===1){ drag.on=true; drag.sx=e.touches[0].clientX; }
    },{passive:true});
    window.addEventListener('touchmove',function(e){
      if(drag.on&&e.touches.length===1){
        var dx=e.touches[0].clientX-drag.sx;
        S.camYaw+=dx*0.004; drag.sx=e.touches[0].clientX;
      }
    },{passive:true});
    window.addEventListener('touchend',function(){drag.on=false;});
  }

  // ---- MAIN LOOP ----
  var loopRunning=false;
  function startLoop(){
    if(loopRunning) return; loopRunning=true;
    setupDrag(); resize(); loop(0);
  }

  var lastTs=0;
  function loop(ts){
    if(!loopRunning) return;
    requestAnimationFrame(loop);
    dt=Math.min((ts-lastTs)/1000,0.05); lastTs=ts;

    if(!drag.on){ S.camYaw+=dt*0.05; }
    rig.rotation.y=S.camYaw*10;

    updateHand();
    updateAnims(dt);
    updateParticles(dt);

    scene.traverse(function(o){
      if(o.userData&&o.userData.type==='fire'&&o.userData.mat.opacity>0){
        o.scale.x=0.92+Math.random()*0.16;
        o.scale.z=0.92+Math.random()*0.16;
      }
    });

    renL.render(scene,camL);
    renR.render(scene,camR);
  }

  // ---- PUBLIC API ----
  window.initCookingSimGame=init;
  window.destroyCookingSimGame=function(){loopRunning=false;destroy();};
  window.cksimToggleHeat=toggleHeat;
  window.cksimAddSeason=addSeason;
  window.cksimServe=cksimServe;

  // Auto-init if overlay is already active (loaded late)
  var ov2=document.getElementById('cksim-overlay');
  if(ov2&&ov2.classList.contains('active')) init();
})();
