import { getScene } from './renderer.js';

let worldGroup = new THREE.Group();

const CITY_SIZE = 20;
const BLOCK = 8;
const ROAD_W = 3;

// Tree templates (reused)
let treeTemplate = null;

export function initWorld() {
  const scene = getScene();
  if (!scene) return;
  worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Fog
  scene.fog = new THREE.FogExp2(new THREE.Color(0x889999), 0.004);

  generate();
}

function generate() {
  const T = THREE;
  const half = CITY_SIZE * BLOCK;

  // Ground (asphalt)
  const groundMat = new T.MeshStandardMaterial({
    color: 0x333333, roughness: 0.9, metalness: 0.05,
  });
  const ground = new T.Mesh(new T.PlaneGeometry(half * 2, half * 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  worldGroup.add(ground);

  // Roads
  const roadMat = new T.MeshStandardMaterial({ color: 0x444444, roughness: 0.85, metalness: 0 });
  for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
    const rh = new T.Mesh(new T.PlaneGeometry(half * 2, ROAD_W), roadMat);
    rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.01, i * BLOCK);
    worldGroup.add(rh);
    const rv = new T.Mesh(new T.PlaneGeometry(ROAD_W, half * 2), roadMat);
    rv.rotation.x = -Math.PI / 2; rv.position.set(i * BLOCK, 0.01, 0);
    worldGroup.add(rv);
  }

  // Road markings (lane dividers)
  const lineMat = new T.MeshStandardMaterial({ color: 0xcccc66, emissive: 0xcccc66, emissiveIntensity: 0.05 });
  for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
    for (let seg = -CITY_SIZE; seg < CITY_SIZE; seg++) {
      if (seg % 2 === 0) {
        const lh = new T.Mesh(new T.PlaneGeometry(0.12, 1.2), lineMat);
        lh.rotation.x = -Math.PI / 2;
        lh.position.set(i * BLOCK, 0.015, seg * BLOCK + BLOCK / 2);
        worldGroup.add(lh);
      }
    }
  }
  for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
    for (let seg = -CITY_SIZE; seg < CITY_SIZE; seg++) {
      if (seg % 2 === 0) {
        const lv = new T.Mesh(new T.PlaneGeometry(1.2, 0.12), lineMat);
        lv.rotation.x = -Math.PI / 2;
        lv.position.set(seg * BLOCK + BLOCK / 2, 0.015, i * BLOCK);
        worldGroup.add(lv);
      }
    }
  }

  // Buildings + trees
  const hs = [3, 4, 5, 6, 8, 10, 12];
  for (let ix = -CITY_SIZE; ix < CITY_SIZE; ix++) {
    for (let iz = -CITY_SIZE; iz < CITY_SIZE; iz++) {
      const cx = ix * BLOCK + BLOCK / 2;
      const cz = iz * BLOCK + BLOCK / 2;

      // 12% chance of park/trees instead of building
      if (Math.random() < 0.12) {
        // Park: place trees
        for (let t = 0; t < 2 + Math.random() * 3 | 0; t++) {
          const tx = cx + (Math.random() - 0.5) * 4;
          const tz = cz + (Math.random() - 0.5) * 4;
          buildTree(tx, tz, 1 + Math.random() * 0.5);
        }
        continue;
      }

      const height = hs[Math.random() * hs.length | 0];
      const w = 2.5 + Math.random() * 2;
      const d = 2.5 + Math.random() * 2;
      buildBuilding(cx, cz, w, height, d);

      // Tree along the street
      if (Math.random() < 0.3) {
        const side = Math.random() < 0.5;
        const tx = cx + (side ? 0 : (Math.random() - 0.5) * 3);
        const tz = cz + (side ? (Math.random() - 0.5) * 3 : 0);
        buildTree(tx, tz, 0.8 + Math.random() * 0.4);
      }
    }
  }

  // Sidewalks
  const swMat = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.85 });
  for (let ix = -CITY_SIZE; ix < CITY_SIZE; ix++) {
    for (let iz = -CITY_SIZE; iz < CITY_SIZE; iz++) {
      const cx = ix * BLOCK + BLOCK / 2;
      const cz = iz * BLOCK + BLOCK / 2;
      for (let s = -1; s <= 1; s += 2) {
        const sw = new T.Mesh(new T.PlaneGeometry(ROAD_W - 0.3, 1), swMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(cx + s * (BLOCK / 2 - 0.2), 0.02, cz);
        worldGroup.add(sw);
      }
      for (let s = -1; s <= 1; s += 2) {
        const sw = new T.Mesh(new T.PlaneGeometry(1, ROAD_W - 0.3), swMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(cx, 0.02, cz + s * (BLOCK / 2 - 0.2));
        worldGroup.add(sw);
      }
    }
  }

  // Streetlights
  for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
    for (let j = -CITY_SIZE; j <= CITY_SIZE; j++) {
      if (Math.random() < 0.3) continue;
      const x = i * BLOCK + (Math.random() - 0.5) * 2;
      const z = j * BLOCK + (Math.random() - 0.5) * 2;
      buildStreetlight(x, z);
    }
  }
}

