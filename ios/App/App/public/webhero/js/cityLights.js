// cityLights.js
// Tout ce qui donne de la vie et de la visibilité à la ville la nuit :
// - Enseignes/panneaux publicitaires animés (shader néon) collés sur les
//   façades des tours, chacun avec une vraie petite lumière colorée.
// - Lampadaires le long des rues : tête émissive (glow visible partout via
//   le bloom) + un "pool" limité de vraies THREE.PointLight recyclées et
//   repositionnées sur les lampadaires les plus proches du joueur, pour
//   éclairer vraiment le sol sans exploser les performances.
// - Balises rouges clignotantes au sommet des tours les plus hautes.
//
// Tout est piloté depuis dayNight.js via update(nightFactor, elapsed, cameraPosition).

import * as THREE from 'three';
import { CONFIG } from './config.js';

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// --- Texture néon animée pour les panneaux publicitaires ---
// On dessine des bandes/blocs colorés façon jumbotron ; le décalage de motif
// (offset UV) est ensuite animé dans update() pour un effet de défilement.
function createBillboardTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const color = new THREE.Color(colorHex);
  const cssColor = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;

  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = cssColor;
  const blocks = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < blocks; i++) {
    const w = randRange(10, 30);
    const h = randRange(6, 22);
    const x = Math.random() * (canvas.width - w);
    const y = Math.random() * (canvas.height - h);
    ctx.globalAlpha = 0.6 + Math.random() * 0.4;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  // Bordure lumineuse pour bien lire le panneau au loin
  ctx.strokeStyle = cssColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createBillboard(building, footprintX, footprintZ, height) {
  const colorHex =
    CONFIG.BILLBOARD_COLORS[Math.floor(Math.random() * CONFIG.BILLBOARD_COLORS.length)];
  const texture = createBillboardTexture(colorHex);

  const w = randRange(6, Math.max(6, Math.min(footprintX, footprintZ) * 0.8));
  const h = w * randRange(0.35, 0.55);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: new THREE.Color(colorHex),
    emissiveMap: texture,
    emissiveIntensity: CONFIG.BILLBOARD_EMISSIVE_MIN,
    roughness: 0.4,
    metalness: 0.1,
  });

  const geometry = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geometry, material);

  // Colle le panneau sur une des 4 façades, à une hauteur aléatoire.
  // Les immeubles sont des Mesh centrés sur leur propre origine (y=0 locale
  // = mi-hauteur du bâtiment), donc on reste dans [-h/2, h/2].
  const side = Math.floor(Math.random() * 4);
  const y = randRange(-height * 0.3, height * 0.42);
  const halfX = footprintX / 2 + 0.06;
  const halfZ = footprintZ / 2 + 0.06;
  if (side === 0) {
    mesh.position.set(0, y, halfZ);
  } else if (side === 1) {
    mesh.position.set(0, y, -halfZ);
    mesh.rotation.y = Math.PI;
  } else if (side === 2) {
    mesh.position.set(halfX, y, 0);
    mesh.rotation.y = Math.PI / 2;
  } else {
    mesh.position.set(-halfX, y, 0);
    mesh.rotation.y = -Math.PI / 2;
  }
  building.add(mesh);

  // Petite vraie lumière colorée qui éclaire un peu la façade et la rue,
  // légèrement décalée devant le panneau (le long de sa normale locale).
  const light = new THREE.PointLight(colorHex, 0, CONFIG.BILLBOARD_LIGHT_RANGE, 2);
  const normalLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
  light.position.copy(mesh.position).addScaledVector(normalLocal, 2.5);
  building.add(light);

  return {
    material,
    light,
    flickerPhase: Math.random() * Math.PI * 2,
    flickerSpeed: randRange(0.6, 2.2),
    texture,
    scrollSpeed: randRange(-0.15, 0.15),
  };
}

function createRooftopBeacon(building, height) {
  const geometry = new THREE.SphereGeometry(0.6, 8, 8);
  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.ROOFTOP_BEACON_COLOR,
    emissive: CONFIG.ROOFTOP_BEACON_COLOR,
    emissiveIntensity: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, height / 2 + 0.6, 0);
  building.add(mesh);
  return { material, phase: Math.random() * Math.PI * 2 };
}

