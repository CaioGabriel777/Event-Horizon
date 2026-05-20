/**
 * Experience — The Heart of Event Horizon
 * ========================================
 * Main Canvas wrapper that encapsulates:
 * - R3F Canvas with adaptive DPR
 * - ScrollControls for scroll-based navigation
 * - EffectComposer with gravitational lensing pipeline
 * - SceneManager for phase orchestration
 *
 * This is a Client Component (requires browser APIs).
 * Imported via `next/dynamic` with `ssr: false` in page.tsx.
 *
 * PERFORMANCE ARCHITECTURE:
 * - dpr={[1, 2]} with R3F's built-in performance regression
 * - gl config optimized (no antialias, no stencil)
 * - Post-processing replaces native antialias
 * - EffectComposer multisampling disabled (effects handle quality)
 */

"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ScrollControls } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Vector2 } from "three";

import { SceneManager } from "./SceneManager";
import { useExperienceStore } from "@/store/useExperienceStore";
import { CAMERA, SCROLL, SHADER, PERFORMANCE } from "@/lib/constants";

// ─── Adaptive Post-Processing Pipeline ──────────────────────────────────────

function PostProcessingPipeline() {
  const gravity = useExperienceStore((s) => s.gravity);

  // Chromatic aberration scales with gravity
  const chromaticOffset = new Vector2(
    gravity * SHADER.chromaticMaxOffset,
    gravity * SHADER.chromaticMaxOffset * 0.5
  );

  return (
    <EffectComposer multisampling={0}>
      {/* Chromatic Aberration — subtle at low gravity, intense at high */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={chromaticOffset}
        radialModulation={true}
        modulationOffset={0.5}
      />

      {/* Bloom — for accretion disk glow */}
      <Bloom
        intensity={SHADER.bloomIntensity * (0.5 + gravity * 0.5)}
        luminanceThreshold={SHADER.bloomThreshold}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
    </EffectComposer>
  );
}

// ─── Loading Fallback ───────────────────────────────────────────────────────

function LoadingFallback() {
  return (
    <mesh>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#030308" />
    </mesh>
  );
}

// ─── Main Experience Component ──────────────────────────────────────────────

export function Experience() {
  return (
    <div className="fixed inset-0 w-full h-full" id="experience-canvas">
      <Canvas
        dpr={PERFORMANCE.dprRange}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{
          fov: CAMERA.fov,
          near: CAMERA.near,
          far: CAMERA.far,
          position: CAMERA.initialPosition,
        }}
        performance={{ min: 0.5 }}
      >
        {/* Deep space background */}
        <color attach="background" args={["#030308"]} />

        {/* Fog for depth */}
        <fog attach="fog" args={["#030308", 30, 150]} />

        <Suspense fallback={<LoadingFallback />}>
          {/* Scroll-driven experience — 6 pages of scroll */}
          <ScrollControls
            pages={SCROLL.pages}
            damping={SCROLL.damping}
            eps={SCROLL.eps}
          >
            <SceneManager />
          </ScrollControls>
        </Suspense>

        {/* Post-processing pipeline */}
        <PostProcessingPipeline />
      </Canvas>
    </div>
  );
}
