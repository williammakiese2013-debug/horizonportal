// city.js
// Étape 1/N : génération procédurale de la ville façon Manhattan.
// On construit une grille de blocs séparés par des rues, et sur chaque
// bloc on place 1 à 3 immeubles de hauteurs/couleurs variées avec des
// fenêtres allumées pour donner un aspect "nuit new-yorkaise" réaliste.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createStreetLamps, decorateBuildingsWithLights } from './cityLights.js';

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function createWindowTexture() {
  // Texture procédurale simple simulant une grille de fenêtres allumées/éteintes
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cols = 6;
  const rows = 14;
  const padX = 4;
  const padY = 4;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.55;
      ctx.fillStyle = lit ? '#ffe08a' : '#12141a';
      ctx.fillRect(
        c * cellW + padX / 2,
        r * cellH + padY / 2,
        cellW - padX,
        cellH - padY
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createBuilding(footprintX, footprintZ, height, colorHex, windowTexture) {
  const geometry = new THREE.BoxGeometry(footprintX, height, footprintZ);
  // Les fenêtres utilisent la même texture en carte émissive : de jour elle
  // ne fait qu'assombrir légèrement la couleur de base, mais la nuit
  // (emissiveIntensity monté par dayNight.js) les carrés "allumés" de la
  // texture se mettent à briller réellement et déclenchent le bloom.
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: colorHex,
    map: windowTexture,
    emissiveMap: windowTexture,
    emissive: new THREE.Color(CONFIG.WINDOW_EMISSIVE_COLOR),
    emissiveIntensity: 0,
    roughness: 0.7,
    metalness: 0.3,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 1,
  });

  // Ordre des faces BoxGeometry: +x,-x,+y,-y,+z,-z
  const materials = [
    sideMaterial,
    sideMaterial,
    capMaterial,
    capMaterial,
    sideMaterial,
    sideMaterial,
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = height / 2;

  // Ajuste la répétition de texture selon la taille pour éviter l'étirement
  const repeatX = Math.max(1, Math.round(footprintX / 8));
  const repeatY = Math.max(1, Math.round(height / 12));
  windowTexture.repeat.set(repeatX, repeatY);

  return { mesh, sideMaterial };
}

function createStreetMarkings(blockX, blockZ, roadWidth) {
  // Simple ligne de marquage au sol au centre des rues (aspect réaliste)
  const group = new THREE.Group();
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });

  const lineGeo = new THREE.PlaneGeometry(2, 6);
  for (let i = -blockX / 2; i < blockX / 2; i += 12) {
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(i, 0.02, 0);
    group.add(line);
  }
  return group;
}

function createRoadPlane(totalWidth, totalDepth) {
  const geometry = new THREE.PlaneGeometry(
    totalWidth + CONFIG.STREET_WIDTH,
    totalDepth + CONFIG.STREET_WIDTH
  );
  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.ROAD_COLOR,
    roughness: 0.9,
  });
  const road = new THREE.Mesh(geometry, material);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  return road;
}

function createSidewalkFrame(blockCenterX, blockCenterZ) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.SIDEWALK_COLOR,
    roughness: 1,
  });

  const outer = CONFIG.BLOCK_SIZE + CONFIG.SIDEWALK_WIDTH * 2;
  const h = CONFIG.SIDEWALK_HEIGHT;

  const nsGeo = new THREE.BoxGeometry(outer, h, CONFIG.SIDEWALK_WIDTH);
  const north = new THREE.Mesh(nsGeo, material);
  north.position.set(
    blockCenterX,
    h / 2,
    blockCenterZ - CONFIG.BLOCK_SIZE / 2 - CONFIG.SIDEWALK_WIDTH / 2
  );
  const south = new THREE.Mesh(nsGeo, material);
  south.position.set(
    blockCenterX,
    h / 2,
    blockCenterZ + CONFIG.BLOCK_SIZE / 2 + CONFIG.SIDEWALK_WIDTH / 2
  );

  const ewGeo = new THREE.BoxGeometry(CONFIG.SIDEWALK_WIDTH, h, CONFIG.BLOCK_SIZE);
  const east = new THREE.Mesh(ewGeo, material);
  east.position.set(
    blockCenterX + CONFIG.BLOCK_SIZE / 2 + CONFIG.SIDEWALK_WIDTH / 2,
    h / 2,
    blockCenterZ
  );
  const west = new THREE.Mesh(ewGeo, material);
  west.position.set(
    blockCenterX - CONFIG.BLOCK_SIZE / 2 - CONFIG.SIDEWALK_WIDTH / 2,
    h / 2,
    blockCenterZ
  );

  [north, south, east, west].forEach((m) => {
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  });

  return group;
}

