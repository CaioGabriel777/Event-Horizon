/**
 * SingularityPass — Manual Screen-Space Gravitational Collapse
 * =============================================================
 * Renders the singularity distortion effect by taking over the R3F 
 * render loop (priority=1). It uses a single timer (t: 0.0 -> 1.0) 
 * as the sole source of truth to drive a 4-act cinematic sequence.
 * 
 * Act 1: Relativistic beaming and chromatic aberration
 * Act 2: Radial stretch, speed lines, and extreme FOV stretching
 * Act 3: Progressive bottom-to-top vignette dissolution into black
 * Act 4: Smooth fade-in revealing the new universe
 *
 * It communicates with the scroll controller purely by signaling 
 * \`shouldResetScroll\` via the Zustand store, maintaining strict 
 * separation of concerns between DOM manipulation and GPU rendering.
 */

"use client";

import { useRef, useMemo, useEffect } from "react";
import {
  ShaderMaterial,
  OrthographicCamera,
  Scene,
  Mesh,
  PlaneGeometry,
  Vector2,
  Vector3,
  MathUtils,
  PerspectiveCamera
} from "three";
import { useFrame } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import { useExperienceStore } from "@/store/useExperienceStore";

const BLACK_HOLE_POSITION = new Vector3(0, 0, -20);

// ─── Vertex Shader (full-screen quad) ───────────────────────────────────────
const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Fragment Shader (singularity distortion) ───────────────────────────────
const fragmentShader = /* glsl */ `
  varying vec2 vUv;

  uniform float uAct1;   // 0→1: relativistic beaming, chromatic aberration
  uniform float uAct2;   // 0→1: radial stretch, speed lines, FOV
  uniform float uAct3;   // 0→1: progressive dissolution to black
  uniform float uAct4;   // 0→1: fade-in after reset
  uniform float uTime;
  uniform vec2  uCenter;
  uniform sampler2D tDiffuse;

  void main() {
    vec2 uv = vUv;
    vec2 dir = uv - uCenter;
    float dist = length(dir);

    // ─── Act 1: Chromatic aberration & slight distortion ─────────
    float aberration = uAct1 * 0.04 * dist;
    float r = texture2D(tDiffuse, uv + dir * aberration).r;
    float b = texture2D(tDiffuse, uv - dir * aberration).b;
    vec4 color = texture2D(tDiffuse, uv);
    color.r = mix(color.r, r, uAct1);
    color.b = mix(color.b, b, uAct1);

    // ─── Act 2: Radial stretch & procedural speed lines ──────────
    if (uAct2 > 0.001) {
      // Gravitational distortion
      float pull = uAct2 * (1.0 - dist * dist) * 0.85;
      vec2 distortedUv = uCenter + dir * (1.0 - pull);
      distortedUv = clamp(distortedUv, 0.0, 1.0);
      color = mix(color, texture2D(tDiffuse, distortedUv), uAct2);

      // Procedural speed lines
      float angle = atan(dir.y, dir.x);
      float slices = 120.0;
      float sliceId = floor(angle / (6.28318 / slices));
      float hash = fract(sin(sliceId * 127.1 + 311.7) * 43758.5453);
      float sliceCenter = (sliceId + 0.5) * (6.28318 / slices);
      float angleDist = abs(mod(angle - sliceCenter + 3.14159, 6.28318) - 3.14159);
      float streak = smoothstep(0.025, 0.0, angleDist) * (0.4 + hash * 0.6);
      float radialFade = smoothstep(0.0, 0.18, dist) * smoothstep(0.9, 0.5, dist);
      vec3 streakColor = mix(vec3(1.0), vec3(0.4, 0.8, 1.0), dist * 1.5);
      color.rgb += streakColor * streak * radialFade * uAct2 * 3.5;
    }

    // ─── Act 3: Progressive dissolution to absolute black ────────
    // Darkens from bottom to top 
    float dissolveY = smoothstep(
      1.0 - uAct3 * 1.4,   // dissolution line drops from above
      1.0 - uAct3 * 0.8,
      uv.y
    );
    float dissolve = mix(1.0 - uAct3 * 0.6, 1.0, dissolveY);
    color.rgb *= dissolve;

    // Additional radial darkening in act 3
    float vigAct3 = 1.0 - uAct3 * smoothstep(0.2, 0.8, dist);
    color.rgb *= vigAct3;

    // ─── Act 4: Fade in after reset ──────────────────────────────
    // The screen was black — smoothly reveals the new universe
    color.rgb *= uAct4;

    gl_FragColor = color;
  }
`;

/**
 * Signals the store to reset scroll and physics state.
 * The FOV will be naturally interpolated back by the timeline (Act 4).
 */
