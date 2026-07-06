// webEffects.js
// Étape 5/N : rendu visuel réaliste de la toile.
// - Plusieurs "brins" courbés (affaissement + ondulation différents pour
//   chacun) reliés par de petits fils croisés, façon corde tissée.
// - Un impact en étoile (splat) sur l'immeuble à l'endroit de l'accroche.
// - Une petite traînée de particules au moment du tir.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createWebRope(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const material = new THREE.LineBasicMaterial({
    color: CONFIG.WEB_COLOR,
    transparent: true,
    opacity: 0.85,
  });

  const strands = [];
  for (let i = 0; i < CONFIG.WEB_STRAND_COUNT; i++) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      new Array(CONFIG.WEB_STRAND_SEGMENTS).fill(new THREE.Vector3())
    );
    const line = new THREE.Line(geometry, material);
    group.add(line);
    strands.push(line);
  }

  // Petits fils qui relient le brin central et un brin latéral, pour un effet "tissé"
  const rungGeometry = new THREE.BufferGeometry();
  rungGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(CONFIG.WEB_RUNG_COUNT * 2 * 3), 3)
  );
  const rungs = new THREE.LineSegments(rungGeometry, material);
  group.add(rungs);

  const tmpUp = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpMid = new THREE.Vector3();
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  );

  const strandPointsCache = strands.map(() =>
    new Array(CONFIG.WEB_STRAND_SEGMENTS).fill(null).map(() => new THREE.Vector3())
  );

  function update(start, end) {
    tmpDir.subVectors(end, start).normalize();
    tmpRight.crossVectors(tmpDir, tmpUp);
    if (tmpRight.lengthSq() < 1e-6) tmpRight.set(1, 0, 0);
    tmpRight.normalize();

    const dist = start.distanceTo(end);
    const sagBase = Math.min(dist * CONFIG.WEB_SAG_FACTOR, CONFIG.WEB_MAX_SAG);

    for (let s = 0; s < CONFIG.WEB_STRAND_COUNT; s++) {
      const sag = sagBase * CONFIG.WEB_STRAND_SAG_MULT[s];
      tmpMid.addVectors(start, end).multiplyScalar(0.5);
      tmpMid.y -= sag;

      curve.v0.copy(start);
      curve.v1.copy(tmpMid);
      curve.v2.copy(end);

      const ampl = CONFIG.WEB_STRAND_LATERAL_AMPL[s];
      const freq = CONFIG.WEB_STRAND_LATERAL_FREQ[s];
      const pts = strandPointsCache[s];

      for (let i = 0; i < CONFIG.WEB_STRAND_SEGMENTS; i++) {
        const t = i / (CONFIG.WEB_STRAND_SEGMENTS - 1);
        curve.getPoint(t, pts[i]);
        if (ampl !== 0) {
          const lateral = ampl * Math.sin(t * Math.PI * freq);
          pts[i].addScaledVector(tmpRight, lateral);
        }
      }
      strands[s].geometry.setFromPoints(pts);
    }

    // Fils croisés entre le brin central (0) et un brin latéral (2)
    const rungPositions = rungs.geometry.attributes.position.array;
    const a = strandPointsCache[0];
    const b = strandPointsCache[CONFIG.WEB_STRAND_COUNT - 1];
    const step = Math.floor(CONFIG.WEB_STRAND_SEGMENTS / (CONFIG.WEB_RUNG_COUNT + 1));
    for (let r = 0; r < CONFIG.WEB_RUNG_COUNT; r++) {
      const idx = Math.min(step * (r + 1), CONFIG.WEB_STRAND_SEGMENTS - 1);
      const o = r * 6;
      rungPositions[o] = a[idx].x;
      rungPositions[o + 1] = a[idx].y;
      rungPositions[o + 2] = a[idx].z;
      rungPositions[o + 3] = b[idx].x;
      rungPositions[o + 4] = b[idx].y;
      rungPositions[o + 5] = b[idx].z;
    }
    rungs.geometry.attributes.position.needsUpdate = true;
  }

  return {
    group,
    show() {
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    update,
  };
}

