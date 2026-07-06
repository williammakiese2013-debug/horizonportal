(function(){
var $=THREE,PI2=Math.PI*2;

// ===== DATA =====
var CHARS={
  sarah:{name:'Sarah',skin:'#e4c8a8',hair:'#4a2820',hairS:'long',eyes:'#5a8fc9',
    lips:'#c47070',brows:'#4a2820',clothes:'#7a9acf',shape:'oval'},
  harrison:{name:'M.Harrison',skin:'#d4b896',hair:'#807060',hairS:'short',
    eyes:'#6a7a5a',lips:'#b08070',brows:'#807060',clothes:'#4a5a4a',shape:'round'},
  jake:{name:'Jake',skin:'#d4b090',hair:'#3a2020',hairS:'messy',eyes:'#6a8a5a',
    lips:'#b08070',brows:'#3a2020',clothes:'#5a3a2a',shape:'square'},
  moreau:{name:'Mme Moreau',skin:'#c8b8a0',hair:'#8a7a6a',hairS:'bun',
    eyes:'#4a5a5a',lips:'#a07060',brows:'#8a7a6a',clothes:'#2a3a3a',shape:'narrow'},
  liam:{name:'Liam',skin:'#e0c8a8',hair:'#8a4a20',hairS:'curly',eyes:'#5a8a5a',
    lips:'#b08070',brows:'#8a4a20',clothes:'#3a5a6a',shape:'oval'}
};
var EMOTIONS={normal:{brow:0,eye:1,mouth:0,flush:0},
  triste:{brow:0.4,eye:0.6,mouth:1,flush:0},
  colere:{brow:-0.5,eye:1.2,mouth:2,flush:0.3},
  peur:{brow:0.6,eye:1.4,mouth:2,flush:0.1},
  sourire:{brow:-0.1,eye:0.8,mouth:3,flush:0.05}};

// ===== DIALOGUE TREE =====
var SCENES={
  intro:{
    chapter:'Chapitre I — Le Retour',
    setup:'hall',
    nodes:[
      {id:'start',speaker:null,text:'Le lycée sent la poussière et le temps figé…\nTu reçois un SMS : "Reviens. Sarah a besoin de toi."',
        choices:[{text:'Aller vers le hall principal',next:'hall'}]},
      {id:'hall',speaker:'sarah',emotion:'peur',
        text:'"Tu es venu… Je savais que tu viendrais." Une silhouette au bout du couloir s\'estompe.',
        choices:[{text:'Aller aile gauche (salles de classe)',next:'gauche'},{text:'Aller aile droite (administration)',next:'droite'}]},
      {id:'gauche',speaker:'harrison',emotion:'triste',
        text:'"Ah… toi aussi tu l\'as reçu ? Je suis Harrison, j\'étais son prof d\'histoire. Sarah a découvert des choses qu\'elle n\'aurait pas dû."',
        choices:[{text:'"Qu\'a-t-elle découvert ?"',next:'harrison1'},{text:'"Où sont ses affaires ?"',next:'harrison2'}]},
      {id:'harrison1',speaker:'harrison',emotion:'triste',
        text:'"La Principale Moreau. Elle détournait les bourses. Sarah avait des preuves. Je les ai gardées." Il te tend un journal.',
        choices:[{text:'Lire le journal → indice clé',next:'journal'}]},
      {id:'harrison2',speaker:'harrison',emotion:'triste',
        text:'"Son casier est toujours au bout du couloir. Je n\'ai pas eu le cœur de le vider."',
        choices:[{text:'Fouiller le casier',next:'casier'}]},
      {id:'journal',speaker:null,text:'Le journal de Sarah. Dernière page : "Jake sait. Il veut m\'aider à tout révéler. Mais j\'ai peur. Elle sait que je sais."',
        setFlags:{luJournal:true},choices:[{text:'Aller voir Jake',next:'chap2'}]},
      {id:'casier',speaker:null,text:'Dans le casier : un téléphone portable. Un seul appel manqué le soir de sa disparition : "Liam".',
        setFlags:{telephone:true},choices:[{text:'Contacter Liam',next:'chap2'}]},
      {id:'droite',speaker:'moreau',emotion:'colere',
        text:'"Vous n\'avez rien à faire ici. Cette école est fermée. Partez avant que…" Elle s\'arrête, blême.',
        choices:[{text:'"Avant quoi ?"',next:'moreau1'}]},
      {id:'moreau1',speaker:'moreau',emotion:'peur',
        text:'"Avant qu\'il ne soit trop tard." Elle recule et disparaît dans l\'ombre.',
        choices:[{text:'La suivre',next:'chap2'}]},
      {id:'chap2',speaker:null,text:'CHAPITRE 2 — Ceux qui restent',
        choices:[],action:'nextChap'}
    ]
  },
  chap2:{
    chapter:'Chapitre II — Ceux qui restent',
    setup:'classroom',
    nodes:[
      {id:'start',speaker:'jake',emotion:'triste',
        text:'"Salut. Harrison m\'a dit que tu viendrais. Sarah et moi… on devait tout balancer sur Moreau. Mais j\'ai eu peur. Je suis parti."',
        choices:[{text:'"Tu l\'as abandonnée ?" -> Colere',next:'jake1a'},{text:'"Je comprends. La suite ?" -> Soutien',next:'jake1b'}]},
      {id:'jake1a',speaker:'jake',emotion:'colere',
        text:'"T\'etais pas la mec ! Tu sais pas ce que c\'est d\'avoir Moreau sur le dos."',
        choices:[{text:'"Raconte-moi tout"',next:'jake2'}]},
      {id:'jake1b',speaker:'jake',emotion:'sourire',
        text:'"Merci. Liam — son pote journaliste — a des infos. Il est dans la bibliothèque."',
        setFlags:{croitJake:true},choices:[{text:'Aller voir Liam',next:'liam'}]},
      {id:'jake2',speaker:'jake',emotion:'triste',
        text:'"Sarah avait tout : les comptes falsifiés, les menaces. Moreau lui a pris son téléphone. Mais elle avait une copie. Dans son casier."',
        setFlags:{luJournal:true},choices:[{text:'Aller à la bibliothèque',next:'liam'}]},
      {id:'liam',speaker:'liam',emotion:'triste',
        text:'"J\'ai enquêté pendant 10 ans. Moreau a fait disparaître des preuves. Sarah n\'est pas partie — elle est dans le sous-sol."',
        choices:[{text:'"Allons chercher la vérité."',next:'chap3'}]},
      {id:'chap3',speaker:null,text:'CHAPITRE 3 — Le poids du secret',choices:[],action:'nextChap'}
    ]
  },
  chap3:{
    chapter:'Chapitre III — Le poids du secret',
    setup:'office',
    nodes:[
      {id:'start',speaker:'moreau',emotion:'peur',
        text:'"Vous… vous êtes revenus. Je peux tout expliquer. Sarah était instable, elle avait des problèmes."',
        choices:[{text:'"Mensonges !" → Confronter',next:'confronter'},{text:'"Je veux entendre votre version."',next:'ecouter'}]},
      {id:'confronter',speaker:'moreau',emotion:'colere',
        text:'"Très bien. Oui, j\'ai pris l\'argent. Mais je n\'ai pas tué Sarah. Jake l\'a enfermée dans la chaufferie par accident. Il a paniqué."',
        setFlags:{confronte:true},choices:[{text:'Descendre au sous-sol',next:'chap4'}]},
      {id:'ecouter',speaker:'moreau',emotion:'triste',
        text:'"Jake l\'a enfermée. Je ne pouvais pas protéger tout le monde. Son corps est sous la chaufferie."',
        setFlags:{ecoute:true},choices:[{text:'Aller voir par toi-même',next:'chap4'}]},
      {id:'chap4',speaker:null,text:'CHAPITRE 4 — La vérité',choices:[],action:'nextChap'}
    ]
  },
  chap4:{
    chapter:'Chapitre IV — La vérité',
    setup:'basement',
    nodes:[
      {id:'start',speaker:'sarah',emotion:'peur',
        text:'"Il fait froid ici… Jake est venu me chercher après mon reportage. Il voulait m\'aider à cacher les preuves. Mais la porte s\'est refermée."',
        choices:[{text:'"Je vais tout révéler."',next:'fin1'},{text:'"Je vais étouffer l\'affaire."',next:'fin2'},{text:'"Je pardonne à tout le monde."',next:'fin3'}]},
      {id:'fin1',speaker:'sarah',emotion:'sourire',
        text:'"Merci. La vérité mérite d\'être connue."',
        setFlags:{fin:'justice'},choices:[],action:'end'},
      {id:'fin2',speaker:'sarah',emotion:'triste',
        text:'"Ils vont continuer. Mais c\'est ton choix."',
        setFlags:{fin:'silence'},choices:[],action:'end'},
      {id:'fin3',speaker:'sarah',emotion:'sourire',
        text:'"Tu es meilleur que nous tous. Repose-moi en paix."',
        setFlags:{fin:'pardon'},choices:[],action:'end'}
    ]
  },
  epilogue:{
    chapter:'Épilogue',
    setup:'roof',
    nodes:[
      {id:'start',speaker:null,
        text:'Le soleil se couche sur le lycée. Tu as fait ton choix.\nLes fantômes du passé peuvent enfin reposer.',
        choices:[{text:'FIN — Merci d\'avoir joué.',next:'',action:'quit'}]}
    ]
  }
};

// ===== FLAGS =====
var F={luJournal:false,telephone:false,croitJake:false,confronte:false,ecoute:false,fin:null};

// ===== THREE.JS SETUP =====
var scene,camL,camR,renL,renR,rig;
var IPD=0.028,EY=1.6;
var curScene=null,curNodeId=null,C=null;
var isSpeaking=false,speechMsg=null;
var loopRunning=false,lastTs=0;

function init(){
  var cL=document.getElementById('echoes-canvas-L');
  var cR=document.getElementById('echoes-canvas-R');
  if(!cL||!cR) return;
  scene=new $.Scene(); scene.background=new $.Color(0x050508);
  scene.fog=new $.FogExp2(0x050508,0.03);
  renL=new $.WebGLRenderer({canvas:cL,antialias:true});
  renR=new $.WebGLRenderer({canvas:cR,antialias:true});
  renL.setPixelRatio(Math.min(devicePixelRatio,2));
  renR.setPixelRatio(Math.min(devicePixelRatio,2));
  renL.shadowMap.enabled=true; renL.shadowMap.type=$.PCFSoftShadowMap;
  renR.shadowMap.enabled=true; renR.shadowMap.type=$.PCFSoftShadowMap;
  var fov=$.MathUtils.degToRad(60);
  camL=new $.PerspectiveCamera(fov,1,0.1,30); camL.position.set(-IPD,0,0);
  camR=new $.PerspectiveCamera(fov,1,0.1,30); camR.position.set(IPD,0,0);
  camL.rotation.set(0,0,0); camR.rotation.set(0,0,0);
  rig=new $.Object3D(); rig.position.set(0,EY,0); rig.rotation.x=-0.08;
  rig.add(camL); rig.add(camR); scene.add(rig);
  // Lights
  var amb=new $.AmbientLight(0x1a1a2a,0.3); scene.add(amb);
  var moon=new $.DirectionalLight(0x445566,0.2); moon.position.set(-5,8,-3); scene.add(moon);
  // Flashlight
  var fl=new $.SpotLight(0xccddee,2.0); fl.target.position.set(0,0,-4); fl.angle=0.5; fl.penumbra=0.4; fl.distance=15;
  fl.castShadow=true; rig.add(fl); rig.add(fl.target);
  scene.add(new $.HemisphereLight(0x223344,0x111122,0.2));
  buildHall(); resize(); document.getElementById('echoes-loading').classList.add('done');
  C=SCENES.intro; curScene='intro';
  F={luJournal:false,telephone:false,croitJake:false,confronte:false,ecoute:false,fin:null};
  showChapter(C.chapter,function(){showNode('start');});
  startLoop();
}
function destroy(){loopRunning=false;scene=null;renL=renR=null;
  document.getElementById('echoes-loading').classList.remove('done');}
function resize(){
  if(!renL||!renR) return;
  var w=window.innerWidth,h=window.innerHeight,hw=Math.floor(w/2);
  renL.setSize(hw,h,false); renR.setSize(hw,h,false);
  camL.aspect=camR.aspect=hw/h; camL.updateProjectionMatrix(); camR.updateProjectionMatrix();
}
window.addEventListener('resize',resize);

// ===== SCENE BUILDERS =====
var sceneObjects=[];
function clearScene(){sceneObjects.forEach(function(o){scene.remove(o);});sceneObjects=[];}
function addObj(m){scene.add(m);sceneObjects.push(m);return m;}

function buildHall(){
  clearScene(); rig.position.set(0,EY,0); rig.rotation.x=-0.08;
  // Floor
  var fMat=new $.MeshStandardMaterial({color:0x333340,roughness:0.9});
  addObj(new $.Mesh(new $.PlaneGeometry(24,16),fMat)).rotation.x=-PI2/4;
  // Walls
  var wMat=new $.MeshStandardMaterial({color:0x2a2a35,roughness:0.85,side:$.BackSide});
  var w1=addObj(new $.Mesh(new $.BoxGeometry(24,5,0.1),wMat)); w1.position.set(0,2.5,-8);
  // Pillars
  var pMat=new $.MeshStandardMaterial({color:0x3a3a48,roughness:0.8});
  [[-5,0,-3],[5,0,-3],[-4,0,2],[4,0,2]].forEach(function(p){
    var col=addObj(new $.Mesh(new $.CylinderGeometry(0.2,0.25,4,8),pMat));
    col.position.set(p[0],2,p[2]); });
  // Reception desk
  var dMat=new $.MeshStandardMaterial({color:0x4a3a2a,roughness:0.7});
  var desk=addObj(new $.Mesh(new $.BoxGeometry(1.5,0.8,0.6),dMat));
  desk.position.set(2,0.4,-6); desk.rotation.y=0.3;
  // Lamp flicker
  var lp=new $.PointLight(0x887766,0.3,6);
  lp.position.set(0,4.5,0); addObj(lp);
  window._echoLamp=lp;
  // Window light
  var wl=new $.DirectionalLight(0x445577,0.15);
  wl.position.set(0,3,8); addObj(wl);
}
function buildClassroom(){
  clearScene(); rig.position.set(0,EY,0); rig.rotation.x=-0.1;
  var fMat=new $.MeshStandardMaterial({color:0x3a3a30,roughness:0.9});
  addObj(new $.Mesh(new $.PlaneGeometry(10,8),fMat)).rotation.x=-PI2/4;
  var wMat=new $.MeshStandardMaterial({color:0x2a2a25,roughness:0.85,side:$.BackSide});
  var w=addObj(new $.Mesh(new $.BoxGeometry(10,4,0.1),wMat)); w.position.set(0,2,-5);
  var tMat=new $.MeshStandardMaterial({color:0x4a3a2a,roughness:0.7});
  for(var i=-2;i<=2;i+=2){
    var desk=addObj(new $.Mesh(new $.BoxGeometry(1.6,0.7,0.8),tMat));
    desk.position.set(i*0.9,0.35,-2); desk.rotation.y=0.1;
    var t2=addObj(new $.Mesh(new $.BoxGeometry(1,0.02,0.5),tMat));
    t2.position.set(i*0.9,0.71,-2); }
  var chMat=new $.MeshStandardMaterial({color:0x2a2a3a,roughness:0.8});
  for(var j=-2;j<=2;j+=1.5){
    var ch=addObj(new $.Mesh(new $.BoxGeometry(0.3,0.5,0.3),chMat));
    ch.position.set(j*0.9,0.25,-0.5); }
  var board=addObj(new $.Mesh(new $.BoxGeometry(3,1.5,0.05),
    new $.MeshStandardMaterial({color:0x1a2a1a,roughness:0.9})));
  board.position.set(0,1.5,-4.8);
  var lp=new $.PointLight(0x887766,0.25,5); lp.position.set(0,3.5,0); addObj(lp);
  window._echoLamp=lp;
  var wl=new $.DirectionalLight(0x445577,0.1); wl.position.set(-3,2,5); addObj(wl);
}
function buildCafeteria(){
  clearScene(); rig.position.set(0,EY,0); rig.rotation.x=-0.08;
  var fMat=new $.MeshStandardMaterial({color:0x3a3a35,roughness:0.9});
  addObj(new $.Mesh(new $.PlaneGeometry(14,10),fMat)).rotation.x=-PI2/4;
  var wMat=new $.MeshStandardMaterial({color:0x2a2a30,roughness:0.85,side:$.BackSide});
  var w=addObj(new $.Mesh(new $.BoxGeometry(14,4,0.1),wMat)); w.position.set(0,2,-5);
  var tMat=new $.MeshStandardMaterial({color:0x4a4a3a,roughness:0.7});
  for(var i=-3;i<=3;i+=2){
    var t=addObj(new $.Mesh(new $.BoxGeometry(4,0.7,0.02),tMat));
    t.position.set(0,0.35,i*1.2); }
  var cMat=new $.MeshStandardMaterial({color:0x4a3a2a,roughness:0.7});
  var cnt=addObj(new $.Mesh(new $.BoxGeometry(4,0.9,0.6),cMat)); cnt.position.set(3,0.45,-3);
  var lp=new $.PointLight(0x887766,0.15,6); lp.position.set(0,3.5,0); addObj(lp);
  window._echoLamp=lp;
}
function buildOffice(){
  clearScene(); rig.position.set(0,EY,0); rig.rotation.x=-0.07;
  var fMat=new $.MeshStandardMaterial({color:0x2a2a30,roughness:0.9});
  addObj(new $.Mesh(new $.PlaneGeometry(7,5),fMat)).rotation.x=-PI2/4;
  var wMat=new $.MeshStandardMaterial({color:0x252530,roughness:0.85,side:$.BackSide});
  var w=addObj(new $.Mesh(new $.BoxGeometry(7,4,0.1),wMat)); w.position.set(0,2,-3);
  var dMat=new $.MeshStandardMaterial({color:0x3a2a1a,roughness:0.7});
  var desk=addObj(new $.Mesh(new $.BoxGeometry(1.2,0.7,0.6),dMat));
  desk.position.set(0,0.35,-1.5);
  var chMat=new $.MeshStandardMaterial({color:0x2a2a3a,roughness:0.8});
  var ch=addObj(new $.Mesh(new $.BoxGeometry(0.35,0.45,0.35),chMat));
  ch.position.set(0.8,0.225,-1.5);
  var lp=new $.PointLight(0xaa8866,0.2,4); lp.position.set(0,1.5,-1.5); addObj(lp);
  window._echoLamp=lp;
  var wl=new $.DirectionalLight(0x445577,0.08); wl.position.set(2,2,3); addObj(wl);
}
function buildBasement(){
  clearScene(); rig.position.set(0,EY-0.2,0); rig.rotation.x=-0.05;
  var fMat=new $.MeshStandardMaterial({color:0x2a2a2a,roughness:0.95});
  addObj(new $.Mesh(new $.PlaneGeometry(10,8),fMat)).rotation.x=-PI2/4;
  var cylMat=new $.MeshStandardMaterial({color:0x3a3a3a,roughness:0.9,side:$.BackSide});
  addObj(new $.Mesh(new $.CylinderGeometry(5,5,3.5,16,1,true),cylMat)).position.set(0,1.75,0);
  var pipeMat=new $.MeshStandardMaterial({color:0x4a4a4a,roughness:0.8,metalness:0.3});
  [[-2,1.5,-3],[2,1.5,-3]].forEach(function(p){
    var pipe=addObj(new $.Mesh(new $.CylinderGeometry(0.08,0.08,3,6),pipeMat));
    pipe.position.set(p[0],p[1],p[2]); pipe.rotation.z=0.3; });
  var furnace=addObj(new $.Mesh(new $.BoxGeometry(1,1.5,1),
    new $.MeshStandardMaterial({color:0x4a3a2a,roughness:0.8})));
  furnace.position.set(-2,0.75,2);
  var lp=new $.PointLight(0x665544,0.15,4); lp.position.set(0,2.5,0); addObj(lp);
  window._echoLamp=lp;
}
function buildRoof(){
  clearScene(); rig.position.set(0,EY,0); rig.rotation.x=-0.05;
  var fMat=new $.MeshStandardMaterial({color:0x3a3a40,roughness:0.9});
  addObj(new $.Mesh(new $.PlaneGeometry(14,10),fMat)).rotation.x=-PI2/4;
  // Sky gradient via hemisphere
  scene.background=new $.Color(0x1a1a2a);
  scene.fog=new $.FogExp2(0x1a1a2a,0.02);
  var railMat=new $.MeshStandardMaterial({color:0x4a4a4a,roughness:0.8});
  for(var i=-6;i<=6;i+=1.5){
    var r=addObj(new $.Mesh(new $.BoxGeometry(0.05,0.8,0.05),railMat));
    r.position.set(i,0.4,-4.8); }
  var wl=new $.DirectionalLight(0x665544,0.15); wl.position.set(0,2,6); addObj(wl);
}

var SCENE_BUILDERS={hall:buildHall,classroom:buildClassroom,cafeteria:buildCafeteria,office:buildOffice,basement:buildBasement,roof:buildRoof};

// ===== PORTRAITS =====
function makePortrait(charId,emotion){
  var c=document.createElement('canvas');c.width=200;c.height=200;
  var cx=c.getContext('2d');var ch=CHARS[charId];if(!ch)return c;
  var em=EMOTIONS[emotion||'normal']||EMOTIONS.normal;
  var w=200,h=200,sx=100,sy=110;
  // Background circle
  cx.beginPath();cx.arc(100,100,96,0,PI2);cx.fillStyle='#1a1a2a';cx.fill();
  cx.beginPath();cx.arc(100,100,90,0,PI2);
  cx.save();cx.clip();
  // Face
  cx.beginPath();cx.ellipse(sx,sy-10,55,68,0,0,PI2);
  var grd=cx.createRadialGradient(80,80,10,100,100,70);
  grd.addColorStop(0,ch.skin);grd.addColorStop(0.7,ch.skin);grd.addColorStop(1,shadeColor(ch.skin,-20));
  cx.fillStyle=grd;cx.fill();
  // Cheek shadow
  if(em.flush>0){
    cx.beginPath();cx.ellipse(70,110,15,10,0,0,PI2);
    cx.fillStyle='rgba(200,80,80,'+(em.flush*0.3)+')';cx.fill();
    cx.beginPath();cx.ellipse(130,110,15,10,0,0,PI2);
    cx.fillStyle='rgba(200,80,80,'+(em.flush*0.3)+')';cx.fill();}
  // Eyes
  var eyeY=93,eW=14,eH=em.eye*7+4;
  [[65,eyeY],[135,eyeY]].forEach(function(p){
    // White
    cx.beginPath();cx.ellipse(p[0],p[1],eW,eH,0,0,PI2);
    cx.fillStyle='#f0f0f0';cx.fill();
    // Iris
    cx.beginPath();cx.arc(p[0],p[1],5,0,PI2);
    cx.fillStyle=ch.eyes;cx.fill();
    // Pupil
    cx.beginPath();cx.arc(p[0],p[1],2.5,0,PI2);cx.fillStyle='#111';cx.fill();
    // Highlight
    cx.beginPath();cx.arc(p[0]+2,p[1]-2,1.5,0,PI2);cx.fillStyle='rgba(255,255,255,0.7)';cx.fill();});
  // Eyebrows
  var browY=80, browAng=em.brow*0.4;
  [[52,browY,80,browY-2],[148,browY,120,browY-2]].forEach(function(p){
    cx.beginPath();cx.moveTo(p[0],p[1]);cx.lineTo(p[2],p[3]);
    cx.strokeStyle=ch.brows;cx.lineWidth=3;cx.stroke();});
  // Nose
  cx.beginPath();cx.moveTo(97,98);cx.lineTo(100,108);cx.lineTo(103,98);
  cx.strokeStyle=shadeColor(ch.skin,-30);cx.lineWidth=1.5;cx.stroke();
  // Mouth
  var mY=118;
  cx.beginPath();
  if(em.mouth===0){cx.arc(100,mY,8,0.1,Math.PI-0.1);} // neutral
  else if(em.mouth===1){cx.arc(100,mY+2,8,0.2,Math.PI-0.2);} // sad
  else if(em.mouth===2){cx.ellipse(100,mY,10,6,0,0,PI2);} // open
  else if(em.mouth===3){cx.arc(100,mY,8,0,Math.PI);} // smile
  cx.strokeStyle=ch.lips;cx.lineWidth=2;cx.fillStyle=ch.lips;
  if(em.mouth>=2)cx.fill();else cx.stroke();
  // Hair
  cx.globalAlpha=0.9;
  if(ch.hairS==='long'){
    cx.beginPath();cx.ellipse(100,10,48,30,0,Math.PI,0);
    cx.fillStyle=ch.hair;cx.fill();
    cx.beginPath();cx.ellipse(55,105,18,60,0.2,0,PI2);
    cx.fillStyle=ch.hair;cx.fill();
    cx.beginPath();cx.ellipse(145,105,18,60,-0.2,0,PI2);
    cx.fillStyle=ch.hair;cx.fill();}
  else if(ch.hairS==='short'){
    cx.beginPath();cx.ellipse(100,15,50,28,0,Math.PI,0);
    cx.fillStyle=ch.hair;cx.fill();
    cx.beginPath();cx.rect(50,15,100,12);cx.fillStyle=ch.hair;cx.fill();}
  else if(ch.hairS==='messy'){
    for(var i=0;i<15;i++){var a=Math.random()*Math.PI,r=40+Math.random()*20;
      cx.beginPath();cx.ellipse(100+Math.cos(a)*r*0.6,20+Math.sin(a)*r*0.3,6,3,0,0,PI2);
      cx.fillStyle=ch.hair;cx.fill();}}
  else if(ch.hairS==='bun'){
    cx.beginPath();cx.ellipse(100,15,50,28,0,Math.PI,0);cx.fillStyle=ch.hair;cx.fill();
    cx.beginPath();cx.arc(100,8,24,0,PI2);cx.fillStyle=ch.hair;cx.fill();}
  else if(ch.hairS==='curly'){
    for(var j=0;j<20;j++){var a2=j/20*Math.PI,r2=35+Math.sin(j*3)*10;
      cx.beginPath();cx.arc(100+Math.cos(a2)*r2*0.6,15+Math.sin(a2)*r2*0.3,6,0,PI2);
      cx.fillStyle=ch.hair;cx.fill();}}
  cx.globalAlpha=1;
  // Clothes (neck)
  cx.beginPath();cx.ellipse(100,155,45,16,0,0,PI2);
  cx.fillStyle=ch.clothes;cx.fill();
  cx.restore();
  return c;
}
function shadeColor(col,pct){
  var r=parseInt(col.slice(1,3),16),g=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
  r=Math.min(255,Math.max(0,Math.round(r*(1+pct/100))));
  g=Math.min(255,Math.max(0,Math.round(g*(1+pct/100))));
  b=Math.min(255,Math.max(0,Math.round(b*(1+pct/100))));
  return 'rgb('+r+','+g+','+b+')';
}

// ===== DIALOGUE SYSTEM =====
var dialogueQueue=[];

function showChapter(text,cb){
  var el=document.getElementById('echoes-chapter');
  el.textContent=text;el.classList.remove('hidden');
  setTimeout(function(){el.classList.add('hidden');setTimeout(cb||function(){},1200);},2000);
}

function showNode(id){
  if(!C)return;var nodes=C.nodes;var node=nodes.find(function(n){return n.id===id;});
  if(!node){return;}
  curNodeId=id;
  // Set flags
  if(node.setFlags)for(var k in node.setFlags)F[k]=node.setFlags[k];
  // Handle special actions
  if(node.action==='nextChap'){showChapter('Chapitre suivant…',function(){switchScene();});return;}
  if(node.action==='end'){showChapter('Chapitre suivant…',function(){switchScene('epilogue');});return;}
  if(node.action==='quit'){setTimeout(function(){window.closeEchoesGame();},3000);return;}
  // Show dialogue
  showDialogue(node);
}

function showDialogue(node){
  var dlg=document.getElementById('echoes-dialogue');
  var portrait=document.getElementById('echoes-portrait');
  var speaker=document.getElementById('echoes-speaker');
  var text=document.getElementById('echoes-text');
  var choices=document.getElementById('echoes-choices');
  dlg.classList.remove('hidden');
  // Portrait
  portrait.innerHTML='';
  if(node.speaker&&CHARS[node.speaker]){
    var canvas=makePortrait(node.speaker,node.emotion||'normal');
    portrait.appendChild(canvas);
    speaker.textContent=CHARS[node.speaker].name;
    // Voice
    speakText(CHARS[node.speaker].name+' dit : '+node.text);
  }else{
    speaker.textContent='';
    if(node.text)synthesizeSpeech(node.text);
  }
  // Text with typewriter
  typeText(text,node.text||'',function(){
    showChoices(node.choices);
  });
}

function typeText(el,full,cb){
  el.innerHTML='';var i=0;
  function tick(){
    if(i>=full.length){if(cb)cb();return;}
    var ch=full[i];if(ch==='\n')el.innerHTML+='<br>';
    else el.innerHTML+=ch;
    i++;setTimeout(tick,25);
  }
  tick();
}

function showChoices(list){
  var el=document.getElementById('echoes-choices');el.innerHTML='';
  if(!list||list.length===0)return;
  // Check flags for conditional choices
  list.forEach(function(ch,i){
    if(ch.flag&&!F[ch.flag])return;
    var btn=document.createElement('button');
    btn.className='echoes-choice';
    btn.textContent=(i+1)+'. '+ch.text;
    btn.setAttribute('data-gaze','');
    btn.setAttribute('data-action','echoes:choice:'+i);
    btn.onclick=function(){onChoice(ch);};
    el.appendChild(btn);
  });
}

function onChoice(ch){
  if(speechMsg&&speechSynthesis){speechSynthesis.cancel();speechMsg=null;}
  if(ch.next){showNode(ch.next);}
  else if(ch.action==='nextChap'){switchScene();}
  else if(ch.action==='end'){switchScene('epilogue');}
  else if(ch.action==='quit'){window.closeEchoesGame();}
}

// ===== VOICE SYNTHESIS =====
function speakText(txt){
  if(!window.speechSynthesis)return;
  speechSynthesis.cancel();
  // Clean text for TTS
  var clean=txt.replace(/\n/g,' ').replace(/[""]/g,'').trim();
  if(!clean)return;
  var msg=new SpeechSynthesisUtterance(clean);
  msg.lang='fr-FR';msg.rate=0.85;msg.pitch=0.95;msg.volume=0.7;
  var voices=speechSynthesis.getVoices();
  var fr=voices.find(function(v){return v.lang.startsWith('fr');});
  if(fr)msg.voice=fr;
  speechMsg=msg;speechSynthesis.speak(msg);
  msg.onend=function(){speechMsg=null;};
}
function synthesizeSpeech(txt){
  // Same as speakText but with neutral voice for narrator
  if(!window.speechSynthesis)return;
  speechSynthesis.cancel();
  var clean=txt.replace(/\n/g,' ').replace(/[""]/g,'').trim();
  if(!clean)return;
  var msg=new SpeechSynthesisUtterance(clean);
  msg.lang='fr-FR';msg.rate=0.9;msg.pitch=0.8;msg.volume=0.5;
  speechMsg=msg;speechSynthesis.speak(msg);
  msg.onend=function(){speechMsg=null;};
}

// ===== MUSIC =====
var audioCtx=null,musicNodes=null;
function startMusic(){
  if(audioCtx)return;
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  // Deep drone
  var osc1=audioCtx.createOscillator();osc1.type='sine';osc1.frequency.value=45;
  var gain1=audioCtx.createGain();gain1.gain.value=0.04;
  var filter1=audioCtx.createBiquadFilter();filter1.type='lowpass';filter1.frequency.value=120;
  osc1.connect(filter1).connect(gain1);gain1.connect(audioCtx.destination);osc1.start();
  // Pad
  var osc2=audioCtx.createOscillator();osc2.type='triangle';osc2.frequency.value=110;
  var gain2=audioCtx.createGain();gain2.gain.value=0.02;
  var lfo=audioCtx.createOscillator();lfo.type='sine';lfo.frequency.value=0.2;
  var lfoGain=audioCtx.createGain();lfoGain.gain.value=15;
  lfo.connect(lfoGain);lfoGain.connect(osc2.frequency);
  osc2.connect(gain2);gain2.connect(audioCtx.destination);
  osc2.start();lfo.start();
  // Noise wash
  var bufSize=audioCtx.sampleRate*2;var buffer=audioCtx.createBuffer(1,bufSize,audioCtx.sampleRate);
  var data=buffer.getChannelData(0);
  for(var i=0;i<bufSize;i++)data[i]=Math.random()*2-1;
  var noise=audioCtx.createBufferSource();noise.buffer=buffer;noise.loop=true;
  var filter2=audioCtx.createBiquadFilter();filter2.type='bandpass';filter2.frequency.value=200;filter2.Q.value=0.5;
  var gain3=audioCtx.createGain();gain3.gain.value=0.015;
  noise.connect(filter2).connect(gain3);gain3.connect(audioCtx.destination);noise.start();
  musicNodes={osc1:osc1,osc2:osc2,lfo:lfo,noise:noise,gain1:gain1,gain2:gain2,gain3:gain3};
}
function stopMusic(){
  if(!audioCtx||!musicNodes)return;
  try{Object.values(musicNodes).forEach(function(n){try{n.stop();}catch(e){}});}catch(e){}
  audioCtx.close();audioCtx=null;musicNodes=null;
}

// ===== SCENE SWITCH =====
var SCENE_BUILDERS={hall:buildHall,classroom:buildClassroom,cafeteria:buildCafeteria,office:buildOffice,basement:buildBasement,roof:buildRoof};
function switchScene(targetId){
  if(!C||!C.setup)return;
  hideDialogue();clearScene();
  if(targetId==='epilogue'){C=SCENES.epilogue;curScene='epilogue';
    if(C.setup&&SCENE_BUILDERS[C.setup])SCENE_BUILDERS[C.setup]();
    showChapter(C.chapter,function(){showNode('start');});return;}
  var keys=Object.keys(SCENES);
  var curIdx=keys.indexOf(curScene);
  if(C.action==='end'){var next='epilogue';C=SCENES[next];curScene=next;
    if(C.setup&&SCENE_BUILDERS[C.setup])SCENE_BUILDERS[C.setup]();
    showChapter(C.chapter,function(){showNode('start');});return;}
  var nextIdx=Math.min(curIdx+1,keys.length-1);
  if(nextIdx!==curIdx){C=SCENES[keys[nextIdx]];curScene=keys[nextIdx];
    if(C.setup&&SCENE_BUILDERS[C.setup])SCENE_BUILDERS[C.setup]();
    showChapter(C.chapter,function(){showNode('start');});}
}
function hideDialogue(){
  document.getElementById('echoes-dialogue').classList.add('hidden');
}

// ===== INTERACTION =====
var hand={x:0,y:0,poke:false,wPoke:false};
function updateHand(){
  var api=window.__handTrackAPI;
  if(!api||!api.isActive||!api.screen){hand.poke=false;return;}
  hand.x=api.screen.pageX;hand.y=api.screen.pageY;
  hand.poke=!!api.pinching;
  // Hover dialogue choices
  var choices=document.querySelectorAll('.echoes-choice');
  choices.forEach(function(btn){
    var rect=btn.getBoundingClientRect();
    var hover=hand.x>=rect.left&&hand.x<=rect.right&&hand.y>=rect.top&&hand.y<=rect.bottom;
    btn.setAttribute('data-gaze-active',hover?'true':'false');
    if(hover&&hand.poke&&!hand.wPoke)btn.click();
  });
  hand.wPoke=hand.poke;
}

// ===== DRAG =====
var drag={on:false,sx:0},camYaw=0;
function setupDrag(){
  var wrap=document.getElementById('echoes-sceneWrap');
  if(!wrap)return;
  wrap.addEventListener('mousedown',function(e){if(!e.isTrusted)return;drag.on=true;drag.sx=e.clientX;wrap.style.cursor='grabbing';});
  window.addEventListener('mousemove',function(e){if(!drag.on)return;
    var dx=e.clientX-drag.sx;camYaw+=dx*0.004;drag.sx=e.clientX;});
  window.addEventListener('mouseup',function(){drag.on=false;
    var w=document.getElementById('echoes-sceneWrap');if(w)w.style.cursor='grab';});
  wrap.addEventListener('touchstart',function(e){if(e.touches.length===1){drag.on=true;drag.sx=e.touches[0].clientX;}},{passive:true});
  window.addEventListener('touchmove',function(e){if(drag.on&&e.touches.length===1){
    var dx=e.touches[0].clientX-drag.sx;camYaw+=dx*0.004;drag.sx=e.touches[0].clientX;}},{passive:true});
  window.addEventListener('touchend',function(){drag.on=false;});
}

// ===== MAIN LOOP =====
function startLoop(){if(loopRunning)return;loopRunning=true;setupDrag();resize();startMusic();loop(0);}
function loop(ts){
  if(!loopRunning)return;requestAnimationFrame(loop);
  var dt=Math.min((ts-lastTs)/1000,0.05);lastTs=ts;
  // Auto-rotate slightly if no drag
  if(!drag.on)camYaw+=dt*0.03;
  rig.rotation.y=camYaw;
  // Flicker lamp
  if(window._echoLamp)window._echoLamp.intensity=0.15+Math.sin(ts*0.003)*0.05+Math.sin(ts*0.007)*0.03;
  // Hand
  updateHand();
  // Render
  if(renL&&renR&&scene){renL.render(scene,camL);renR.render(scene,camR);}
}

// ===== PUBLIC API =====
window.initEchoesGame=init;
window.destroyEchoesGame=function(){loopRunning=false;stopMusic();speechSynthesis&&speechSynthesis.cancel();destroy();};
})();
