// dayNight.js
// Cycle jour/nuit complet : fait tourner un "soleil/lune" dans le ciel,
// et interpole progressivement le ciel, le brouillard, et les lumières
// entre plusieurs étapes clés (nuit, aube, jour, coucher de soleil, crépuscule).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { updateCityLights } from './cityLights.js';

// Chaque étape définit l'ambiance à un instant t du cycle (0 = minuit, 1 = minuit suivant).
// "sky" = couleur près de l'horizon, "zenith" = couleur tout en haut du ciel.
const KEYFRAMES = [
  { t: 0.00, sky: 0x0b0e14, zenith: 0x03040a, fog: 0x0b0e14, sun: 0x6a7cff, sunI: 0.18, amb: 0x2a2f45, ambI: 0.5, hemiSky: 0x1a1f2e, hemiGround: 0x05060a, hemiI: 0.42 },
  { t: 0.22, sky: 0x2b2540, zenith: 0x141225, fog: 0x2b2540, sun: 0xff8a5c, sunI: 0.55, amb: 0x55405a, ambI: 0.42, hemiSky: 0x4a3550, hemiGround: 0x201018, hemiI: 0.4 },
  { t: 0.30, sky: 0xffb37a, zenith: 0x4a6fae, fog: 0xffc79a, sun: 0xffc97a, sunI: 1.2, amb: 0x8a6a5a, ambI: 0.55, hemiSky: 0xffc79a, hemiGround: 0x402015, hemiI: 0.55 },
  { t: 0.50, sky: 0x79b8ff, zenith: 0x1f5fce, fog: 0xbcd8ff, sun: 0xfff3d6, sunI: 1.6, amb: 0x8892a6, ambI: 0.6, hemiSky: 0xbcd9ff, hemiGround: 0x3a3a3a, hemiI: 0.7 },
  { t: 0.68, sky: 0xffab73, zenith: 0x2a3a6a, fog: 0xffb98a, sun: 0xff8a4d, sunI: 1.1, amb: 0x8a5a4a, ambI: 0.55, hemiSky: 0xff9a5c, hemiGround: 0x2a1508, hemiI: 0.55 },
  { t: 0.76, sky: 0x6a3f5a, zenith: 0x120a22, fog: 0x6a3f5a, sun: 0x9a6aff, sunI: 0.45, amb: 0x4a3a5a, ambI: 0.42, hemiSky: 0x4a3560, hemiGround: 0x150a20, hemiI: 0.38 },
  { t: 1.00, sky: 0x0b0e14, zenith: 0x03040a, fog: 0x0b0e14, sun: 0x6a7cff, sunI: 0.18, amb: 0x2a2f45, ambI: 0.5, hemiSky: 0x1a1f2e, hemiGround: 0x05060a, hemiI: 0.42 },
];

function findSurroundingKeyframes(t) {
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (t >= KEYFRAMES[i].t && t <= KEYFRAMES[i + 1].t) {
      return [KEYFRAMES[i], KEYFRAMES[i + 1]];
    }
  }
  return [KEYFRAMES[0], KEYFRAMES[1]];
}

function createSunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

// Dôme du ciel : grosse sphère vue de l'intérieur, dégradé horizon -> zénith
// + halo lumineux autour du soleil/de la lune, calculé directement dans le shader.
function createSkyDome() {
  const geometry = new THREE.SphereGeometry(2400, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      horizonColor: { value: new THREE.Color(0x0b0e14) },
      zenithColor: { value: new THREE.Color(0x03040a) },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 horizonColor;
      uniform vec3 zenithColor;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize(vWorldPosition);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(horizonColor, zenithColor, pow(h, 0.55));

        float sunAmount = max(dot(dir, normalize(sunDirection)), 0.0);
        col += sunColor * pow(sunAmount, 12.0) * 0.8;
        col += sunColor * pow(sunAmount, 3.0) * 0.15;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

// Étoiles : nuage de points sur une grande sphère, visibles seulement la nuit.
function createStars() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const radius = 2300;
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = Math.abs(radius * Math.cos(phi)); // toutes au-dessus de l'horizon
    const z = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

// Nuages : quelques sprites texturés (blob doux) qui dérivent lentement dans le ciel.
function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const blobs = 6;
  for (let i = 0; i < blobs; i++) {
    const cx = 40 + Math.random() * (canvas.width - 80);
    const cy = 50 + Math.random() * 30;
    const r = 30 + Math.random() * 40;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function createClouds() {
  const texture = createCloudTexture();
  const group = new THREE.Group();
  const clouds = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.85,
    });
    const sprite = new THREE.Sprite(material);
    const scale = THREE.MathUtils.randFloat(220, 420);
    sprite.scale.set(scale, scale * 0.5, 1);
    const angle = Math.random() * Math.PI * 2;
    const dist = THREE.MathUtils.randFloat(600, 1600);
    sprite.position.set(
      Math.cos(angle) * dist,
      THREE.MathUtils.randFloat(260, 420),
      Math.sin(angle) * dist
    );
    sprite.userData.driftSpeed = THREE.MathUtils.randFloat(1.5, 4);
    group.add(sprite);
    clouds.push(sprite);
  }
  return { group, clouds };
}

