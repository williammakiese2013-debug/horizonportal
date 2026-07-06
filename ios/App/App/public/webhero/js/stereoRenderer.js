// stereoRenderer.js
// Rendu stéréoscopique Cardboard (Side-by-Side) : deux PerspectiveCamera
// (gauche/droite) décalées de l'IPD, chacune rendue dans un
// WebGLRenderTarget, puis compositées en un seul pass plein écran qui
// applique la distorsion en barillet (k1, k2) pour compenser les lentilles
// physiques du viewer.
//
// Constantes physiques (exactes, décodées du profil du viewer) : voir
// CONFIG.CARDBOARD dans config.js.
//
// HYPOTHÈSES EXPLICITES (à ajuster si besoin, aucune n'est cachée) :
//  - IPD / EYE_OFFSET (±0.032) : utilisé directement comme décalage latéral
//    des deux caméras le long de l'axe local X de la caméra principale —
//    c'est la partie sans ambiguïté de la stéréoscopie.
//  - SCREEN_TO_LENS_DISTANCE (0.050) : nom exact conservé, mais tel quel
//    cette valeur seule ne suffit pas à dériver un FOV par œil sans la
//    largeur physique de l'écran (non fournie) — elle n'est donc PAS
//    utilisée pour changer le FOV des caméras ici afin de ne pas fabriquer
//    un chiffre invérifiable. Le FOV par œil reste celui de la caméra
//    principale (scene.js), avec juste l'aspect ratio recalculé pour un
//    demi-canevas.
//  - TRAY_TO_LENS_CENTER (0.035) : utilisé comme fraction normalisée du
//    décalage vertical du centre optique de la distorsion (le "Tray-to-Lens
//    -Center Alignment" du profil décodé) — ré-ajustable via
//    CONFIG.CARDBOARD.TRAY_TO_LENS_CENTER si le viewer réel donne un rendu
//    trop/trop peu décalé.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Distorsion en barillet identique dans son principe à celle du SDK
// Cardboard : pour chaque pixel de sortie (ce que l'œil verra à travers la
// lentille), on calcule d'où échantillonner dans la texture rendue à plat,
// via p' = p * (1 + k1*r^2 + k2*r^4), centré sur l'axe optique de la lentille.
const fragmentShader = `
  precision highp float;
  uniform sampler2D leftMap;
  uniform sampler2D rightMap;
  uniform float k1;
  uniform float k2;
  uniform float lensCenterOffsetY;
  varying vec2 vUv;

  vec2 barrelDistort(vec2 uv) {
    vec2 c = uv * 2.0 - 1.0;      // -1..1 centré sur le viewport de l'œil
    c.y -= lensCenterOffsetY;     // recentre sur l'axe optique réel de la lentille
    float r2 = dot(c, c);
    vec2 d = c * (1.0 + k1 * r2 + k2 * r2 * r2);
    d.y += lensCenterOffsetY;
    return d * 0.5 + 0.5;
  }

  void main() {
    bool isLeft = vUv.x < 0.5;
    vec2 localUv = isLeft ? vec2(vUv.x * 2.0, vUv.y) : vec2((vUv.x - 0.5) * 2.0, vUv.y);
    vec2 sampleUv = barrelDistort(localUv);

    if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // bord noir hors du disque utile de la lentille
      return;
    }
    gl_FragColor = isLeft ? texture2D(leftMap, sampleUv) : texture2D(rightMap, sampleUv);
  }
`;

export function createCardboardRenderer(renderer, scene, mainCamera) {
  const CB = CONFIG.CARDBOARD;

  const leftCam = mainCamera.clone();
  const rightCam = mainCamera.clone();

  let targetWidth = 0;
  let targetHeight = 0;
  let leftTarget = null;
  let rightTarget = null;

  const uniforms = {
    leftMap: { value: null },
    rightMap: { value: null },
    k1: { value: CB.DISTORTION_K1 },
    k2: { value: CB.DISTORTION_K2 },
    lensCenterOffsetY: { value: CB.TRAY_TO_LENS_CENTER },
  };

  const distortScene = new THREE.Scene();
  const distortCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false })
  );
  distortScene.add(quad);

  const rightAxis = new THREE.Vector3();

  function ensureTargets() {
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const halfW = Math.max(2, Math.floor(w / 2));
    if (halfW === targetWidth && h === targetHeight) return;
    targetWidth = halfW;
    targetHeight = h;
    if (leftTarget) leftTarget.dispose();
    if (rightTarget) rightTarget.dispose();
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    leftTarget = new THREE.WebGLRenderTarget(targetWidth, targetHeight, opts);
    rightTarget = new THREE.WebGLRenderTarget(targetWidth, targetHeight, opts);
  }

  function updateEyeCameras() {
    const aspect = targetWidth / targetHeight;
    rightAxis.set(1, 0, 0).applyQuaternion(mainCamera.quaternion);

    for (const cam of [leftCam, rightCam]) {
      cam.fov = mainCamera.fov;
      cam.near = mainCamera.near;
      cam.far = mainCamera.far;
      cam.aspect = aspect;
      cam.position.copy(mainCamera.position);
      cam.quaternion.copy(mainCamera.quaternion);
    }
    // Décalage IPD exact : -0.032 / +0.032 (moitiés de 0.064) le long de
    // l'axe local X ("droite") de la caméra principale.
    leftCam.position.addScaledVector(rightAxis, -CB.EYE_OFFSET);
    rightCam.position.addScaledVector(rightAxis, CB.EYE_OFFSET);

    leftCam.updateProjectionMatrix();
    rightCam.updateProjectionMatrix();
    leftCam.updateMatrixWorld(true);
    rightCam.updateMatrixWorld(true);
  }

  function render() {
    ensureTargets();
    updateEyeCameras();

    renderer.setRenderTarget(leftTarget);
    renderer.clear();
    renderer.render(scene, leftCam);

    renderer.setRenderTarget(rightTarget);
    renderer.clear();
    renderer.render(scene, rightCam);

    renderer.setRenderTarget(null);
    uniforms.leftMap.value = leftTarget.texture;
    uniforms.rightMap.value = rightTarget.texture;
    renderer.render(distortScene, distortCamera);
  }

  function dispose() {
    if (leftTarget) leftTarget.dispose();
    if (rightTarget) rightTarget.dispose();
    quad.material.dispose();
    quad.geometry.dispose();
  }

  return { render, dispose };
}
