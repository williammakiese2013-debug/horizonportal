// player.js
// Système de déplacement du héros : marche/course, saut, et surtout la
// toile — retravaillée pour être FIABLE (assistance de visée : si le rayon
// exact du réticule rate un immeuble de peu, on cherche autour dans un
// cône) et pour permettre un enchaînement façon "vol" : ré-accrochage
// instantané en swing (chaîne de swings) et un "zip" (tir-grappin qui tire
// directement le joueur vers un point, utile pour traverser vite ou
// grimper). Toute la logique d'entrée (clavier ET tactile) passe par des
// fonctions exposées (jump, shootWeb, releaseWeb, zip, setMoveVector, rotate)
// pour pouvoir être pilotée par les contrôles mobiles (mobileControls.js).

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from './config.js';
import { createWebRope, createWebEffects } from './webEffects.js';

function createArmModel() {
  const group = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x7a1620, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a2b2b, roughness: 0.7 });
  const shooterMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.4, roughness: 0.4 });

  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.55, 10), suitMat);
  forearm.rotation.z = Math.PI / 2.3;
  forearm.rotation.y = 0.3;
  forearm.position.set(0.38, -0.42, -0.7);
  group.add(forearm);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), skinMat);
  hand.position.set(0.62, -0.5, -0.85);
  group.add(hand);

  const shooter = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 10), shooterMat);
  shooter.rotation.z = Math.PI / 2.3;
  shooter.position.set(0.66, -0.53, -0.9);
  group.add(shooter);

  return group;
}