function buildBuilding(x, z, w, h, d) {
  const T = THREE;
  const baseColor = new T.Color().setHSL(0.05 + Math.random() * 0.1, 0.05, 0.35 + Math.random() * 0.3);
  const mat = new T.MeshStandardMaterial({ color: baseColor, roughness: 0.6, metalness: 0.05 });

  const body = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  worldGroup.add(body);

  // Roof
  const roofMat = new T.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const roof = new T.Mesh(new T.BoxGeometry(w * 0.98, 0.08, d * 0.98), roofMat);
  roof.position.set(x, h + 0.04, z);
  worldGroup.add(roof);

  // Windows
  const winMat = new T.MeshStandardMaterial({
    color: 0x88bbee, emissive: 0x88bbee, emissiveIntensity: 0.12 + Math.random() * 0.25,
    transparent: true, opacity: 0.5 + Math.random() * 0.4,
  });
  const rows = Math.floor(h / 1.2) + 1;

  // Front/back faces
  const cols = Math.floor(w / 1.5) + 1;
  for (let ci = 0; ci < cols; ci++) {
    for (let ri = 0; ri < rows; ri++) {
      if (Math.random() < 0.25) continue;
      const fx = x + (ci / Math.max(cols - 1, 1) - 0.5) * (w * 0.8);
      const fy = 0.5 + (ri / Math.max(rows - 1, 1)) * (h * 0.75);
      const wf = new T.Mesh(new T.PlaneGeometry(0.5, 0.6), winMat.clone());
      wf.position.set(fx, fy, z + d / 2 + 0.01); worldGroup.add(wf);
      const wb = new T.Mesh(new T.PlaneGeometry(0.5, 0.6), winMat.clone());
      wb.position.set(fx, fy, z - d / 2 - 0.01); wb.rotation.y = Math.PI; worldGroup.add(wb);
    }
  }
  // Side faces
  const cols2 = Math.floor(d / 1.5) + 1;
  for (let ci = 0; ci < cols2; ci++) {
    for (let ri = 0; ri < rows; ri++) {
      if (Math.random() < 0.3) continue;
      const fz2 = z + (ci / Math.max(cols2 - 1, 1) - 0.5) * (d * 0.8);
      const fy2 = 0.5 + (ri / Math.max(rows - 1, 1)) * (h * 0.75);
      const wr = new T.Mesh(new T.PlaneGeometry(0.5, 0.6), winMat.clone());
      wr.position.set(x + w / 2 + 0.01, fy2, fz2); wr.rotation.y = Math.PI / 2; worldGroup.add(wr);
      const wl = new T.Mesh(new T.PlaneGeometry(0.5, 0.6), winMat.clone());
      wl.position.set(x - w / 2 - 0.01, fy2, fz2); wl.rotation.y = -Math.PI / 2; worldGroup.add(wl);
    }
  }
}

function buildTree(x, z, scale) {
  const T = THREE;

  // Trunk
  const trunkMat = new T.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const trunk = new T.Mesh(new T.CylinderGeometry(0.06 * scale, 0.1 * scale, 0.6 * scale, 6), trunkMat);
  trunk.position.set(x, 0.3 * scale, z);
  trunk.castShadow = true;
  worldGroup.add(trunk);

  // Foliage (layered cones)
  const leafMat = new T.MeshStandardMaterial({
    color: new T.Color().setHSL(0.28 + Math.random() * 0.06, 0.4, 0.3 + Math.random() * 0.2),
    roughness: 0.8,
  });
  const layers = 2 + (Math.random() * 2 | 0);
  for (let i = 0; i < layers; i++) {
    const r = (0.4 - i * 0.08) * scale;
    const h = (0.35 - i * 0.05) * scale;
    const cone = new T.Mesh(new T.ConeGeometry(r, h, 6), leafMat);
    cone.position.set(x, 0.6 * scale + i * 0.25 * scale, z);
    cone.castShadow = true;
    worldGroup.add(cone);
  }
}

function buildStreetlight(x, z) {
  const T = THREE;
  const poleMat = new T.MeshStandardMaterial({ color: 0x555555, metalness: 0.5, roughness: 0.4 });
  const lampMat = new T.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffeeaa, emissiveIntensity: 0.5 });

  const pole = new T.Mesh(new T.CylinderGeometry(0.04, 0.06, 0.8, 6), poleMat);
  pole.position.set(x, 0.4, z); pole.castShadow = true;
  worldGroup.add(pole);

  const arm = new T.Mesh(new T.BoxGeometry(0.35, 0.03, 0.03), poleMat);
  arm.position.set(x + 0.2, 0.82, z);
  worldGroup.add(arm);

  const lamp = new T.Mesh(new T.SphereGeometry(0.05, 8, 8), lampMat);
  lamp.position.set(x + 0.4, 0.78, z);
  worldGroup.add(lamp);
}

export function getWorld() { return worldGroup; }