// Place des lampadaires le long des rues (grille). Pour rester performant
// même avec plusieurs centaines de lampadaires, poteaux et têtes sont
// rendus via InstancedMesh (2 draw calls au total au lieu d'un par lampadaire) ;
// seule une poignée de vraies lumières (pool) est recyclée près du joueur.
export function createStreetLamps(scene, streetCentersX, streetCentersZ, totalWidth, totalDepth) {
  const spacing = CONFIG.STREETLAMP_SPACING;
  const offset = CONFIG.STREET_WIDTH / 2 + 1.2;
  const positions = [];

  streetCentersZ.forEach((z) => {
    for (let x = -totalWidth / 2; x < totalWidth / 2; x += spacing) {
      positions.push({ x, z: z + offset });
    }
  });
  streetCentersX.forEach((x) => {
    for (let z = -totalDepth / 2; z < totalDepth / 2; z += spacing) {
      positions.push({ x: x + offset, z });
    }
  });

  const count = positions.length;
  const h = CONFIG.STREETLAMP_HEIGHT;

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6, metalness: 0.5 });
  const poleMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.09, 0.12, h, 8),
    poleMat,
    count
  );

  const headMat = new THREE.MeshStandardMaterial({
    color: CONFIG.STREETLAMP_COLOR,
    emissive: CONFIG.STREETLAMP_COLOR,
    emissiveIntensity: 0,
  });
  const headMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    headMat,
    count
  );

  const dummy = new THREE.Object3D();
  positions.forEach((p, i) => {
    dummy.position.set(p.x, h / 2, p.z);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x, h + 0.15, p.z);
    dummy.updateMatrix();
    headMesh.setMatrixAt(i, dummy.matrix);
  });
  poleMesh.instanceMatrix.needsUpdate = true;
  headMesh.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(poleMesh, headMesh);
  scene.add(group);

  // Pool limité de vraies lumières, recyclées sur les lampadaires les plus
  // proches de la caméra à chaque frame (coût constant, quelle que soit la
  // taille de la ville).
  const pool = [];
  for (let i = 0; i < CONFIG.STREETLAMP_LIGHT_POOL_SIZE; i++) {
    const light = new THREE.PointLight(
      CONFIG.STREETLAMP_COLOR,
      0,
      CONFIG.STREETLAMP_LIGHT_RANGE,
      2
    );
    scene.add(light);
    pool.push(light);
  }

  let frameCounter = 0;

  function updatePool(cameraPosition, nightFactor) {
    if (nightFactor <= 0.01) {
      for (const light of pool) light.intensity = 0;
      return;
    }
    // Recalcul des lampadaires les plus proches seulement 1 frame sur 6 (perf) :
    // les lumières restent stables visuellement, pas de "saut" perceptible.
    frameCounter++;
    if (frameCounter % 6 !== 0) return;

    const sorted = positions
      .map((p) => ({
        p,
        distSq: (p.x - cameraPosition.x) ** 2 + (p.z - cameraPosition.z) ** 2,
      }))
      .sort((a, b) => a.distSq - b.distSq)
      .slice(0, pool.length);

    for (let i = 0; i < pool.length; i++) {
      const light = pool[i];
      const entry = sorted[i];
      if (!entry) {
        light.intensity = 0;
        continue;
      }
      light.position.set(entry.p.x, h + 0.15, entry.p.z);
      light.intensity = CONFIG.STREETLAMP_LIGHT_INTENSITY * nightFactor;
    }
  }

  function setGlow(nightFactor) {
    headMat.emissiveIntensity = CONFIG.STREETLAMP_EMISSIVE_MAX * nightFactor;
  }

  return { group, positions, updatePool, setGlow };
}

// Ajoute des panneaux publicitaires sur des immeubles assez hauts, et une
// balise clignotante sur les tours les plus hautes.
export function decorateBuildingsWithLights(buildingMeshes, buildingFootprints) {
  const billboards = [];
  const beacons = [];

  const tallEnough = buildingMeshes
    .map((mesh, i) => ({ mesh, footprint: buildingFootprints[i] }))
    .filter((b) => b.footprint.height >= CONFIG.BILLBOARD_MIN_HEIGHT);

  const count = Math.min(CONFIG.BILLBOARD_COUNT, tallEnough.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * tallEnough.length);
    const { mesh, footprint } = tallEnough.splice(idx, 1)[0];
    billboards.push(createBillboard(mesh, footprint.x, footprint.z, footprint.height));
  }

  buildingMeshes.forEach((mesh, i) => {
    const footprint = buildingFootprints[i];
    if (footprint.height >= CONFIG.ROOFTOP_BEACON_MIN_HEIGHT) {
      beacons.push(createRooftopBeacon(mesh, footprint.height));
    }
  });

  return { billboards, beacons };
}

// Appelé chaque frame depuis dayNight.js avec le facteur de nuit (0 = jour, 1 = nuit)
export function updateCityLights(cityLights, nightFactor, elapsed) {
  const { billboards, beacons, streetLamps } = cityLights;

  for (const b of billboards) {
    const flicker = 0.92 + 0.08 * Math.sin(elapsed * b.flickerSpeed + b.flickerPhase);
    const base = THREE.MathUtils.lerp(
      CONFIG.BILLBOARD_EMISSIVE_MIN,
      CONFIG.BILLBOARD_EMISSIVE_MAX,
      nightFactor
    );
    b.material.emissiveIntensity = base * flicker;
    b.light.intensity = CONFIG.BILLBOARD_LIGHT_INTENSITY * nightFactor * flicker;
    b.texture.offset.x = (elapsed * b.scrollSpeed) % 1;
  }

  for (const beacon of beacons) {
    const pulse = Math.max(0, Math.sin(elapsed * CONFIG.ROOFTOP_BEACON_BLINK_SPEED));
    beacon.material.emissiveIntensity = nightFactor * pulse * 3.5;
  }

  if (streetLamps) {
    streetLamps.setGlow(nightFactor);
  }
}