export function createPlayer(camera, domElement, buildingBoxes, buildingMeshes, scene, isTouchDevice) {
  const controls = new PointerLockControls(camera, domElement);

  camera.position.set(0, CONFIG.PLAYER_HEIGHT, 0);
  scene.add(camera); // nécessaire pour que les enfants de la caméra (bras) soient rendus

  const armModel = createArmModel();
  camera.add(armModel);

  const keys = { forward: false, backward: false, left: false, right: false, run: false };
  // Vecteur de mouvement analogique fourni par le joystick tactile (-1..1)
  const analogMove = { x: 0, z: 0 };

  const velocity = new THREE.Vector3();

  let grounded = true;
  let swinging = false;
  let anchor = null;
  let ropeLength = 0;

  // --- Zip (tir-grappin direct, sans pendule) ---
  let zipping = false;
  let zipTarget = null;
  let zipCooldown = 0;

  // --- Combat (Mode Histoire) ---
  let health = CONFIG.COMBAT.PLAYER_MAX_HEALTH;
  let invulnTimer = 0;
  let dead = false;
  let attackCooldownTimer = 0;
  let punchTimer = 0;
  let punchDuration = 0.18;
  let onDamageCallback = null;
  let onDeathCallback = null;
  let onAttackCallback = null;

  // FOV dynamique : s'élargit un peu quand on va vite (swing/course), pour
  // renforcer la sensation de vitesse et de "vol" façon super-héros.
  const baseFov = camera.fov;

  const raycaster = new THREE.Raycaster();
  const forwardDir = new THREE.Vector3();

  const webRope = createWebRope(scene);
  const webEffects = createWebEffects(scene);

  // --- Souris / clavier (desktop uniquement pour le pointer lock) ---
  if (!isTouchDevice) {
    domElement.addEventListener('click', () => {
      if (!controls.isLocked) controls.lock();
    });

    document.addEventListener('mousedown', (e) => {
      if (!controls.isLocked) return;
      if (e.button === 0) shootWeb();
      if (e.button === 2) zip();
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) releaseWeb();
    });

    // Le clic droit sert au zip : on empêche le menu contextuel du navigateur.
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.run = true;
        break;
      case 'Space':
        e.preventDefault();
        if (swinging) releaseWeb();
        else if (zipping) cancelZip(false);
        else jump();
        break;
      case 'KeyF':
        attack();
        break;
      case 'KeyE':
        zip();
        break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.run = false;
        break;
    }
  });

  // --- Fonctions d'action, réutilisables par le clavier ET le tactile ---
  function jump() {
    if (grounded) {
      velocity.y = CONFIG.JUMP_SPEED;
      grounded = false;
    }
  }

  // Cherche un point d'accroche valide dans l'axe de la caméra. Si le rayon
  // exact rate (trou entre deux immeubles, léger désalignement du réticule),
  // on teste des rayons secondaires disposés en anneaux concentriques
  // autour de la direction visée ("assistance de visée") et on garde le
  // meilleur candidat valide le plus proche du centre du regard. C'est ce
  // qui rend la toile fiable même sans viser au pixel près.
  function findAnchor(maxDistance, minHeightAbove) {
    forwardDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, forwardDir);
    raycaster.far = maxDistance;

    const direct = raycaster.intersectObjects(buildingMeshes, false);
    if (direct.length > 0 && direct[0].point.y >= camera.position.y + minHeightAbove) {
      return direct[0];
    }

    // Repère local (haut/droite de la caméra) pour construire le cône de test
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    let best = null;
    let bestAngle = Infinity;
    const testDir = new THREE.Vector3();
    const rings = CONFIG.WEB_AIM_ASSIST_RINGS;
    const perRing = CONFIG.WEB_AIM_ASSIST_PER_RING;

    for (let r = 1; r <= rings; r++) {
      const ringAngle = (r / rings) * CONFIG.WEB_AIM_ASSIST_CONE;
      for (let i = 0; i < perRing; i++) {
        const a = (i / perRing) * Math.PI * 2;
        testDir.copy(forwardDir)
          .addScaledVector(right, Math.cos(a) * ringAngle)
          .addScaledVector(up, Math.sin(a) * ringAngle)
          .normalize();
        raycaster.set(camera.position, testDir);
        raycaster.far = maxDistance;
        const hits = raycaster.intersectObjects(buildingMeshes, false);
        if (hits.length === 0) continue;
        const hit = hits[0];
        if (hit.point.y < camera.position.y + minHeightAbove) continue;
        if (ringAngle < bestAngle) {
          bestAngle = ringAngle;
          best = hit;
        }
      }
      if (best) break; // on garde l'anneau valide le plus proche du centre
    }

    return best;
  }

  function shootWeb() {
    const hit = findAnchor(CONFIG.WEB_MAX_DISTANCE, CONFIG.WEB_MIN_ANCHOR_HEIGHT_ABOVE);
    if (!hit) return;

    // Si on tirait déjà une toile (enchaînement façon "vol"), on relâche
    // proprement l'ancienne avant d'accrocher la nouvelle pour garder l'élan.
    if (swinging) {
      velocity.multiplyScalar(CONFIG.WEB_RELEASE_BOOST);
    }
    zipping = false;

    anchor = hit.point.clone();
    ropeLength = camera.position.distanceTo(anchor);
    swinging = true;
    grounded = false;
    webRope.show();

    // Position approximative de la main (bas droite de la vue) pour l'origine des particules
    const handOffset = new THREE.Vector3(0.6, -0.5, -0.85).applyQuaternion(camera.quaternion);
    const handWorldPos = camera.position.clone().add(handOffset);
    webEffects.spawnShotTrail(handWorldPos, anchor);

    const worldNormal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new THREE.Vector3(0, 0, 1);
    webEffects.spawnSplat(anchor, worldNormal);
  }

  // Zip : tire directement le joueur vers le point visé (pas de pendule).
  // Pratique pour grimper une façade ou traverser vite une rue, et
  // s'enchaîne bien avec shootWeb() pour donner une vraie sensation de vol
  // au-dessus de la ville (zip pour prendre de l'élan, puis toile pour
  // swinguer, puis zip à nouveau...).
  function zip() {
    if (zipCooldown > 0) return;
    const hit = findAnchor(CONFIG.ZIP_MAX_DISTANCE, 0);
    if (!hit) return;
    const dist = camera.position.distanceTo(hit.point);
    if (dist < CONFIG.ZIP_MIN_DISTANCE) return;

    swinging = false;
    webRope.hide();
    anchor = null;

    zipping = true;
    zipTarget = hit.point.clone();
    grounded = false;

    const handOffset = new THREE.Vector3(0.6, -0.5, -0.85).applyQuaternion(camera.quaternion);
    const handWorldPos = camera.position.clone().add(handOffset);
    webEffects.spawnShotTrail(handWorldPos, zipTarget);
    const worldNormal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new THREE.Vector3(0, 0, 1);
    webEffects.spawnSplat(zipTarget, worldNormal);
  }

  function cancelZip(boost) {
    if (!zipping) return;
    zipping = false;
    zipTarget = null;
    zipCooldown = CONFIG.ZIP_COOLDOWN || 0.1;
    if (boost) velocity.multiplyScalar(CONFIG.ZIP_END_BOOST);
  }

  // Utilisé par l'UI pour colorer le réticule quand un accrochage est possible.
  function hasValidAnchorAhead() {
    return !!findAnchor(CONFIG.WEB_MAX_DISTANCE, CONFIG.WEB_MIN_ANCHOR_HEIGHT_ABOVE);
  }

  // power: multiplicateur de puissance du coup (1 = coup clavier "normal").
  // Fourni par combatControls.js à partir de la vitesse réelle du poing
  // suivi par hand tracking ; clampé ici par sécurité si un appelant externe
  // envoie une valeur hors bornes.
  function attack(power = 1) {
    if (dead || attackCooldownTimer > 0) return;
    const p = Math.max(CONFIG.COMBAT.PUNCH_MIN_POWER, Math.min(CONFIG.COMBAT.PUNCH_MAX_POWER, power));
    attackCooldownTimer = CONFIG.COMBAT.ATTACK_COOLDOWN;
    // Coup plus rapide à l'écran quand il est plus puissant (retour visuel).
    punchDuration = 0.18 / Math.sqrt(p);
    punchTimer = punchDuration;
    if (onAttackCallback) {
      forwardDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      onAttackCallback(camera.position.clone(), forwardDir.clone(), p);
    }
  }

  function takeDamage(amount) {
    if (dead || invulnTimer > 0) return;
    health = Math.max(0, health - amount);
    invulnTimer = CONFIG.COMBAT.PLAYER_INVULN_TIME;
    if (onDamageCallback) onDamageCallback(health, CONFIG.COMBAT.PLAYER_MAX_HEALTH);
    if (health <= 0) {
      dead = true;
      if (onDeathCallback) onDeathCallback();
    }
  }

  function heal(amount) {
    health = Math.min(CONFIG.COMBAT.PLAYER_MAX_HEALTH, health + amount);
    if (onDamageCallback) onDamageCallback(health, CONFIG.COMBAT.PLAYER_MAX_HEALTH);
  }

  function respawn(position) {
    health = CONFIG.COMBAT.PLAYER_MAX_HEALTH;
    dead = false;
    invulnTimer = 1;
    velocity.set(0, 0, 0);
    swinging = false;
    webRope.hide();
    anchor = null;
    zipping = false;
    zipTarget = null;
    if (position) camera.position.copy(position);
    camera.position.y = CONFIG.PLAYER_HEIGHT;
    if (onDamageCallback) onDamageCallback(health, CONFIG.COMBAT.PLAYER_MAX_HEALTH);
  }

  function releaseWeb() {
    if (swinging) {
      // Petit élan au lâcher, comme un vrai lâcher de toile en plein swing :
      // on garde (et amplifie un peu) la vitesse acquise pendant le swing.
      velocity.multiplyScalar(CONFIG.WEB_RELEASE_BOOST);
    }
    swinging = false;
    webRope.hide();
    anchor = null;
  }

  // Rotation manuelle de la caméra (utilisée par le tactile, indépendante du pointer lock)
  function rotate(deltaX, deltaY) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= deltaX * CONFIG.MOBILE_LOOK_SENSITIVITY;
    euler.x -= deltaY * CONFIG.MOBILE_LOOK_SENSITIVITY;
    const maxPitch = Math.PI / 2 - 0.01;
    euler.x = Math.max(-maxPitch, Math.min(maxPitch, euler.x));
    camera.quaternion.setFromEuler(euler);
  }

  // Fournit un vecteur de mouvement analogique (joystick tactile), x = latéral, z = avant/arrière
  function setMoveVector(x, z) {
    analogMove.x = x;
    analogMove.z = z;
  }

  function setRun(isRunning) {
    keys.run = isRunning;
  }

  function collidesXZ(x, z) {
    const r = CONFIG.PLAYER_RADIUS;
    for (const box of buildingBoxes) {
      if (
        x + r > box.minX &&
        x - r < box.maxX &&
        z + r > box.minZ &&
        z - r < box.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  function update(delta) {
    if (invulnTimer > 0) invulnTimer -= delta;
    if (attackCooldownTimer > 0) attackCooldownTimer -= delta;
    if (zipCooldown > 0) zipCooldown -= delta;

    if (punchTimer > 0) {
      punchTimer -= delta;
      const t = 1 - Math.max(0, punchTimer) / punchDuration;
      armModel.position.z = -0.32 * Math.sin(t * Math.PI);
    } else if (armModel.position.z !== 0) {
      armModel.position.z = 0;
    }

    if (dead) return;

    const speed = CONFIG.PLAYER_SPEED * (keys.run ? CONFIG.PLAYER_RUN_MULTIPLIER : 1);

    let moveForward = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0) + analogMove.z;
    let moveRight = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + analogMove.x;
    moveForward = THREE.MathUtils.clamp(moveForward, -1, 1);
    moveRight = THREE.MathUtils.clamp(moveRight, -1, 1);

    if (zipping && zipTarget) {
      // --- Zip : on file en ligne droite vers le point visé ---
      const toTarget = new THREE.Vector3().subVectors(zipTarget, camera.position);
      const distToTarget = toTarget.length();
      if (distToTarget <= CONFIG.ZIP_ARRIVE_RADIUS) {
        // Arrivé : on garde un peu d'élan dans la direction du zip pour
        // enchaîner tout de suite avec un saut, une toile ou un autre zip.
        toTarget.normalize();
        velocity.copy(toTarget).multiplyScalar(CONFIG.ZIP_SPEED * 0.5);
        cancelZip(true);
      } else {
        toTarget.normalize();
        velocity.copy(toTarget).multiplyScalar(CONFIG.ZIP_SPEED);
      }
    } else if (swinging && anchor) {
      // --- Pilotage en vol : on "pompe" la toile pour accélérer ---
      // Avancer raccourcit le fil (comme un vrai swing d'araignée : on remonte
      // vers l'accroche et on gagne de la vitesse), reculer le rallonge.
      ropeLength -= moveForward * CONFIG.WEB_REEL_SPEED * delta;
      ropeLength = THREE.MathUtils.clamp(ropeLength, CONFIG.WEB_ROPE_MIN, CONFIG.WEB_MAX_DISTANCE);

      // Peu de frottement en l'air : on garde l'élan (sensation de vol),
      // et on ajoute une poussée continue avant/latérale pour diriger le swing.
      velocity.x -= velocity.x * 0.6 * delta;
      velocity.z -= velocity.z * 0.6 * delta;
      velocity.z -= moveForward * CONFIG.WEB_SWING_FORWARD_ACCEL * delta;
      velocity.x -= moveRight * CONFIG.WEB_SWING_AIR_ACCEL * delta;

      const horizSpeed = Math.hypot(velocity.x, velocity.z);
      if (horizSpeed > CONFIG.WEB_MAX_SPEED) {
        const scale = CONFIG.WEB_MAX_SPEED / horizSpeed;
        velocity.x *= scale;
        velocity.z *= scale;
      }
    } else {
      velocity.x -= velocity.x * 6 * delta;
      velocity.z -= velocity.z * 6 * delta;
      if (moveForward !== 0) velocity.z -= moveForward * speed * delta * 6;
      if (moveRight !== 0) velocity.x -= moveRight * speed * delta * 6;
      velocity.x = THREE.MathUtils.clamp(velocity.x, -speed * 1.5, speed * 1.5);
      velocity.z = THREE.MathUtils.clamp(velocity.z, -speed * 1.5, speed * 1.5);
    }

    if (!grounded && !zipping) {
      velocity.y -= CONFIG.GRAVITY * delta;
    }

    const prevX = camera.position.x;
    const prevZ = camera.position.z;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    camera.position.y += velocity.y * delta;

    if (swinging && anchor) {
      const diff = new THREE.Vector3().subVectors(camera.position, anchor);
      const dist = diff.length();
      if (dist > ropeLength) {
        diff.setLength(ropeLength);
        camera.position.copy(anchor).add(diff);

        const radial = diff.clone().normalize();
        const radialSpeed = velocity.dot(radial);
        velocity.addScaledVector(radial, -radialSpeed);
      }
      // Le fil est courbé (affaissement + brins tissés géré dans webEffects.js) ;
      // on le met simplement à jour entre la main et le point d'accroche.
      webRope.update(camera.position, anchor);
    }
    webEffects.updateSwingTrail(swinging || zipping, camera.position, anchor || zipTarget || camera.position);

    webEffects.update(delta);

    if (collidesXZ(camera.position.x, camera.position.z)) {
      camera.position.x = prevX;
      camera.position.z = prevZ;
      velocity.x *= -0.2;
      velocity.z *= -0.2;
    }

    if (camera.position.y <= CONFIG.PLAYER_HEIGHT) {
      camera.position.y = CONFIG.PLAYER_HEIGHT;
      velocity.y = 0;
      grounded = true;
      if (swinging) releaseWeb();
      if (zipping) cancelZip(false);
    }

    // FOV dynamique : s'élargit avec la vitesse horizontale pour accentuer
    // la sensation de vol pendant le swing (et un peu en course au sol).
    const speedForFov = Math.hypot(velocity.x, velocity.z);
    const fovBoost = THREE.MathUtils.clamp(speedForFov / CONFIG.WEB_MAX_SPEED, 0, 1) * 10;
    const targetFov = baseFov + fovBoost;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, delta * 4));
      camera.updateProjectionMatrix();
    }
  }

  return {
    controls,
    update,
    jump,
    shootWeb,
    releaseWeb,
    zip,
    cancelZip,
    hasValidAnchorAhead,
    rotate,
    setMoveVector,
    setRun,
    isSwinging: () => swinging,
    isZipping: () => zipping,
    attack,
    takeDamage,
    heal,
    respawn,
    getHealth: () => health,
    getMaxHealth: () => CONFIG.COMBAT.PLAYER_MAX_HEALTH,
    isDead: () => dead,
    setOnDamage: (cb) => { onDamageCallback = cb; },
    setOnDeath: (cb) => { onDeathCallback = cb; },
    setOnAttack: (cb) => { onAttackCallback = cb; },
  };
}
