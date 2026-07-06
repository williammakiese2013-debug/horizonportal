// enemies.js
// Système d'ennemis du Mode Histoire : voyous, hommes de main (élite),
// créatures Chimère (monstres) et le boss final "Prime".
// Chaque ennemi est un simple assemblage de primitives Three.js avec une
// petite machine à états (idle -> poursuite -> attaque -> mort) et,
// pour les monstres/le boss, une attaque à distance (projectile).

import * as THREE from 'three';
import { CONFIG } from './config.js';

export const ENEMY_DEFS = {
  grunt: {
    name: 'Voyou',
    hp: 40,
    speed: 6.2,
    damage: 8,
    attackRange: 2.4,
    attackCooldown: 1.1,
    detectRange: 60,
    color: 0x8a2020,
    scale: 1,
    radius: 0.55,
    ranged: false,
  },
  elite: {
    name: 'Homme de main',
    hp: 85,
    speed: 6.8,
    damage: 12,
    attackRange: 2.6,
    attackCooldown: 1.0,
    detectRange: 60,
    color: 0x2a2a2e,
    scale: 1.12,
    radius: 0.6,
    ranged: false,
  },
  monster: {
    name: 'Créature Chimère',
    hp: 150,
    speed: 5.6,
    damage: 14,
    attackRange: 2.9,
    attackCooldown: 1.4,
    detectRange: 70,
    color: 0x4a1f6b,
    scale: 1.7,
    radius: 0.9,
    ranged: true,
    rangedRange: 32,
    rangedDamage: 10,
    rangedCooldown: 2.6,
    projectileColor: 0x9be23d,
  },
  boss: {
    name: 'Prime',
    hp: 650,
    speed: 6.6,
    damage: 20,
    attackRange: 3.4,
    attackCooldown: 1.0,
    detectRange: 999,
    color: 0x2a0a0a,
    scale: 2.6,
    radius: 1.3,
    ranged: true,
    rangedRange: 40,
    rangedDamage: 14,
    rangedCooldown: 2.1,
    projectileColor: 0xff3b30,
    enrageAt: 0.5,
    enrageSpeedMult: 1.35,
    enrageCooldownMult: 0.65,
  },
};

function buildEnemyMesh(def) {
  const group = new THREE.Group();
  const s = def.scale;

  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.75, metalness: 0.15 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xff3030),
    emissiveIntensity: 1.6,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.5 * s, 1.5 * s, 10), bodyMat);
  body.position.y = 0.95 * s;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 12, 12), bodyMat);
  head.position.y = 1.85 * s;
  group.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.06 * s, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.13 * s, 1.88 * s, 0.27 * s);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(-0.13 * s, 1.88 * s, 0.27 * s);
  group.add(eyeL, eyeR);

  const armGeo = new THREE.CylinderGeometry(0.1 * s, 0.12 * s, 1.1 * s, 8);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(0.55 * s, 0.95 * s, 0);
  armL.rotation.z = 0.25;
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(-0.55 * s, 0.95 * s, 0);
  armR.rotation.z = -0.25;
  group.add(armL, armR);

  // Barre de vie flottante (toujours orientée vers la caméra)
  const barPivot = new THREE.Group();
  barPivot.position.y = 2.5 * s;
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.75 })
  );
  const fg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x4ade80 })
  );
  fg.position.z = 0.001;
  fg.position.x = -1.16 / 2; // ancré à gauche, on scale.x pour vider la barre
  fg.geometry.translate(1.16 / 2, 0, 0);
  barPivot.add(bg, fg);
  group.add(barPivot);

  return { group, bodyMat, fg, barPivot };
}

