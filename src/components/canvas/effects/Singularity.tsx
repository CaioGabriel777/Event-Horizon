/**
 * SingularityPass — Manual Screen-Space Gravitational Collapse
 * =============================================================
 * Renders the singularity distortion effect by taking over the R3F 
 * render loop (priority=1). It uses a single timer (t: 0.0 -> 1.0) 
 * as the sole source of truth to drive a 4-act cinematic sequence.
 * 
 * Act 1: Relativistic beaming and chromatic aberration
 * Act 2: Spaghettification (radial smear, redshift, dolly-zoom FOV)
 * Act 3: Progressive event-horizon void swallowing the screen
 * Act 4: Smooth fade-in revealing the new universe
 *
 * ENTRY (orbital hand-off): the sequence is now triggered by the
 * useOrbitCamera hook, which sets phase='singularity' and gravity=1.0
 * when the cinematic orbit completes. The `!isOrbitActive` guard below
 * prevents a premature trigger if a violent scroll ever resolves the
 * phase to 'singularity' while the orbit is still running.
 *
 * It communicates with the scroll controller purely by signaling 
 * `shouldResetScroll` via the Zustand store, maintaining strict 
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
import { BLACK_HOLE_POSITION as BH_POS } from "@/lib/constants";

// Derived from the single source of truth in constants.ts.
const BLACK_HOLE_POSITION = new Vector3(...BH_POS);

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
  uniform float uAct2;   // 0→1: Spaghettification (radial smear & redshift)
  uniform float uAct3;   // 0→1: Event horizon expanding void
  uniform float uAct4;   // 0→1: fade-in after reset
  uniform float uTime;
  uniform vec2  uCenter;
  uniform vec2  uResolution;
  uniform sampler2D tDiffuse;

  void main() {
    vec2 uv = vUv;
    vec2 dir = uv - uCenter;

    dir.x *= uResolution.x / uResolution.y;

    float dist = length(dir);

    // ─── Act 1: Chromatic aberration & Relativistic Beaming ─────────
    // Violently separates RGB channels as gravity intensifies
    float aberration = uAct1 * 0.05 * dist;
    float r = texture2D(tDiffuse, uv + dir * aberration).r;
    float g = texture2D(tDiffuse, uv).g;
    float b = texture2D(tDiffuse, uv - dir * aberration).b;
    vec4 color = vec4(r, g, b, 1.0);

    // ─── Act 2: Spaghettification (Radial Smear & Redshift) ──────────
    if (uAct2 > 0.001) {
      // 1. Extreme Gravitational Pinch (Pulls UVs towards the center)
      float pinch = pow(dist, 0.4) * uAct2 * 1.5;
      vec2 baseUv = uCenter + dir * (1.0 - pinch);

      // 2. Radial Motion Blur (Violently blurs light inward)
      vec4 smudgedColor = vec4(0.0);
      const float SAMPLES = 20.0;
      for(float i = 0.0; i < SAMPLES; i++) {
        float scale = 1.0 - (i / SAMPLES) * uAct2 * 0.5;
        vec2 sampleUv = uCenter + (baseUv - uCenter) * scale;
        smudgedColor += texture2D(tDiffuse, sampleUv);
      }
      color = mix(color, smudgedColor / SAMPLES, uAct2);

      // 3. Redshift / Heat Death
      // As light falls into the hole, it loses energy and shifts to dark orange/red
      vec3 redshift = vec3(1.2, 0.3, 0.02); 
      float heat = smoothstep(0.0, 0.8, uAct2) * (1.0 - dist);
      color.rgb += redshift * heat * uAct2 * 1.5;
    }

    // ─── Act 3: Event Horizon Collapse (Absolute Black) ────────
    // A sphere of absolute darkness growing from the center, swallowing the screen
    float voidRadius = uAct3 * 1.5; // Grows beyond monitor edges
    float swallow = smoothstep(voidRadius, voidRadius + 0.15, dist);
    
    float angle = atan(dir.y, dir.x);
    float plasmaTurbulence = sin(angle * 20.0 + uTime * 15.0) * 0.02;

    // Creates a superheated ring of fire at the exact edge of the void
    float ringGlow = smoothstep(voidRadius - 0.05, voidRadius + 0.1, dist) * smoothstep(voidRadius + 0.2, voidRadius + 0.05, dist);
    color.rgb += vec3(1.0, 0.2, 0.0) * ringGlow * uAct3 * 2.5;

    // Multiply screen by the encroaching darkness
    color.rgb *= swallow;

    // ─── Act 4: Fade in after reset ──────────────────────────────
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
  // Act 6: instead of looping back to traversal, FREEZE on black and hand
  // off to the Epilogue. The scene stays dark; the Epilogue component
  // (driven by isEpilogue) types Earth's transmission, then offers reload.
  store.setIsEpilogue(true);
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
        uResolution: { value: new Vector2(1, 1) },
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
    // Normal entry: useOrbitCamera completes its 12s approach and sets
    // phase='singularity' + gravity=1.0 — this condition fires on the
    // very same frame (this callback runs at priority 1, after the
    // orbit's priority-0 callback).
    // The !isOrbitActive guard prevents premature entry if a violent
    // scroll jump ever resolves phase='singularity' mid-orbit.
    if (
      state.phase === 'singularity' &&
      state.gravity >= 0.92 &&
      !state.isOrbitActive &&
      !isRunning.current &&
      !hasReset.current  // Prevents re-entry during the current cycle
    ) {
      isRunning.current = true;
      hasReset.current = false;
      timerRef.current = 0;
      // Defensive orientation lock: regardless of how the orbit hand-off
      // resolved (frame races, large deltas), the collapse sequence and
      // its dolly-zoom assume the camera is centered on the black hole.
      // Lock it here, once, on the engagement frame.
      camera.lookAt(BLACK_HOLE_POSITION);
      useExperienceStore.getState().setIsSingularityActive(true);
      console.log("[Singularity] Sequence engaged — 4-act collapse timeline started");
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
      useExperienceStore.getState().resetLore();
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
    material.uniforms.uResolution.value.set(gl.domElement.width, gl.domElement.height);

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