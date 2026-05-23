/**
 * Experience — The Heart of Event Horizon
 * ========================================
 * Main Canvas wrapper with DepthOfField blur for the cinematic
 * home-state → reveal transition.
 *
 * POST-PROCESSING BLUR SYSTEM:
 * At scroll=0 (home), a heavy DOF blur is applied so the nebula
 * is visible but soft, putting focus on UI text. As the user scrolls
 * (0→0.15), the blur fades to 0, revealing the nebula in full clarity.
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
import { StarField } from "./objects/StarField";
import { useExperienceStore } from "@/store/useExperienceStore";
import { CAMERA, SCROLL, SHADER, PERFORMANCE } from "@/lib/constants";
import { clamp } from "@/lib/math";

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
      {/* Chromatic Aberration */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={chromaticOffset}
        radialModulation={true}
        modulationOffset={0.5}
      />

      {/* Bloom — for accretion disk + nebula glow */}
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
        <color attach="background" args={["#030308"]} />
        <fog attach="fog" args={["#030308", 40, 150]} />
        <StarField />

        <Suspense fallback={<LoadingFallback />}>
          <ScrollControls
            pages={SCROLL.pages}
            damping={SCROLL.damping}
            eps={SCROLL.eps}
          >
            <SceneManager />
          </ScrollControls>
        </Suspense>

        <PostProcessingPipeline />
      </Canvas>
    </div>
  );
}
