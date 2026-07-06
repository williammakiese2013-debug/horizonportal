(function(){
  var $ = THREE, DEG = $.MathUtils.degToRad, PI2 = Math.PI*2;
  var S = { r:null, heat:false, stir:0, toss:0, day:1, money:0, 
    step:0, phase:'recipe', items:[], camYaw:0, nextIngIdx:0 };
  var scene, camL, camR, renL, renR, rig;
  var clickables=[], hovered=null, anims=[];
  var hand={x:0,y:0,poke:false,wPoke:false,posHist:[]};
  var drag={on:false,sx:0};
  var wokY=0.85, wokPos, shelfY=1.7, shelfZ=-1.2;
  var IPD=0.028, EY=1.55;
  var WALL_R=7, WALL_H=3.8;
  var ci=0; // unique id counter
  
  // ---- INGREDIENT MODELS ----
  var ING = {
    oil:{name:'Huile',c:0xd4a030,mat:'standard',shape:'bottle',eff:'pour',color:0xddb830,sz:0.08},
    sauce:{name:'Sauce soja',c:0x3c1c0c,mat:'standard',shape:'bottle',eff:'pour',color:0x3c1c0c,sz:0.08},
    salt:{name:'Sel',c:0xf5f5f0,mat:'toon',shape:'box',eff:'particle',color:0xffffff,sz:0.06},
    sugar:{name:'Sucre',c:0xffe4c4,mat:'toon',shape:'box',eff:'particle',color:0xffd700,sz:0.06},
    spices:{name:'Épices',c:0x4caf50,mat:'toon',shape:'can',eff:'particle',color:0x66bb6a,sz:0.06},
    egg:{name:'Œuf',c:0xfff8e7,mat:'standard',shape:'egg',eff:'fly',color:0xffaa33,sz:0.07},
    rice:{name:'Riz',c:0xf8f4e0,mat:'toon',shape:'round',eff:'fly',color:0xf5f5dc,sz:0.07},
    carrot:{name:'Carotte',c:0xff8c00,mat:'standard',shape:'cone',eff:'fly',color:0xff8c00,sz:0.07},
    meat:{name:'Viande',c:0x8b4513,mat:'standard',shape:'rounded',eff:'fly',color:0x8b4513,sz:0.09},
    onion:{name:'Oignon',c:0xc88bca,mat:'standard',shape:'sphere',eff:'fly',color:0xe8c8e8,sz:0.07},
    shrimp:{name:'Crevette',c:0xf49b9b,mat:'standard',shape:'curve',eff:'fly',color:0xf49b9b,sz:0.07},
    garlic:{name:'Ail',c:0xf5f0e0,mat:'toon',shape:'round',eff:'fly',color:0xf5f0e0,sz:0.05},
    ginger:{name:'Gingembre',c:0xd2b48c,mat:'standard',shape:'knobby',eff:'fly',color:0xd2b48c,sz:0.06},
    noodles:{name:'Nouilles',c:0xf0d080,mat:'toon',shape:'tubes',eff:'fly',color:0xf0d080,sz:0.08},
    tofu:{name:'Tofu',c:0xf5f0e0,mat:'toon',shape:'box',eff:'fly',color:0xf5f0e0,sz:0.07}
  };
  
  // ---- RECIPES ----
  var RECIPES = [
    {id:'fried_rice',name:'Riz sauté',ings:['oil','egg','rice','carrot','salt'],score:250},
    {id:'noodle_stir',name:'Nouilles sautées',ings:['oil','meat','noodles','sauce','salt'],score:300},
    {id:'shrimp_wok',name:'Crevettes au wok',ings:['oil','garlic','shrimp','spices','salt'],score:350},
    {id:'veggie_stir',name:'Sauté de légumes',ings:['oil','onion','carrot','garlic','salt','spices'],score:320},
    {id:'ginger_fish',name:'Poisson gingembre',ings:['oil','ginger','garlic','sauce','salt'],score:380}
  ];
  
  // ---- MAKE INGREDIENT 3D MODEL ----
  function mkIng(ing){
    var g, mat=new $.MeshStandardMaterial({color:ing.c,roughness:0.7,metalness:0.1});
    if(ing.mat==='toon') mat=new $.MeshToonMaterial({color:ing.c});
    switch(ing.shape){
      case'bottle': g=new $.CylinderGeometry(0.06,0.08,0.2,8); break;
      case'box': g=new $.BoxGeometry(0.14,0.1,0.14); break;
      case'can': g=new $.CylinderGeometry(0.07,0.06,0.13,8); break;
      case'egg': g=new $.SphereGeometry(0.07,10,10); g.scale(1,1.3,1); break;
      case'round': g=new $.SphereGeometry(0.06,8,8); break;
      case'cone': g=new $.ConeGeometry(0.06,0.2,8); break;
      case'rounded': g=new $.BoxGeometry(0.15,0.08,0.1); break;
      case'sphere': g=new $.SphereGeometry(0.07,10,10); break;
      case'curve': g=new $.TorusGeometry(0.05,0.03,6,10,PI2*0.6); break;
      case'knobby': g=new $.SphereGeometry(0.06,10,10); g.scale(1,0.8,0.7); break;
      case'tubes': g=new $.CylinderGeometry(0.04,0.04,0.2,6); break;
      default: g=new $.SphereGeometry(0.06,8,8);
    }
    var m=new $.Mesh(g,mat); m.userData={id:ing.id,type:'ingredient'};
    m.castShadow=true;
    return m;
  }
  
  // ---- SCENE SETUP ----
  function init(){
    var el=document.getElementById('cooking-sceneWrap');
    if(!el) return;
    var cL=document.getElementById('cooking-canvas-L');
    var cR=document.getElementById('cooking-canvas-R');
    if(!cL||!cR) return;
    
    scene=new $.Scene(); scene.background=new $.Color(0x1a0e08);
    scene.fog=new $.Fog(0x1a0e08,4,12);
    
    renL=new $.WebGLRenderer({canvas:cL,antialias:true});
    renR=new $.WebGLRenderer({canvas:cR,antialias:true});
    renL.setPixelRatio(Math.min(devicePixelRatio,2)); renR.setPixelRatio(Math.min(devicePixelRatio,2));
    renL.shadowMap.enabled=true; renL.shadowMap.type=$.PCFSoftShadowMap;
    renR.shadowMap.enabled=true; renR.shadowMap.type=$.PCFSoftShadowMap;
    
    var a=$.MathUtils.degToRad(55);
    camL=new $.PerspectiveCamera(a,1,0.1,30); camL.position.set(-IPD,0,0);
    camR=new $.PerspectiveCamera(a,1,0.1,30); camR.position.set(IPD,0,0);
    // Both cameras look along rig's -Z (no lookAt — parallel stereo)
    camL.rotation.set(0,0,0); camR.rotation.set(0,0,0);
    
    rig=new $.Object3D(); rig.position.set(0,EY,0); rig.rotation.x=-0.12; // tilt down toward counter
    rig.add(camL); rig.add(camR); scene.add(rig);
    
    // Lights
    var amb=new $.AmbientLight(0x554433,0.5); scene.add(amb);
    var sun=new $.DirectionalLight(0xffeedd,1.2); sun.position.set(3,6,1); sun.castShadow=true;
    sun.shadow.mapSize.width=512; sun.shadow.mapSize.height=512;
    scene.add(sun);
    var warm=new $.PointLight(0xff8833,0.6,5); warm.position.set(-1.5,2.5,-3); scene.add(warm);
    var fill=new $.HemisphereLight(0xd4b896,0x2a1a0a,0.3); scene.add(fill);
    
    buildKitchen(); buildWok(); buildShelf(); buildSpatula();
    populateShelf();
    resize(); nextRecipe();
    
    document.getElementById('cook-loading').classList.add('done');
    startLoop();
  }
  
  function destroy(){
    anims=[]; clickables=[]; S.phase='recipe'; S.heat=false;
    if(typeof document!=='undefined'){
      document.getElementById('cook-loading').classList.remove('done');
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
  
  // ---- BUILD KITCHEN ----
  function buildKitchen(){
    // Floor
    var fMat=new $.MeshStandardMaterial({color:0x5a3e28,roughness:0.9});
    var floor=new $.Mesh(new $.CircleGeometry(WALL_R,48),fMat);
    floor.rotation.x=-PI2/4; floor.position.y=-0.01; floor.receiveShadow=true;
    scene.add(floor);
    
    // Wall
    var wMat=new $.MeshStandardMaterial({color:0xccb696,roughness:0.85,side:$.BackSide});
    var wall=new $.Mesh(new $.CylinderGeometry(WALL_R,WALL_R,WALL_H,48,1,true),wMat);
    wall.position.y=WALL_H/2; scene.add(wall);
    
    // Wainscoting strip
    var waMat=new $.MeshStandardMaterial({color:0x8b7355,roughness:0.8});
    for(var i=0;i<24;i++){
      var a=i/24*PI2; var p=new $.BoxGeometry(0.9,0.4,0.04);
      var s=new $.Mesh(p,waMat);
      s.position.set(Math.cos(a)*WALL_R,1.0,Math.sin(a)*WALL_R);
      s.lookAt(0,1,0); scene.add(s);
    }
    
    // Counter
    var cMat=new $.MeshStandardMaterial({color:0x7a5a3a,roughness:0.7});
    var cnt=new $.Mesh(new $.BoxGeometry(2.2,0.7,1),cMat);
    cnt.position.set(0,0.35,-2.5); cnt.receiveShadow=true; cnt.castShadow=true;
    scene.add(cnt);
    var tMat=new $.MeshStandardMaterial({color:0xa0784a,roughness:0.6});
    var top=new $.Mesh(new $.BoxGeometry(2.4,0.05,1.1),tMat);
    top.position.set(0,0.725,-2.5); top.receiveShadow=true;
    scene.add(top);
    
    // Shelf
    var sMat=new $.MeshStandardMaterial({color:0x6b4c30,roughness:0.7});
    var sh=new $.Mesh(new $.BoxGeometry(3.4,0.05,0.5),sMat);
    sh.position.set(0,shelfY,shelfZ); sh.receiveShadow=true; scene.add(sh);
    for(var j=-1.5;j<=1.5;j+=3){
      var sp=new $.Mesh(new $.BoxGeometry(0.05,1,0.05),sMat);
      sp.position.set(j,1.1,shelfZ); scene.add(sp);
    }
    
    wokPos=new $.Vector3(0,wokY,-2.5);
  }
  
  // ---- BUILD WOK ----
  function buildWok(){
    var wg=new $.RingGeometry(0.35,0.5,24);
    var wMat=new $.MeshStandardMaterial({color:0x444444,roughness:0.6,metalness:0.7,side:$.DoubleSide});
    var wokRim=new $.Mesh(wg,wMat); wokRim.position.copy(wokPos); wokRim.rotation.x=-PI2/4;
    wokRim.userData={id:'wok',type:'wok'};
    scene.add(wokRim);
    var wb=new $.SphereGeometry(0.38,20,20,0,PI2,0,PI2*0.4);
    var wokBowl=new $.Mesh(wb,wMat); wokBowl.position.copy(wokPos); wokBowl.position.y-=0.05;
    wokBowl.rotation.x=PI2/4;
    scene.add(wokBowl);
    
    // Fire (invisible by default)
    var fG=new $.ConeGeometry(0.25,0.3,12);
    var fMat=new $.MeshStandardMaterial({color:0xff6600,emissive:0xff4400,transparent:true,opacity:0});
    var fire=new $.Mesh(fG,fMat);
    fire.position.set(wokPos.x,wokPos.y-0.15,wokPos.z);
    fire.userData={id:'fire',type:'fire',mat:fMat};
    scene.add(fire);
    
    clickables.push(wokRim);
  }
  
  // ---- BUILD SHELF & INGREDIENTS ----
  function buildShelf(){}
  
  function populateShelf(){
    // Clear old shelf items
    var toRemove=[];
    scene.traverse(function(o){if(o.userData&&o.userData.type==='shelf_item')toRemove.push(o);});
    toRemove.forEach(function(o){scene.remove(o);});
    
    // Place ingredients from current recipe on shelf
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
  
  // ---- BUILD SPATULA ----
  var spatula;
  function buildSpatula(){
    spatula=new $.Group();
    var hMat=new $.MeshStandardMaterial({color:0x8b5e3c,roughness:0.8});
    var handle=new $.Mesh(new $.CylinderGeometry(0.025,0.03,0.3,8),hMat);
    handle.rotation.x=PI2/4; handle.position.y=0.15;
    spatula.add(handle);
    var sMat=new $.MeshStandardMaterial({color:0x333333,roughness:0.6,metalness:0.5});
    var head=new $.Mesh(new $.BoxGeometry(0.08,0.005,0.12),sMat);
    head.position.set(0,0.3,0.05); head.rotation.x=-0.2;
    spatula.add(head);
    var nMat=new $.MeshStandardMaterial({color:0x666666,roughness:0.5,metalness:0.4});
    var neck=new $.Mesh(new $.BoxGeometry(0.03,0.01,0.06),nMat);
    neck.position.set(0,0.23,0.02);
    spatula.add(neck);
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
  
  // ---- POUR ANIMATION ----
  function startPour(from,to,color){
    var mat=new $.MeshStandardMaterial({
      color:color,transparent:true,opacity:0.8,
      roughness:0.3,metalness:0.1
    });
    var mesh=new $.Mesh(new $.CylinderGeometry(0.02,0.06,1,8),mat);
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
        ud.mat.opacity=Math.max(0,1-ud.t*2);
        var s=Math.min(1,ud.t*8);
        a.scale.y=s; a.scale.x=0.3+0.7*s;
        if(ud.t>1.2){ scene.remove(a); anims.splice(i,1); }
      } else if(ud.fly){
        ud.fly.t+=dt;
        var p=Math.min(1,ud.fly.t/ud.fly.dur);
        var e=p<0.5?2*p*p:1-(-2*p+2)*(-2*p+2)/2; // ease in-out
        a.position.lerpVectors(ud.fly.from,ud.fly.to,e);
        if(p>=1){
          var def=ING[ud.id];
          if(def&&def.eff==='pour'&&ud.id!==undefined){
            startPour(ud.fly.to,new $.Vector3(wokPos.x,wokPos.y+0.1,wokPos.z),def.color);
          }
          if(def&&def.eff==='particle'){
            var pc=def.id==='spices'?0x66bb6a:def.id==='sugar'?0xffd700:def.id==='salt'?0xffffff:0xffffff;
            emitParticles(new $.Vector3(wokPos.x,wokPos.y+0.15,wokPos.z),150,pc,0.8,0.04,1.2);
          }
          // Add to wok items
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
    var rect=document.getElementById('cook-eye-L').getBoundingClientRect();
    return {x:((px-rect.left)/rect.width)*2-1,y:-((py-rect.top)/rect.height)*2+1};
  }
  
  function updateHand(){
    var api=window.__handTrackAPI;
    if(!api||!api.isActive||!api.screen){ hand.poke=false; hand.wPoke=false; return; }
    var s=api.screen; hand.x=s.pageX; hand.y=s.pageY;
    hand.poke=!!api.pinching; // in close mode = poke
    
    var ndc=getNDC(hand.x,hand.y);
    var ray=new $.Raycaster();
    ray.setFromCamera(new $.Vector2(ndc.x,ndc.y),camL);
    
    // Raycast
    var hits=ray.intersectObjects(clickables,true);
    var hitObj=null;
    if(hits.length>0){
      // Walk up to find the clickable parent
      var o=hits[0].object;
      while(o){
        if(o.userData&&o.userData.type==='shelf_item'||o.userData&&o.userData.type==='wok'){
          hitObj=o; break;
        }
        o=o.parent;
      }
    }
    
    if(hitObj!==hovered){
      hovered=hitObj;
    }
    
    // Click / poke
    if(hand.poke&&!hand.wPoke){
      if(hitObj){
        if(hitObj.userData.type==='shelf_item'){
          doIngredientClick(hitObj);
        } else if(hitObj.userData.type==='wok'&&S.heat){
          // Stir starts
          S.stir=1;
        }
      }
    } else if(!hand.poke&&hand.wPoke){
      if(hitObj&&hitObj.userData.type==='wok'&&S.stir>0.5){
        // Toss check on release
        detectToss();
      }
      S.stir=0;
    }
    hand.wPoke=hand.poke;
    
    // Spatula position (on wok plane)
    if(hand.poke){
      var plane=new $.Plane(new $.Vector3(0,1,0),-wokPos.y);
      var pt=new $.Vector3();
      var hitPlane=ray.ray.intersectPlane(plane,pt);
      if(hitPlane){
        var dist=pt.distanceTo(wokPos);
        if(dist<1.2){
          spatula.position.copy(pt); spatula.position.y=wokPos.y+0.02;
          spatula.visible=true;
          // Track for stir detection
          hand.posHist.push({x:pt.x,z:pt.z,t:performance.now()});
          if(hand.posHist.length>30) hand.posHist.shift();
          // Stir detection
          if(dist<0.4){
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
          // Spatula rotation follows movement
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
  
  function detectToss(){
    var hist=hand.posHist;
    if(hist.length<5) return;
    var last=hist[hist.length-1];
    var prev=hist[Math.max(0,hist.length-5)];
    var dt=last.t-prev.t;
    if(dt<0.01) return;
    var vy=(last.z-prev.z)/dt;
    if(vy<0.5){ S.toss=Math.min(1,S.toss+0.5); } // flick up = toss
    if(S.stir>0.3&&S.heat&&S.items.length>0){
      emitParticles(wokPos,30,0xffaa33,1.5,0.06,0.8);
      emitParticles(wokPos,20,0xff6600,1.2,0.04,0.6);
    }
  }
  
  // ---- INGREDIENT CLICK ----
  function doIngredientClick(mesh){
    if(!S.r) return;
    var id=mesh.userData.id;
    var def=ING[id];
    if(!def) return;
    var expected=S.r.ings[S.nextIngIdx];
    if(id!==expected) return; // wrong order
    
    var to=new $.Vector3(wokPos.x,wokPos.y+0.3,wokPos.z);
    
    if(def.eff==='pour'){
      // For liquids: fly to wok, then pour
      if(def.id==='oil'||def.id==='sauce'){
        startPour(mesh.position,new $.Vector3(wokPos.x,wokPos.y+0.1,wokPos.z),def.color);
        var animMesh=mesh.clone();
        animMesh.userData={id:id,fly:{from:mesh.position.clone(),to:to,t:0,dur:0.3},type:'fly'};
        animMesh.scale.set(0.3,0.3,0.3);
        scene.add(animMesh);
        anims.push(animMesh);
      }
    } else {
      // Solid: fly to wok
      mesh.userData.fly={from:mesh.position.clone(),to:to,t:0,dur:0.5};
      mesh.userData.id=id;
      mesh.scale.set(1,1,1);
      if(!anims.includes(mesh)) anims.push(mesh);
    }
    
    // Disable from shelf
    var idx=clickables.indexOf(mesh);
    if(idx>=0) clickables.splice(idx,1);
    
    S.nextIngIdx++;
    
    // Check if recipe complete
    if(S.nextIngIdx>=S.r.ings.length){
      showFeedback('✅ Tous les ingrédients ! Active le feu et cuisine !','good');
    }
    
    // Sound placeholder
    if(window.playAppleClick) window.playAppleClick();
  }
  
  // ---- GAME ACTIONS ----
  function toggleHeat(){
    S.heat=!S.heat;
    document.getElementById('cook-btn-heat').classList.toggle('active',S.heat);
    // Find fire mesh
    scene.traverse(function(o){
      if(o.userData&&o.userData.type==='fire'){
        o.userData.mat.opacity=S.heat?0.8:0;
      }
    });
    if(window.playAppleClick) window.playAppleClick();
  }
  
  function addSalt(){
    if(!S.r||S.nextIngIdx>=S.r.ings.length) return;
    // Salt is an ingredient, handled via shelf click normally
    // But also allow via button if salt is next
    var expected=S.r.ings[S.nextIngIdx];
    if(expected==='salt'||expected==='spices'||expected==='sugar'){
      // Find matching shelf item
      for(var i=0;i<clickables.length;i++){
        var o=clickables[i];
        if(o.userData&&o.userData.id===expected){
          doIngredientClick(o); return;
        }
      }
    }
    // If salt button pressed and no shelf item, just emit particles
    emitParticles(wokPos,80,0xffffff,1.2,0.04,1.5);
    if(window.playAppleClick) window.playAppleClick();
  }
  
  function cookServe(){
    if(!S.r||S.nextIngIdx<S.r.ings.length||!S.heat){
      showFeedback('❌ Pas encore prêt !','bad'); return;
    }
    var bonus=Math.round(S.stir*50)+Math.round(S.toss*30);
    var score=S.r.score+bonus;
    S.money+=score;
    showFeedback('💰 +'+score+' pièces !','good');
    if(window.playAppleClick) window.playAppleClick();
    // Next day
    setTimeout(function(){
      S.day++; S.step=0; S.stir=0; S.toss=0; S.items=[];
      S.heat=false; S.phase='recipe'; S.nextIngIdx=0;
      document.getElementById('cook-btn-heat').classList.remove('active');
      nextRecipe();
    },1500);
  }
  
  function showFeedback(msg,cls){
    var el=document.getElementById('cook-feedback-L');
    if(!el) return;
    el.textContent=msg; el.className='cook-feedback show'+(cls?' '+cls:'');
    clearTimeout(el._hide);
    el._hide=setTimeout(function(){el.className='cook-feedback';},2000);
  }
  
  // ---- RECIPE SYSTEM ----
  function nextRecipe(){
    var idx=(S.day-1)%RECIPES.length;
    S.r=RECIPES[idx];
    S.nextIngIdx=0; S.items=[]; S.stir=0; S.toss=0;
    populateShelf();
    updateRecipeUI();
    showFeedback('🍳 Recette : '+S.r.name,'good');
  }
  
  function updateRecipeUI(){
    if(!S.r) return;
    ['L','R'].forEach(function(side){
      var dayEl=document.getElementById('cook-day-'+side);
      var moneyEl=document.getElementById('cook-money-'+side);
      var recipeEl=document.getElementById('cook-recipe-'+side);
      var listEl=document.getElementById('cook-recipeList-'+side);
      if(dayEl) dayEl.textContent='Jour '+S.day;
      if(moneyEl) moneyEl.textContent='💰 '+S.money;
      if(recipeEl) recipeEl.textContent=S.r.name;
      if(listEl){
        listEl.innerHTML='';
        S.r.ings.forEach(function(id,i){
          var def=ING[id]; if(!def) return;
          var div=document.createElement('div');
          div.className='cook-ing-item'+(i<S.nextIngIdx?' done':'');
          div.textContent=(i<S.nextIngIdx?'✅':'⬜')+' '+def.name;
          listEl.appendChild(div);
        });
      }
    });
  }
  
  // ---- DRAG TO LOOK ----
  function setupDrag(){
    var wrap=document.getElementById('cooking-sceneWrap');
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
    window.addEventListener('mouseup',function(){drag.on=false;var w=document.getElementById('cooking-sceneWrap');if(w)w.style.cursor='grab';});
    // Touch
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
    
    // Auto-rotate when not dragging
    if(!drag.on){ S.camYaw+=dt*0.05; }
    
    // Update camera rig
    rig.rotation.y=S.camYaw*10;
    
    // Update hand interaction
    updateHand();
    
    // Update animations
    updateAnims(dt);
    
    // Update particles
    updateParticles(dt);
    
    // Fire flicker
    scene.traverse(function(o){
      if(o.userData&&o.userData.type==='fire'&&o.userData.mat.opacity>0){
        o.scale.x=0.8+Math.random()*0.4;
        o.scale.z=0.8+Math.random()*0.4;
      }
    });
    
    // Render both eyes
    renL.render(scene,camL);
    renR.render(scene,camR);
  }
  
  // ---- PUBLIC API ----
  window.initCookingGame=init;
  window.destroyCookingGame=function(){loopRunning=false;destroy();};
  window.cookToggleHeat=toggleHeat;
  window.cookAddSalt=addSalt;
  window.cookServe=cookServe;
  
  // Auto-init if overlay is already active (loaded late)
  var ov=document.getElementById('cooking-overlay');
  if(ov&&ov.classList.contains('active')) init();
})();
