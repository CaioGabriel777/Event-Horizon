/**
 * SingularityPass — Manual Screen-Space Gravitational Collapse
 * =============================================================
 * Renders the singularity distortion effect WITHOUT the `postprocessing`
 * EffectComposer, avoiding the color space mutations that degrade nebula
 * and black hole visuals.
 *
 * Architecture:
 *  - Uses `useFrame` with `renderPriority=1` to take over rendering from R3F.
 *  - When INACTIVE (uSuckStrength ≈ 0): calls `gl.render(scene, camera)`
 *    directly — identical to R3F's default path, zero overhead, zero
 *    color interference.
 *  - When ACTIVE: renders the scene to an FBO, then draws a full-screen
 *    quad with the singularity distortion shader. The FBO uses the same
 *    UnsignedByteType / RGBAFormat as the default framebuffer, so colors
 *    match pixel-perfectly across the transition.
 *
 * Visual layers:
 *  1. Quadratic-falloff UV distortion — pulls every pixel toward the
 *     projected center of the black hole in screen space.
 *  2. Radial chromatic aberration — R/B channels separate along the
 *     pull direction, simulating light being torn apart.
 *  3. Hyperspace radial stretch — multi-sample directional motion blur
 *     that transforms point lights into radial speed lines, with a
 *     blue-white Doppler tinge on the edges.
 *  4. Closing vignette — darkness contracts around the pull origin.
 *  5. White flash — screen blows out to pure white when collapse is
 *     near-total (uSuckStrength > 0.92).
 *
 * Animation is frame-rate independent via `1 - Math.pow(0.01, delta)`.
 *
 * Usage (inside <Canvas>, no EffectComposer needed):
 *   <SingularityPass />
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
} from "three";
import { useFrame } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import { useExperienceStore } from "@/store/useExperienceStore";

// ─── Black Hole World Position ──────────────────────────────────────────────
// Must match the constant in SceneManager.tsx (BH_Z = -20) and
// BlackHole.tsx default position prop.
const BLACK_HOLE_POSITION = new Vector3(0, 0, -20);

/** Threshold below which the effect is invisible and we skip the FBO pass */
const ACTIVATION_THRESHOLD = 0.001;

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

  uniform sampler2D tDiffuse;        // Scene rendered to FBO
  uniform float uSuckStrength;       // 0.0 → 1.0 — gravitational pull intensity
  uniform float uVignetteStrength;   // 0.0 → 1.0 — darkness closing in
  uniform float uStretchStrength;    // 0.0 → 1.0 — hyperspace radial stretch
  uniform float uTime;               // Elapsed time (seconds)
  uniform vec2  uCenter;             // Screen-space UV of the black hole center

  void main() {
    vec2 uv = vUv;
    vec2 dir = uv - uCenter;
    float dist = length(dir);

    // ─── Gravitational UV distortion (quadratic falloff) ─────────────
    // Pixels closer to the center are pulled harder; the quadratic term
    // ensures the edges of the screen barely move, preventing ugly
    // border clamping artifacts.
    float pull = uSuckStrength * (1.0 - dist * dist);
    vec2 distortedUv = uCenter + dir * (1.0 - pull);
    distortedUv = clamp(distortedUv, 0.0, 1.0);

    vec4 color = texture2D(tDiffuse, distortedUv);

    // ─── Radial chromatic aberration ─────────────────────────────────
    // Light separating as it is gravitationally pulled — red channel
    // pushed outward, blue channel inward along the radial direction.
    float aberration = uSuckStrength * 0.018 * dist;
    float r = texture2D(tDiffuse, distortedUv + dir * aberration).r;
    float b = texture2D(tDiffuse, distortedUv - dir * aberration).b;
    color.r = r;
    color.b = b;

    // ─── Hyperspace radial stretch ───────────────────────────────────
    // Multi-sample radial motion blur: instead of distorting UVs once,
    // samples the texture N times along the radial direction toward the
    // center and accumulates — transforms point lights into speed lines.
    if (uStretchStrength > 0.001) {
      int SAMPLES = 32;
      vec4 stretched = vec4(0.0);
      float totalWeight = 0.0;

      for (int i = 0; i < 32; i++) {
        float t = float(i) / 31.0;
        // More aggressive pull on final samples — exponential acceleration
        float pullT = t * t * uStretchStrength * 0.55;
        vec2 sampleUv = mix(distortedUv, uCenter, pullT);
        sampleUv = clamp(sampleUv, 0.0, 1.0);

        float weight = exp(-t * 2.5); // Smoother falloff = longer trails
        stretched += texture2D(tDiffuse, sampleUv) * weight;
        totalWeight += weight;
      }
      stretched /= totalWeight;

      // Increase blend — more dominant
      color = mix(color, stretched, uStretchStrength * 0.92);

      // More aggressive brightness boost on trails
      float brightness = 1.0 + uStretchStrength * 2.2;
      color.rgb *= brightness;

      // Cool blue-white Doppler tinge on the edges
      float dopplerEdge = dist * uStretchStrength;
      color.rgb = mix(color.rgb, color.rgb * vec3(0.7, 0.85, 1.4), dopplerEdge * 0.6);
    }

    // ─── Closing vignette ────────────────────────────────────────────
    // Darkness contracts around the center proportional to pull strength.
    float vignette = 1.0 - smoothstep(0.3, 1.0, dist * (1.0 + uVignetteStrength * 2.5));
    color.rgb *= vignette;

    // ─── White flash at total collapse ───────────────────────────────
    // When uSuckStrength crosses ~0.92, the screen blooms to pure white,
    // simulating the final photon burst before oblivion.
    float flash = smoothstep(0.88, 1.0, uSuckStrength);
    color.rgb = mix(color.rgb, vec3(1.0), flash * flash);

    gl_FragColor = color;
  }
