import { getCarState } from './car.js';
import { getWorld } from './world.js';

let scene, cam, renderer;

export function initRenderer(canvas) {

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);

  // Camera (interior position)
  cam = new THREE.PerspectiveCamera(80, canvas.clientWidth / Math.max(canvas.clientHeight, 1), 0.05, 300);
  cam.position.set(0, 1.2, 0); // driver eye height
  scene.add(cam);

  resize();
  window.cam = cam;
  window.scene = scene;
}

export function resize() {
  if (!renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  if (cam) {
    cam.aspect = w / Math.max(h, 1);
    cam.updateProjectionMatrix();
  }
}

export function render() {
  if (!renderer || !scene || !cam) return;
  renderer.render(scene, cam);
}

export function getScene() { return scene; }
export function getCamera() { return cam; }
export function getRenderer() { return renderer; }