export function createDayNightCycle(scene, lights, cityLights) {
  const { ambient, sun, hemi } = lights;
  let t = CONFIG.DAY_START_T;
  let elapsed = 0;
  let currentNightFactor = 0;

  // Petit disque lumineux dans le ciel pour matérialiser le soleil/la lune
  const sunMaterial = new THREE.SpriteMaterial({
    map: createSunTexture(),
    transparent: true,
    depthWrite: false,
    fog: false, // reste bien visible même loin dans le brouillard
  });
  const sunSprite = new THREE.Sprite(sunMaterial);
  sunSprite.scale.set(160, 160, 1);
  scene.add(sunSprite);

  const skyDome = createSkyDome();
  scene.add(skyDome);

  const stars = createStars();
  scene.add(stars);

  const { group: cloudGroup, clouds } = createClouds();
  scene.add(cloudGroup);

  const colorA = new THREE.Color();
  const colorB = new THREE.Color();

  function apply() {
    const [a, b] = findSurroundingKeyframes(t);
    const span = b.t - a.t || 1;
    const localT = (t - a.t) / span;

    colorA.set(a.sky);
    colorB.set(b.sky);
    scene.background.lerpColors(colorA, colorB, localT);

    colorA.set(a.fog);
    colorB.set(b.fog);
    scene.fog.color.lerpColors(colorA, colorB, localT);

    colorA.set(a.sun);
    colorB.set(b.sun);
    sun.color.lerpColors(colorA, colorB, localT);
    sun.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, localT);

    colorA.set(a.amb);
    colorB.set(b.amb);
    ambient.color.lerpColors(colorA, colorB, localT);
    ambient.intensity = THREE.MathUtils.lerp(a.ambI, b.ambI, localT);

    colorA.set(a.hemiSky);
    colorB.set(b.hemiSky);
    hemi.color.lerpColors(colorA, colorB, localT);

    colorA.set(a.hemiGround);
    colorB.set(b.hemiGround);
    hemi.groundColor.lerpColors(colorA, colorB, localT);
    hemi.intensity = THREE.MathUtils.lerp(a.hemiI, b.hemiI, localT);

    // Trajectoire en arc du soleil/lune au-dessus de la ville
    const angle = (t - 0.25) * Math.PI * 2;
    const radius = CONFIG.SUN_ORBIT_RADIUS;
    const height = Math.sin(angle) * radius;
    const horiz = Math.cos(angle) * radius;
    sun.position.set(horiz, height, -radius * 0.35);

    sunSprite.position.copy(sun.position);
    sunSprite.material.color.copy(sun.color);
    // Le disque s'estompe un peu sous l'horizon plutôt que de disparaître brutalement
    sunSprite.material.opacity = THREE.MathUtils.clamp(height / radius + 0.35, 0.1, 1);

    // Dôme du ciel : dégradé horizon/zénith + halo autour du soleil/lune
    skyDome.material.uniforms.horizonColor.value.copy(scene.background);
    colorA.set(a.zenith);
    colorB.set(b.zenith);
    skyDome.material.uniforms.zenithColor.value.lerpColors(colorA, colorB, localT);
    skyDome.material.uniforms.sunDirection.value.copy(sun.position).normalize();
    skyDome.material.uniforms.sunColor.value.copy(sun.color);

    // Étoiles : n'apparaissent que la nuit, quand le soleil est bas/sous l'horizon
    const nightFactor = THREE.MathUtils.clamp(-height / radius * 3, 0, 1);
    stars.material.opacity = nightFactor * 0.9;
    currentNightFactor = nightFactor;

    // Nuages : teintés par la lumière ambiante du ciel (chauds au coucher, gris la nuit)
    for (const cloud of clouds) {
      cloud.material.color.copy(hemi.color).multiplyScalar(1.7);
      cloud.material.opacity = 0.55 + 0.3 * (1 - nightFactor);
    }

    // Fenêtres des immeubles : passent en émissif quand la nuit tombe, pour
    // qu'on distingue vraiment les tours dans le noir (+ effet de bloom).
    if (cityLights && cityLights.windowMaterials) {
      const windowIntensity = nightFactor * CONFIG.WINDOW_EMISSIVE_MAX;
      for (const mat of cityLights.windowMaterials) {
        mat.emissiveIntensity = windowIntensity;
      }
    }

    // Enseignes néon, balises de toit, glow des lampadaires
    if (cityLights) {
      updateCityLights(cityLights, nightFactor, elapsed);
    }
  }

  apply();

  function update(delta, cameraPosition) {
    elapsed += delta;
    t += delta / CONFIG.DAY_CYCLE_SECONDS;
    if (t > 1) t -= 1;
    apply();

    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.driftSpeed * delta;
      cloud.position.z += cloud.userData.driftSpeed * 0.3 * delta;
      const limit = 1700;
      if (cloud.position.x > limit) cloud.position.x = -limit;
      if (cloud.position.z > limit) cloud.position.z = -limit;
    }

    // Pool de vraies lumières des lampadaires : recentré sur les lampadaires
    // les plus proches du joueur pour éclairer le sol sans en allumer des
    // centaines en même temps.
    if (cityLights && cityLights.streetLamps && cameraPosition) {
      cityLights.streetLamps.updatePool(cameraPosition, currentNightFactor);
    }
  }

  return { update, getNightFactor: () => currentNightFactor };
}