`;

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * SingularityPass — R3F render-priority component.
 *
 * Takes over rendering (priority 1) to optionally inject the singularity
 * distortion as a manual FBO → full-screen quad pass.
 * Returns `null` — no JSX output; rendering is handled imperatively.
 */
export function SingularityPass() {
  const fbo = useFBO();
  const currentSuck = useRef(0);
  const currentStretch = useRef(0);
  const loopTriggered = useRef(false);
  const projected = useMemo(() => new Vector3(), []);

  // ─── Full-screen quad setup (isolated Scene + OrthoCamera) ──────────
  const { quadCamera, quadScene, material, geometry } = useMemo(() => {
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new PlaneGeometry(2, 2);
    const mat = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uSuckStrength: { value: 0 },
        uVignetteStrength: { value: 0 },
        uStretchStrength: { value: 0 },
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

  // ─── Cleanup (Three.js resource disposal) ───────────────────────────
  useEffect(() => {
    return () => {
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  // ─── Render Loop (priority 1 = takes over from R3F) ─────────────────
  useFrame(({ gl, scene, camera, clock }, delta) => {
    const phase = useExperienceStore.getState().phase;
    const gravity = useExperienceStore.getState().gravity;
    const isWhiteout = useExperienceStore.getState().isWhiteout;

    // Prevents any triggers or ghost rendering while isWhiteout is active
    if (isWhiteout) {
      console.log(
        "[Singularity] whiteout guard ativo, needsScrollReset:",
        useExperienceStore.getState().needsScrollReset,
        "scrollProgress:",
        useExperienceStore.getState().scrollProgress,
        "loopTriggered:",
        loopTriggered.current
      );
      gl.render(scene, camera);
      return;
    }

    // ─── Suck strength target ──────────────────────────────────────
    // Remap gravity from the singularity phase range (0.9→1.0 scroll,
    // where gravity is already 1.0) into a clean 0→1 ramp.
    // This prevents distortion from leaking into earlier phases where
    // gravity already has non-zero values.
    const suckTarget =
      phase === "singularity" ? Math.min(1.0, (gravity - 0.9) / 0.1) : 0.0;

    // ─── Stretch target ──────────────────────────────────────────
    // Enters slightly before the suck (gravity 0.82 vs 0.9) to create
    // the cinematic acceleration → collapse sequence. Stars stretch
    // into speed lines first, then the suck collapses everything.
    const stretchTarget =
      phase === "singularity" ? Math.min(1.0, (gravity - 0.82) / 0.10) : 0.0;

    // Frame-rate-independent exponential lerp:
    // At 60fps delta≈0.016 → factor≈0.928
    // At 30fps delta≈0.033 → factor≈0.998
    const lerpFactor = 1.0 - Math.pow(0.01, delta);
    currentSuck.current += (suckTarget - currentSuck.current) * lerpFactor;
    // Stretch lerps faster (×2.5) for snappier acceleration feel
    currentStretch.current +=
      (stretchTarget - currentStretch.current) * lerpFactor * 2.5;

    // ─── Seamless Loop Reset ─────────────────────────────────────
    // When the screen is almost entirely white (uSuckStrength >= 0.96),
    // we trigger the reset signal to useScrollPhase.
    if (currentSuck.current >= 0.96 && !loopTriggered.current) {
      loopTriggered.current = true;
      useExperienceStore.getState().setIsWhiteout(true);
      useExperienceStore.getState().setNeedsScrollReset(true);
      useExperienceStore.getState().setGravity(0);
      useExperienceStore.getState().setPhase("traversal");
    }

    const scrollProgress = useExperienceStore.getState().scrollProgress;
    if (!isWhiteout && loopTriggered.current && scrollProgress < 0.05) {
      loopTriggered.current = false; // Ready for the next cycle
    }

    // ─── Inactive path: render normally (zero overhead) ──────────
    // When both effects are negligible, call gl.render directly —
    // identical to R3F's default render, no FBO, no color mutation.
    if (phase !== "singularity") {
      currentSuck.current = 0;
      currentStretch.current = 0;
      material.uniforms.uSuckStrength.value = 0;
      material.uniforms.uStretchStrength.value = 0;
      gl.render(scene, camera);
      return;
    }

    if (
      currentSuck.current < ACTIVATION_THRESHOLD &&
      currentStretch.current < ACTIVATION_THRESHOLD
    ) {
      currentSuck.current = 0;
      currentStretch.current = 0;
      gl.render(scene, camera);
      return;
    }

    // ─── Active path: FBO → distortion quad ──────────────────────

    // Update shader uniforms
    material.uniforms.uSuckStrength.value = currentSuck.current;
    material.uniforms.uVignetteStrength.value = currentSuck.current;
    material.uniforms.uStretchStrength.value = currentStretch.current;
    material.uniforms.uTime.value = clock.getElapsedTime();

    // Project black hole world position → screen UV
    projected.copy(BLACK_HOLE_POSITION).project(camera);
    material.uniforms.uCenter.value.set(
      (projected.x + 1) / 2,
      (projected.y + 1) / 2
    );

    // Pass 1: Render the full scene to the FBO
    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Pass 2: Feed the FBO to the distortion shader and render to screen
    material.uniforms.tDiffuse.value = fbo.texture;
    gl.render(quadScene, quadCamera);
  }, 1);

  return null;
}
