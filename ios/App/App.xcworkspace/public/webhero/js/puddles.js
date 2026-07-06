// puddles.js
// Flaques d'eau au sol utilisant une vraie réflexion planaire (Reflector).
// Elles reflètent en temps réel le ciel, les immeubles et la couleur du
// coucher de soleil géré par dayNight.js, pour un rendu de rue mouillée.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { CONFIG } from './config.js';

export function createPuddles(scene, buildingBoxes, totalWidth, totalDepth) {
  const puddles = [];
  const maxAttempts = CONFIG.PUDDLE_COUNT * 25;
  let attempts = 0;

  while (puddles.length < CONFIG.PUDDLE_COUNT && attempts < maxAttempts) {
    attempts++;
    const x = THREE.MathUtils.randFloatSpread(totalWidth * 0.85);
    const z = THREE.MathUtils.randFloatSpread(totalDepth * 0.85);

    // On évite de poser une flaque à l'intérieur d'un immeuble
    const inside = buildingBoxes.some(
      (b) => x > b.minX - 2 && x < b.maxX + 2 && z > b.minZ - 2 && z < b.maxZ + 2
    );
    if (inside) continue;

    const radius = THREE.MathUtils.randFloat(
      CONFIG.PUDDLE_MIN_RADIUS,
      CONFIG.PUDDLE_MAX_RADIUS
    );
    const geometry = new THREE.CircleGeometry(radius, 20);
    const reflector = new Reflector(geometry, {
      clipBias: 0.003,
      textureWidth: CONFIG.PUDDLE_TEXTURE_SIZE,
      textureHeight: CONFIG.PUDDLE_TEXTURE_SIZE,
      color: 0x5a6270,
    });

    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(x, 0.035, z);
    scene.add(reflector);
    puddles.push(reflector);
  }

  return puddles;
}
