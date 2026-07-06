// postFxShader.js
// Petit shader de "finition" cinématique appliqué en dernière passe du
// rendu : vignette douce, grain filmique animé et une pointe d'aberration
// chromatique sur les bords — pour donner un rendu plus "AAA" à la scène,
// en plus du bloom déjà présent sur les lumières vives.

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function createPostFxPass() {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      time: { value: 0 },
      vignetteStrength: { value: 0.32 },
      grainStrength: { value: 0.035 },
      aberration: { value: 0.0022 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float time;
      uniform float vignetteStrength;
      uniform float grainStrength;
      uniform float aberration;
      varying vec2 vUv;

      float noise(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233)) + time * 24.0) * 43758.5453);
      }

      void main() {
        vec2 centered = vUv - 0.5;

        // Légère aberration chromatique : on décale un peu le rouge et le bleu
        // radialement, plus fort vers les bords de l'écran.
        float dist = length(centered);
        vec2 dir = centered * aberration * dist;
        float r = texture2D(tDiffuse, vUv - dir).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv + dir).b;
        vec3 color = vec3(r, g, b);

        // Vignette douce (assombrit les bords, concentre le regard au centre)
        float vignette = smoothstep(0.85, 0.15, dist);
        color *= mix(1.0 - vignetteStrength, 1.0, vignette);

        // Grain filmique animé, discret
        float grain = (noise(vUv * vec2(1920.0, 1080.0)) - 0.5) * grainStrength;
        color += grain;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}