function createLaneMarkings(streetCentersX, streetCentersZ, totalWidth, totalDepth) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: CONFIG.LANE_MARK_COLOR });
  const dashLength = 4;
  const gap = 4;

  streetCentersZ.forEach((z) => {
    for (let x = -totalWidth / 2; x < totalWidth / 2; x += dashLength + gap) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(dashLength, 0.6), material);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x + dashLength / 2, 0.02, z);
      group.add(dash);
    }
  });

  streetCentersX.forEach((x) => {
    for (let z = -totalDepth / 2; z < totalDepth / 2; z += dashLength + gap) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, dashLength), material);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.02, z + dashLength / 2);
      group.add(dash);
    }
  });

  return group;
}

export function generateCity(scene) {
  const cityGroup = new THREE.Group();
  const windowTexture = createWindowTexture();

  const blockPitch = CONFIG.BLOCK_SIZE + CONFIG.STREET_WIDTH;
  const totalWidth = CONFIG.CITY_BLOCKS_X * blockPitch;
  const totalDepth = CONFIG.CITY_BLOCKS_Z * blockPitch;

  const startX = -totalWidth / 2;
  const startZ = -totalDepth / 2;

  cityGroup.add(createRoadPlane(totalWidth, totalDepth));

  const streetCentersX = [];
  const streetCentersZ = [];
  for (let bx = 0; bx <= CONFIG.CITY_BLOCKS_X; bx++) {
    streetCentersX.push(startX + bx * blockPitch - CONFIG.STREET_WIDTH / 2);
  }
  for (let bz = 0; bz <= CONFIG.CITY_BLOCKS_Z; bz++) {
    streetCentersZ.push(startZ + bz * blockPitch - CONFIG.STREET_WIDTH / 2);
  }
  cityGroup.add(createLaneMarkings(streetCentersX, streetCentersZ, totalWidth, totalDepth));

  const buildingBoxes = [];
  const buildingMeshes = [];
  const buildingFootprints = [];
  const windowMaterials = [];

  for (let bx = 0; bx < CONFIG.CITY_BLOCKS_X; bx++) {
    for (let bz = 0; bz < CONFIG.CITY_BLOCKS_Z; bz++) {
      const blockCenterX = startX + bx * blockPitch + CONFIG.BLOCK_SIZE / 2;
      const blockCenterZ = startZ + bz * blockPitch + CONFIG.BLOCK_SIZE / 2;

      cityGroup.add(createSidewalkFrame(blockCenterX, blockCenterZ));

      const buildingsCount = randInt(
        CONFIG.BUILDINGS_PER_BLOCK_MIN,
        CONFIG.BUILDINGS_PER_BLOCK_MAX
      );

      for (let i = 0; i < buildingsCount; i++) {
        const footprintX = randRange(
          CONFIG.BUILDING_MIN_FOOTPRINT,
          CONFIG.BUILDING_MAX_FOOTPRINT
        );
        const footprintZ = randRange(
          CONFIG.BUILDING_MIN_FOOTPRINT,
          CONFIG.BUILDING_MAX_FOOTPRINT
        );
        const height = randRange(
          CONFIG.BUILDING_MIN_HEIGHT,
          CONFIG.BUILDING_MAX_HEIGHT
        );
        const color =
          CONFIG.BUILDING_COLORS[
            randInt(0, CONFIG.BUILDING_COLORS.length - 1)
          ];

        const { mesh: building, sideMaterial } = createBuilding(
          footprintX,
          footprintZ,
          height,
          color,
          windowTexture.clone()
        );

        const offsetX = randRange(
          -CONFIG.BLOCK_SIZE / 4,
          CONFIG.BLOCK_SIZE / 4
        );
        const offsetZ = randRange(
          -CONFIG.BLOCK_SIZE / 4,
          CONFIG.BLOCK_SIZE / 4
        );

        const centerX = blockCenterX + offsetX;
        const centerZ = blockCenterZ + offsetZ;
        building.position.x = centerX;
        building.position.z = centerZ;

        cityGroup.add(building);
        buildingMeshes.push(building);
        buildingFootprints.push({ x: footprintX, z: footprintZ, height });
        windowMaterials.push(sideMaterial);

        buildingBoxes.push({
          minX: centerX - footprintX / 2,
          maxX: centerX + footprintX / 2,
          minZ: centerZ - footprintZ / 2,
          maxZ: centerZ + footprintZ / 2,
        });
      }
    }
  }

  scene.add(cityGroup);

  // Enseignes néon + balises de toit sur les tours, lampadaires le long des rues :
  // tout ça reste éteint tant que dayNight.js ne monte pas le facteur de nuit.
  const { billboards, beacons } = decorateBuildingsWithLights(buildingMeshes, buildingFootprints);
  const streetLamps = createStreetLamps(scene, streetCentersX, streetCentersZ, totalWidth, totalDepth);

  return {
    cityGroup,
    buildingBoxes,
    buildingMeshes,
    buildingFootprints,
    streetCentersX,
    streetCentersZ,
    totalWidth,
    totalDepth,
    cityLights: { windowMaterials, billboards, beacons, streetLamps },
  };
}