function executeAtomicReset() {
  const store = useExperienceStore.getState();
  store.setShouldResetScroll(true);  // signals useScrollPhase
  store.setGravity(0);
  store.setPhase('traversal');
  store.setSingularityProgress(0);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function SingularityPass() {
  const fbo = useFBO();
  const timerRef = useRef(0);         // 0.0 → 1.0 timeline
  const isRunning = useRef(false);    // is the sequence active?
  const hasReset = useRef(false);     // has the atomic reset been executed?
  const projected = useMemo(() => new Vector3(), []);

  // ─── Full-screen quad setup (isolated Scene + OrthoCamera) ──────────
  const { quadCamera, quadScene, material, geometry } = useMemo(() => {
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new PlaneGeometry(2, 2);
    const mat = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uAct1: { value: 0 },
        uAct2: { value: 0 },
        uAct3: { value: 0 },
        uAct4: { value: 0 },
        uTime: { value: 0 },
        uCenter: { value: new Vector2(0.5, 0.5) },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(geo, mat);
    const scn = new Scene();
    scn.add(mesh);
    return { quadCamera: cam, quadScene: scn, material: mat, geometry: geo };
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  useFrame(({ gl, scene, camera, clock }, delta) => {
    const state = useExperienceStore.getState();

    // ─── Entry Detection ──────────────────────────────────────────────
    // Triggers only if not running and singularity phase is reached
    if (
      state.phase === 'singularity' &&
      state.gravity >= 0.92 &&
      !isRunning.current &&
      !hasReset.current  // Prevents re-entry during the current cycle
    ) {
      isRunning.current = true;
      hasReset.current = false;
      timerRef.current = 0;
      useExperienceStore.getState().setIsSingularityActive(true);
    }

    // ─── Inactive Path ────────────────────────────────────────────────
    // Renders directly to screen, matching R3F default zero-overhead render
    if (!isRunning.current) {
      gl.render(scene, camera);
      return;
    }

    // ─── Advance Timeline (Total duration: 1.5 seconds) ───────────────
    const DURATION = 1.5;
    timerRef.current = Math.min(1.0, timerRef.current + delta / DURATION);
    const t = timerRef.current;

    // Broadcast current progress for UI overlays
    useExperienceStore.getState().setSingularityProgress(t);

    // ─── Mid-Darkness Atomic Reset (t = 0.82) ─────────────────────────
    // Screen is completely pitch black — perfectly hides the state reset
    if (t >= 0.82 && !hasReset.current) {
      hasReset.current = true;
      executeAtomicReset();
    }

    // ─── Timeline Complete ────────────────────────────────────────────
    if (t >= 1.0) {
      isRunning.current = false;
      hasReset.current = false; // Only reset the guard when cycle completes
      timerRef.current = 0;
      useExperienceStore.getState().setIsSingularityActive(false);
      useExperienceStore.getState().setSingularityProgress(0);
      gl.render(scene, camera);
      return;
    }

    // ─── Derive GPU Uniforms from Timeline 't' ────────────────────────

    const isPostReset = t >= 0.82;

    // Act 1: Relativistic beaming & aberration (t: 0.0 → 0.25)
    const act1 = isPostReset ? 0.0 : smoothstep(0.0, 0.25, t);

    // Act 2: Spaghettification & FOV (t: 0.20 → 0.55)
    const act2 = isPostReset ? 0.0 : smoothstep(0.20, 0.55, t);

    // Act 3: Dissolution to pitch black (t: 0.50 → 0.80)
    const act3 = isPostReset ? 0.0 : smoothstep(0.50, 0.80, t);

    // Act 4: Fade in after reset (t: 0.85 → 1.0)
    // Pre-reset: keep it at 1.0 so the scene is visible!
    // Post-reset: starts at 0.0 and fades to 1.0 to reveal the new universe.
    const act4 = isPostReset ? smoothstep(0.85, 1.0, t) : 1.0;

    // FOV stretching — extreme camera zoom IN (dolly zoom into the black hole)
    const targetFov = MathUtils.lerp(75, 25, act2);
    const pCam = camera as PerspectiveCamera;
    if (Math.abs(pCam.fov - targetFov) > 0.1) {
      pCam.fov = targetFov;
      pCam.updateProjectionMatrix();
    }

    material.uniforms.uAct1.value = act1;
    material.uniforms.uAct2.value = act2;
    material.uniforms.uAct3.value = act3;
    material.uniforms.uAct4.value = act4;
    material.uniforms.uTime.value = clock.getElapsedTime();

    // Project black hole world position to screen UV
    projected.copy(BLACK_HOLE_POSITION).project(camera);
    material.uniforms.uCenter.value.set(
      (projected.x + 1) / 2,
      (projected.y + 1) / 2
    );

    // ─── FBO to Quad Render Pass ──────────────────────────────────────
    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    material.uniforms.tDiffuse.value = fbo.texture;
    gl.render(quadScene, quadCamera);
  }, 1);

  return null;
}
