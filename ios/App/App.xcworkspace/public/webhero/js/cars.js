// cars.js
// Étape 2/N : circulation automobile simple sur la grille de rues,
// pour donner vie aux rues de New York.

import * as THREE from 'three';
import { CONFIG } from './config.js';

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function createCarMesh(color) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(2, 1, 4.2);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  const cabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2.2);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.2 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Phares
  const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff4c2,
    emissive: 0xfff4c2,
    emissiveIntensity: 1.2,
  });
  const lightL = new THREE.Mesh(lightGeo, lightMat);
  lightL.position.set(-0.6, 0.6, 2.05);
  const lightR = lightL.clone();
  lightR.position.x = 0.6;
  group.add(lightL, lightR);

  return group;
}

export function generateCars(scene, streetCentersX, streetCentersZ, totalWidth, totalDepth) {
  const cars = [];
  const carGroup = new THREE.Group();

  for (let i = 0; i < CONFIG.CAR_COUNT; i++) {
    const color = CONFIG.CAR_COLORS[Math.floor(Math.random() * CONFIG.CAR_COLORS.length)];
    const mesh = createCarMesh(color);

    const goingHorizontal = Math.random() > 0.5;
    const speed = randRange(CONFIG.CAR_SPEED_MIN, CONFIG.CAR_SPEED_MAX);
    const direction = Math.random() > 0.5 ? 1 : -1;

    let lane, axis;
    if (goingHorizontal) {
      // La voiture roule le long de X, sur une rue horizontale (z fixe)
      lane = streetCentersZ[Math.floor(Math.random() * streetCentersZ.length)];
      // légère offset pour rouler du bon côté de la rue (sens de circulation)
      mesh.position.z = lane + direction * 2;
      mesh.position.x = randRange(-totalWidth / 2, totalWidth / 2);
      mesh.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      axis = 'x';
    } else {
      lane = streetCentersX[Math.floor(Math.random() * streetCentersX.length)];
      mesh.position.x = lane + direction * 2;
      mesh.position.z = randRange(-totalDepth / 2, totalDepth / 2);
      mesh.rotation.y = direction > 0 ? 0 : Math.PI;
      axis = 'z';
    }

    carGroup.add(mesh);
    cars.push({ mesh, axis, direction, speed, lane });
  }

  scene.add(carGroup);

  const halfW = totalWidth / 2 + CONFIG.STREET_WIDTH / 2;
  const halfD = totalDepth / 2 + CONFIG.STREET_WIDTH / 2;

  function update(delta) {
    cars.forEach((car) => {
      if (car.axis === 'x') {
        car.mesh.position.x += car.direction * car.speed * delta;
        if (car.mesh.position.x > halfW) car.mesh.position.x = -halfW;
        if (car.mesh.position.x < -halfW) car.mesh.position.x = halfW;
      } else {
        car.mesh.position.z += car.direction * car.speed * delta;
        if (car.mesh.position.z > halfD) car.mesh.position.z = -halfD;
        if (car.mesh.position.z < -halfD) car.mesh.position.z = halfD;
      }
    });
  }

  return { carGroup, update };
}