export function createEnemy(scene, type, position, options) {
  const def = ENEMY_DEFS[type];
  const { group, bodyMat, fg, barPivot } = buildEnemyMesh(def);
  group.position.copy(position);
  group.position.y = 0;
  scene.add(group);

  const {
    getPlayerPosition,
    onHitPlayer,
    onDeath,
    buildingBoxes,
    camera,
  } = options;

  let hp = def.hp;
  let dead = false;
  let deathTimer = 0;
  let attackCooldownTimer = Math.random() * 0.5;
  let rangedCooldownTimer = 1 + Math.random();
  let flashTimer = 0;
  let enraged = false;
  let speedMult = 1;
  let cooldownMult = 1;
  const projectiles = [];

  // Impulsion de recul (knockback) reçue d'un coup de poing à haute vélocité.
  // Vecteur XZ en unités/s, ré-appliqué chaque frame puis amorti (decay).
  const knockback = new THREE.Vector2(0, 0);

  function applyKnockback(dirXZ, force) {
    // On cumule (plutôt que remplacer) pour permettre l'enchaînement de coups,
    // avec un plafond pour éviter les téléportations absurdes sur un combo.
    knockback.x = THREE.MathUtils.clamp(knockback.x + dirXZ.x * force, -40, 40);
    knockback.y = THREE.MathUtils.clamp(knockback.y + dirXZ.z * force, -40, 40);
  }

  function collides(x, z) {
    if (!buildingBoxes) return false;
    for (const box of buildingBoxes) {
      if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) return true;
    }
    return false;
  }

  function spawnProjectile(targetPos) {
    const geo = new THREE.SphereGeometry(0.28 * (def.scale > 2 ? 1.1 : 1), 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: def.projectileColor || 0xff5050,
      emissive: new THREE.Color(def.projectileColor || 0xff5050),
      emissiveIntensity: 2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(group.position);
    mesh.position.y += 1.6 * def.scale;
    scene.add(mesh);

    const dir = new THREE.Vector3().subVectors(targetPos, mesh.position);
    dir.y = 0;
    dir.normalize();
    projectiles.push({ mesh, vel: dir.multiplyScalar(22), life: 3 });
  }

  function updateProjectiles(delta, playerPos) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.mesh.position.addScaledVector(p.vel, delta);
      p.life -= delta;
      const dist = p.mesh.position.distanceTo(playerPos);
      if (dist < 1.5) {
        onHitPlayer(def.rangedDamage);
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      } else if (p.life <= 0) {
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  function takeDamage(amount) {
    if (dead) return;
    hp = Math.max(0, hp - amount);
    flashTimer = 0.12;
    if (hp <= 0) die();
  }

  function die() {
    dead = true;
    deathTimer = 0.55;
    if (onDeath) onDeath();
  }

  function update(delta) {
    if (flashTimer > 0) {
      flashTimer -= delta;
      bodyMat.emissive = new THREE.Color(0xffffff);
      bodyMat.emissiveIntensity = Math.max(0, flashTimer / 0.12) * 1.2;
    } else if (bodyMat.emissiveIntensity) {
      bodyMat.emissiveIntensity = 0;
    }

    if (camera) barPivot.quaternion.copy(camera.quaternion);

    if (dead) {
      deathTimer -= delta;
      const t = Math.max(0, deathTimer) / 0.55;
      group.scale.setScalar(t);
      group.position.y = (1 - t) * -1.2;
      if (deathTimer <= 0) {
        scene.remove(group);
        for (const p of projectiles) scene.remove(p.mesh);
        projectiles.length = 0;
      }
      return;
    }

    const playerPos = getPlayerPosition();
    updateProjectiles(delta, playerPos);

    if (def.enrageAt && !enraged && hp / def.hp <= def.enrageAt) {
      enraged = true;
      speedMult = def.enrageSpeedMult;
      cooldownMult = def.enrageCooldownMult;
    }

    fg.scale.x = Math.max(0, hp / def.hp);

    const toPlayer = new THREE.Vector3().subVectors(playerPos, group.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > 0.01) group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    if (dist > def.detectRange) return; // trop loin, reste immobile

    rangedCooldownTimer -= delta;
    if (def.ranged && dist > def.attackRange && dist <= def.rangedRange && rangedCooldownTimer <= 0) {
      spawnProjectile(playerPos);
      rangedCooldownTimer = def.rangedCooldown * cooldownMult;
    }

    // Applique le recul du dernier coup de poing reçu (indépendant de l'IA
    // de poursuite ci-dessous) puis l'amortit exponentiellement.
    if (knockback.lengthSq() > 0.0004) {
      const kx = group.position.x + knockback.x * delta;
      const kz = group.position.z + knockback.y * delta;
      if (!collides(kx, group.position.z)) group.position.x = kx;
      if (!collides(group.position.x, kz)) group.position.z = kz;
      const decay = Math.max(0, 1 - CONFIG.COMBAT.PUNCH_KNOCKBACK_DECAY * delta);
      knockback.multiplyScalar(decay);
    } else {
      knockback.set(0, 0);
    }

    if (dist > def.attackRange) {
      const dir = toPlayer.normalize();
      const spd = def.speed * speedMult;
      const nx = group.position.x + dir.x * spd * delta;
      const nz = group.position.z + dir.z * spd * delta;
      if (!collides(nx, group.position.z)) group.position.x = nx;
      if (!collides(group.position.x, nz)) group.position.z = nz;
    } else {
      attackCooldownTimer -= delta;
      if (attackCooldownTimer <= 0) {
        attackCooldownTimer = def.attackCooldown * cooldownMult;
        onHitPlayer(def.damage);
      }
    }
  }

  return {
    type,
    def,
    getPosition: () => group.position,
    getHealth: () => hp,
    getMaxHealth: () => def.hp,
    getName: () => def.name,
    isDead: () => dead,
    isRemovable: () => dead && deathTimer <= 0,
    takeDamage,
    applyKnockback,
    update,
    forceRemove: () => {
      scene.remove(group);
      for (const p of projectiles) scene.remove(p.mesh);
      projectiles.length = 0;
      dead = true;
      deathTimer = 0;
    },
  };
}
