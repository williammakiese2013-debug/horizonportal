import { getScene, getCamera } from './renderer.js';

let sunLight, ambientLight, hemiLight;
let skyMesh, sunMesh, stars;
let time = 0.4;

// Vecteurs réutilisés pour éviter les GC
let _skyPos = new THREE.Vector3();
let _sunDir = new THREE.Vector3();

export function initSky() {
  const scene = getScene();
  if (!scene) return;
  const T = THREE;

  ambientLight = new T.AmbientLight(0x8899bb, 0.3);
  scene.add(ambientLight);

  hemiLight = new T.HemisphereLight(0x87ceeb, 0x444422, 0.4);
  scene.add(hemiLight);

  sunLight = new T.DirectionalLight(0xffeedd, 1.0);
  sunLight.position.set(30, 40, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  const d = 50;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 100;
  scene.add(sunLight);

  // Sky dome
  const skyGeo = new T.SphereGeometry(180, 32, 24);
  const skyMat = new T.ShaderMaterial({
    uniforms: {
      topColor: { value: new T.Color(0x000033) },
      midColor: { value: new T.Color(0x224466) },
      botColor: { value: new T.Color(0x7799bb) },
      sunDir: { value: new T.Vector3(0, 1, 0) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;
      uniform vec3 sunDir;
      varying vec3 vWorldPos;
      void main(){
        float h = normalize(vWorldPos).y * 0.5 + 0.5;
        vec3 col;
        if(h < 0.5) col = mix(botColor, midColor, h * 2.0);
        else col = mix(midColor, topColor, (h - 0.5) * 2.0);
        float sd = max(0.0, dot(normalize(vWorldPos), sunDir));
        float glow = pow(sd, 12.0) * 0.8;
        col += vec3(glow * 0.9, glow * 0.7, glow * 0.4);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: T.BackSide,
  });
  skyMesh = new T.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  // Sun
  const sunMat = new T.MeshBasicMaterial({ color: 0xffee88 });
  sunMesh = new T.Mesh(new T.SphereGeometry(2, 12, 12), sunMat);
  scene.add(sunMesh);

  // Stars
  const starCount = 800;
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 170;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)); // only upper hemisphere
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starSizes[i] = 0.5 + Math.random() * 1.5;
  }
  const starGeo = new T.BufferGeometry();
  starGeo.setAttribute('position', new T.Float32BufferAttribute(starPos, 3));
  starGeo.setAttribute('size', new T.Float32BufferAttribute(starSizes, 1));
  const starMat = new T.PointsMaterial({
    color: 0xffffff, size: 0.5, transparent: true, opacity: 0,
    sizeAttenuation: true, blending: T.AdditiveBlending,
  });
  stars = new T.Points(starGeo, starMat);
  scene.add(stars);
}

export function updateSky(dt) {
  const T = THREE;
  const scene = getScene();
  if (!scene) return;

  time = window.TX ? window.TX.time : time;

  const angle = time * Math.PI * 2;
  const sunY = Math.sin(angle);
  const isDay = sunY > -0.1;

  // Colors
  let topR, topG, topB, midR, midG, midB, botR, botG, botB;
  if (isDay) {
    const t = Math.max(0, Math.min(1, (sunY + 0.1) / 1.1));
    topR = 30 + t * 30; topG = 40 + t * 110; topB = 120 + t * 115;
    midR = 60 + t * 70; midG = 100 + t * 90; midB = 160 + t * 75;
    botR = 100 + t * 100; botG = 140 + t * 85; botB = 180 + t * 65;
  } else {
    topR = 5; topG = 5; topB = 20;
    midR = 15; midG = 15; midB = 50;
    botR = 25; botG = 22; botB = 55;
  }

  // Sky uniforms
  if (skyMesh && skyMesh.material.uniforms) {
    const u = skyMesh.material.uniforms;
    u.topColor.value.setRGB(topR / 255, topG / 255, topB / 255);
    u.midColor.value.setRGB(midR / 255, midG / 255, midB / 255);
    u.botColor.value.setRGB(botR / 255, botG / 255, botB / 255);
    _sunDir.set(Math.cos(angle) * 0.7, sunY, Math.sin(angle) * 0.3).normalize();
    u.sunDir.value.copy(_sunDir);
  }

  const cam = getCamera();
  if (cam && skyMesh) {
    _skyPos.copy(cam.position);
    _skyPos.y -= 2;
    skyMesh.position.copy(_skyPos);
  }

  if (sunMesh) {
    const sr = 45;
    sunMesh.position.set(Math.cos(angle) * sr, Math.max(-5, sunY * sr * 0.8 + 5), Math.sin(angle) * sr * 0.5);
    sunMesh.visible = isDay;
  }

  // Stars
  if (stars) {
    const starA = isDay ? 0 : Math.min(1, (0.1 - sunY) / 0.3);
    stars.material.opacity += (starA * 0.8 - stars.material.opacity) * dt * 2;
    stars.position.copy(cam.position);
  }

  // Lighting
  if (sunLight) {
    const sunIntensity = Math.max(0, sunY * 0.8 + 0.2);
    sunLight.intensity = sunIntensity * 1.2;
    sunLight.position.set(Math.cos(angle) * 30, Math.max(2, sunY * 30), Math.sin(angle) * 15);
    sunLight.color.setHSL(0.08, 0.2, Math.max(0.3, 0.5 + sunY * 0.5));
  }
  if (ambientLight) {
    ambientLight.intensity = 0.1 + Math.max(0, sunY) * 0.4;
    ambientLight.color.setHSL(0.6, 0.1, Math.max(0.1, 0.2 + sunY * 0.3));
  }
  if (hemiLight) {
    hemiLight.intensity = 0.15 + Math.max(0, sunY) * 0.4;
  }

  // Fog color
  if (scene.fog) {
    scene.fog.color.setRGB(midR / 255 * 0.5, midG / 255 * 0.5, midB / 255 * 0.5);
  }

  scene.background = new T.Color(`rgb(${midR | 0},${midG | 0},${midB | 0})`);
}
