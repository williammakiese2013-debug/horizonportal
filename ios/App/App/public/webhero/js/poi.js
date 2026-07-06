// poi.js
// Lieux d'intérêt du Mode Histoire, en dehors du pur combat : le "Central de
// Données" (piratage) et les "Docks" (infiltration/piratage) de Meridian.
// Chaque POI est une petite structure au sol (repérable de loin, on peut
// même y accrocher une toile) surveillée par des caméras de sécurité qui
// font monter une jauge de "suspicion" quand le joueur reste dans leur cône
// de vue. Si la jauge atteint le maximum, une alarme se déclenche.

import * as THREE from 'three';
import { CONFIG } from './config.js';

function findClearSpot(buildingBoxes, totalWidth, totalDepth, margin) {
  for (let i = 0; i < 200; i++) {
    const x = (Math.random() - 0.5) * (totalWidth - 120);
    const z = (Math.random() - 0.5) * (totalDepth - 120);
    let clear = true;
    for (const box of buildingBoxes) {
      if (
        x + margin > box.minX &&
        x - margin < box.maxX &&
        z + margin > box.minZ &&
        z - margin < box.maxZ
      ) {
        clear = false;
        break;
      }
    }
    if (clear) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(0, 0, 0);
}

function createFenceRing(radius, height, color) {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.3 });
  const postCount = 14;
  for (let i = 0; i < postCount; i++) {
    const a = (i / postCount) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, height, 6), postMat);
    post.position.set(Math.cos(a) * radius, height / 2, Math.sin(a) * radius);
    group.add(post);
  }
  const wireGeo = new THREE.TorusGeometry(radius, 0.02, 4, postCount);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
  [height * 0.35, height * 0.7].forEach((y) => {
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.rotation.x = Math.PI / 2;
    wire.position.y = y;
    group.add(wire);
  });
  return group;
}

function createCamera(scene, basePos, baseAngle, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.6 });
  const lensMat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 1.8,
  });

  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), bodyMat);
  mount.position.y = -0.25;
  group.add(mount);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.42), bodyMat);
  group.add(body);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), lensMat);
  lens.rotation.z = Math.PI / 2;
  lens.position.set(0, 0, 0.26);
  group.add(lens);

  // Cône de détection (visuel discret, s'illumine en rouge quand alerte)
  const coneGeo = new THREE.ConeGeometry(
    Math.tan(CONFIG.CAMERA_HALF_FOV) * CONFIG.CAMERA_RANGE,
    CONFIG.CAMERA_RANGE,
    16,
    1,
    true
  );
  coneGeo.rotateX(Math.PI / 2);
  coneGeo.translate(0, 0, CONFIG.CAMERA_RANGE / 2);
  const coneMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.07,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  group.add(cone);

  group.position.copy(basePos);
  scene.add(group);

  return { group, lensMat, coneMat, baseAngle };
}

// Fabrique un POI complet : plateforme + clôture + un jeu de caméras qui
// balaient un arc de cercle. Retourne tout ce qu'il faut pour la mission
// (position de la "console" à atteindre, mesh pour la toile/collision,
// et une fonction pour calculer la suspicion générée à un instant donné).
function buildPOI(scene, { name, position, structureColor, cameraColor, cameraCount, platformRadius }) {
  const group = new THREE.Group();
  group.position.copy(position);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(platformRadius, platformRadius, 0.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.9 })
  );
  platform.position.y = 0.2;
  group.add(platform);

  group.add(createFenceRing(platformRadius + 1.2, 2.4, 0x3a3d44));

  const towerHeight = 14;
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(6, towerHeight, 6),
    new THREE.MeshStandardMaterial({
      color: structureColor,
      emissive: new THREE.Color(structureColor),
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.4,
    })
  );
  tower.position.y = towerHeight / 2;
  group.add(tower);

  // La console à atteindre pour terminer la quête (piratage / accès)
  const consoleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.1, 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x101216,
      emissive: new THREE.Color(0x37e0ff),
      emissiveIntensity: 1.1,
    })
  );
  consoleMesh.position.set(0, 0.75, platformRadius - 1.6);
  group.add(consoleMesh);

  // Marqueur lumineux vertical visible de loin (repère de mission)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 220, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: cameraColor, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  beam.position.y = 110;
  group.add(beam);

  scene.add(group);

  const cameras = [];
  for (let i = 0; i < cameraCount; i++) {
    const a = (i / cameraCount) * Math.PI * 2;
    const camPos = position.clone().add(
      new THREE.Vector3(Math.cos(a) * (platformRadius - 1), towerHeight + 1.2, Math.sin(a) * (platformRadius - 1))
    );
    const baseAngle = a + Math.PI; // regarde vers l'intérieur de la plateforme
    const cam = createCamera(scene, camPos, baseAngle, cameraColor);
    cam.group.rotation.y = baseAngle;
    cameras.push(cam);
  }

  return {
    name,
    group,
    position: position.clone(),
    consoleWorldPos: consoleMesh.getWorldPosition(new THREE.Vector3()),
    tower,
    cameras,
    collisionBox: {
      minX: position.x - 3,
      maxX: position.x + 3,
      minZ: position.z - 3,
      maxZ: position.z + 3,
    },
  };
}