export function createWebEffects(scene) {
  const splats = [];
  const shots = [];

  // --- Particules continues le long de la toile pendant le swing ---
  const swingCount = CONFIG.WEB_SWING_PARTICLE_COUNT;
  const swingPositions = new Float32Array(swingCount * 3);
  const swingGeometry = new THREE.BufferGeometry();
  swingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(swingPositions, 3));
  const swingMaterial = new THREE.PointsMaterial({
    color: CONFIG.WEB_COLOR,
    size: CONFIG.WEB_SWING_PARTICLE_SIZE,
    transparent: true,
    opacity: 0.7,
  });
  const swingPoints = new THREE.Points(swingGeometry, swingMaterial);
  swingPoints.visible = false;
  scene.add(swingPoints);

  function updateSwingTrail(active, start, end) {
    swingPoints.visible = active;
    if (!active) return;
    const jitter = CONFIG.WEB_SWING_PARTICLE_JITTER;
    for (let i = 0; i < swingCount; i++) {
      const t = i / (swingCount - 1);
      const x = THREE.MathUtils.lerp(start.x, end.x, t) + (Math.random() - 0.5) * jitter;
      const y = THREE.MathUtils.lerp(start.y, end.y, t) + (Math.random() - 0.5) * jitter;
      const z = THREE.MathUtils.lerp(start.z, end.z, t) + (Math.random() - 0.5) * jitter;
      swingPositions[i * 3] = x;
      swingPositions[i * 3 + 1] = y;
      swingPositions[i * 3 + 2] = z;
    }
    swingGeometry.attributes.position.needsUpdate = true;
  }

  function spawnSplat(point, normal) {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({
      color: CONFIG.WEB_COLOR,
      transparent: true,
      opacity: 0.9,
    });

    const spokeCount = CONFIG.WEB_SPLAT_SPOKES;
    const radius = CONFIG.WEB_SPLAT_RADIUS * (0.8 + Math.random() * 0.4);

    // Rayons partant du centre
    const spokePositions = [];
    for (let i = 0; i < spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2 + Math.random() * 0.2;
      spokePositions.push(0, 0, 0, Math.cos(a) * radius, Math.sin(a) * radius, 0);
    }
    const spokeGeo = new THREE.BufferGeometry();
    spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokePositions, 3));
    group.add(new THREE.LineSegments(spokeGeo, material));

    // Deux anneaux concentriques reliant les rayons, façon vraie toile d'araignée
    [0.45, 0.8].forEach((ringFactor) => {
      const ringPts = [];
      for (let i = 0; i <= spokeCount; i++) {
        const a = (i / spokeCount) * Math.PI * 2;
        ringPts.push(
          new THREE.Vector3(Math.cos(a) * radius * ringFactor, Math.sin(a) * radius * ringFactor, 0)
        );
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      group.add(new THREE.Line(ringGeo, material));
    });

    // Oriente le splat pour qu'il "colle" à la surface visée
    group.position.copy(point).addScaledVector(normal, 0.03);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal.clone().normalize()
    );
    group.quaternion.copy(quat);
    group.rotateZ(Math.random() * Math.PI * 2);

    scene.add(group);
    splats.push({ group, material, age: 0 });
  }

  function spawnShotTrail(start, end) {
    const positions = new Float32Array(CONFIG.WEB_SHOT_PARTICLES * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: CONFIG.WEB_COLOR,
      size: 0.12,
      transparent: true,
      opacity: 0.95,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    shots.push({ points, material, start: start.clone(), end: end.clone(), age: 0 });
  }

  function update(delta) {
    for (let i = splats.length - 1; i >= 0; i--) {
      const s = splats[i];
      s.age += delta;
      const life = s.age / CONFIG.WEB_SPLAT_LIFETIME;
      s.material.opacity = Math.max(0, 0.9 * (1 - life));
      if (life >= 1) {
        scene.remove(s.group);
        splats.splice(i, 1);
      }
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.age += delta;
      const t = Math.min(shot.age / CONFIG.WEB_SHOT_DURATION, 1);
      const positions = shot.points.geometry.attributes.position.array;
      for (let p = 0; p < CONFIG.WEB_SHOT_PARTICLES; p++) {
        const particleT = Math.min(t + p * 0.03, 1);
        const x = THREE.MathUtils.lerp(shot.start.x, shot.end.x, particleT);
        const y = THREE.MathUtils.lerp(shot.start.y, shot.end.y, particleT);
        const z = THREE.MathUtils.lerp(shot.start.z, shot.end.z, particleT);
        positions[p * 3] = x;
        positions[p * 3 + 1] = y;
        positions[p * 3 + 2] = z;
      }
      shot.points.geometry.attributes.position.needsUpdate = true;
      shot.material.opacity = 0.95 * (1 - t);
      if (t >= 1) {
        scene.remove(shot.points);
        shots.splice(i, 1);
      }
    }
  }

  return { spawnSplat, spawnShotTrail, updateSwingTrail, update };
}
