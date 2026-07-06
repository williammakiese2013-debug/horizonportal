// scene.js
// Étape 1/N : mise en place du "moteur" minimal — scène, caméra, renderer,
// lumières et sol. La ville sera ajoutée par-dessus dans city.js.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.SKY_COLOR);
  scene.fog = new THREE.Fog(CONFIG.FOG_COLOR, CONFIG.FOG_NEAR, CONFIG.FOG_FAR);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
  );
  // Position de départ : au-dessus des rues, vue "survol" pour bien voir la ville
  camera.position.set(0, 90, 220);
  return camera;
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function addLights(scene, isTouchDevice) {
  // Lumière ambiante douce pour ne pas avoir de noirs totaux
  const ambient = new THREE.AmbientLight(0x445066, 0.6);
  scene.add(ambient);

  // Lumière directionnelle principale : joue le rôle du soleil le jour et
  // de la lune la nuit (couleur/intensité/position pilotées par dayNight.js)
  const sun = new THREE.DirectionalLight(0xaeb8ff, 0.9);
  sun.position.set(-300, 400, -200);
  sun.castShadow = true;
  const shadowRes = isTouchDevice ? 1024 : 4096;
  sun.shadow.mapSize.set(shadowRes, shadowRes);
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  scene.add(sun.target);

  // Lumière d'appoint façon ciel/sol (aussi pilotée par dayNight.js)
  const hemi = new THREE.HemisphereLight(0x2a2f3a, 0x1a1206, 0.5);
  scene.add(hemi);

  return { ambient, sun, hemi };
}

export function createGround(scene) {
  const size = 4000;
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshStandardMaterial({
    color: 0x14161c,
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

export function handleResize(camera, renderer, composer) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });
}