export function createPOIs(scene, buildingBoxes, buildingMeshes, totalWidth, totalDepth) {
  const dataCenterPos = findClearSpot(buildingBoxes, totalWidth, totalDepth, 26);
  let docksPos = findClearSpot(buildingBoxes, totalWidth, totalDepth, 26);
  // On évite que les deux POI se retrouvent trop proches l'un de l'autre
  if (docksPos.distanceTo(dataCenterPos) < 200) {
    docksPos = new THREE.Vector3(-dataCenterPos.x * 0.6, 0, -dataCenterPos.z * 0.6);
  }

  const dataCenter = buildPOI(scene, {
    name: 'Central de Données Meridian',
    position: dataCenterPos,
    structureColor: 0x1f2937,
    cameraColor: 0x37e0ff,
    cameraCount: 3,
    platformRadius: 12,
  });

  const docks = buildPOI(scene, {
    name: 'Docks Meridian',
    position: docksPos,
    structureColor: 0x2b2f36,
    cameraColor: 0xff8a3d,
    cameraCount: 4,
    platformRadius: 14,
  });

  // Les tours des POI servent aussi d'immeubles "normaux" : on les ajoute
  // aux listes utilisées pour la toile (raycast) et les collisions au sol.
  for (const poi of [dataCenter, docks]) {
    buildingMeshes.push(poi.tower);
    buildingBoxes.push(poi.collisionBox);
  }

  const pois = { dataCenter, docks };

  let suspicion = 0;
  let alarmTriggered = false;
  const tmpToPlayer = new THREE.Vector3();
  const tmpForward = new THREE.Vector3();

  function evaluateCamera(cam, playerPos, elapsed) {
    // Balayage sinusoïdal autour de l'angle de base
    const sweep = Math.sin(elapsed * CONFIG.CAMERA_SWEEP_SPEED) * CONFIG.CAMERA_SWEEP_ARC;
    const angle = cam.baseAngle + sweep;
    cam.group.rotation.y = angle;

    const camPos = cam.group.position;
    tmpToPlayer.subVectors(playerPos, camPos);
    const dist = tmpToPlayer.length();
    if (dist > CONFIG.CAMERA_RANGE) return false;

    tmpForward.set(Math.sin(angle), 0, Math.cos(angle));
    tmpToPlayer.y = 0;
    tmpToPlayer.normalize();
    const dot = THREE.MathUtils.clamp(tmpForward.dot(tmpToPlayer), -1, 1);
    const angleTo = Math.acos(dot);
    return angleTo <= CONFIG.CAMERA_HALF_FOV;
  }

  let elapsed = 0;
  let activePoiKey = null; // quel POI est surveillé pendant la quête en cours

  function update(delta, playerPos) {
    elapsed += delta;
    if (!activePoiKey) return { suspicion: 0, alarm: false };

    const poi = pois[activePoiKey];
    let seen = false;
    for (const cam of poi.cameras) {
      const lensColorTarget = evaluateCamera(cam, playerPos, elapsed) ? 0xff2020 : (poi === dataCenter ? 0x37e0ff : 0xff8a3d);
      cam.lensMat.emissive.setHex(lensColorTarget);
      cam.coneMat.color.setHex(lensColorTarget);
      if (lensColorTarget === 0xff2020) seen = true;
    }

    if (seen) {
      suspicion = Math.min(CONFIG.SUSPICION_MAX, suspicion + CONFIG.SUSPICION_RISE_PER_SEC * delta);
    } else {
      suspicion = Math.max(0, suspicion - CONFIG.SUSPICION_FALL_PER_SEC * delta);
    }

    let alarm = false;
    if (suspicion >= CONFIG.SUSPICION_MAX && !alarmTriggered) {
      alarmTriggered = true;
      alarm = true;
    }
    if (suspicion < CONFIG.SUSPICION_MAX * 0.6) {
      alarmTriggered = false;
    }

    return { suspicion, alarm };
  }

  function beginWatch(poiKey) {
    activePoiKey = poiKey;
    suspicion = 0;
    alarmTriggered = false;
  }
  function endWatch() {
    activePoiKey = null;
    suspicion = 0;
  }

  return {
    pois,
    dataCenter,
    docks,
    update,
    beginWatch,
    endWatch,
    getSuspicion: () => suspicion,
  };
}
