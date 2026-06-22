/**
 * Experience — The Heart of Event Horizon
 * ========================================
 * Main Canvas wrapper handling WebGL initialization, rendering, and
 * cinematic scroll synchronization.
 *
 * OPTIMISTIC BOOT SYSTEM:
 * Canvas mounts with opacity 0 and a pessimistic DPR (e.g., 0.75).
 * Shaders are synchronously compiled on frame 0, and the canvas
 * is faded in only after compilation is complete, providing a 
 * seamless, stutter-free entry into the experience.
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
import { SingularityPass } from "./effects/Singularity";
import { StarField } from "./objects/StarField";
import { useExperienceStore } from "@/store/useExperienceStore";
import { CAMERA, SCROLL, SHADER, PERFORMANCE } from "@/lib/constants";
import { detectGpuProfile } from "@/lib/gpuProfile";
import { Stats } from "@react-three/drei";
import { HelmetHUD } from "../ui/HelmetHUD";

// ─── Adaptive Post-Processing Pipeline ──────────────────────────────────────
// NOTE: Disabled — Bloom + ChromaticAberration degrade nebula and black hole
// colors. Kept here for future tuning.

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

import { Loader } from "@react-three/drei";

export function Experience() {
  const dpr = useExperienceStore((s) => s.dpr);
  const isReady = useExperienceStore((s) => s.isReady);

  return (
    <div
      className="fixed inset-0 w-full h-full"
      id="experience-canvas"
      style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s ease' }}
    >
      <HelmetHUD />

      <Canvas
        dpr={dpr}
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
        frameloop="always"
        onCreated={({ gl, scene, camera }) => {
          gl.compile(scene, camera);

          // Detect GPU tier on first frame and store globally
          const profile = detectGpuProfile(gl.getContext() as WebGL2RenderingContext);
          useExperienceStore.getState().setGpuProfile(profile);
          console.log(`[Experience] GPU profile set to: ${profile}`);
        }}
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

        {/* <PostProcessingPipeline /> */}
        <SingularityPass />
      </Canvas>
    </div>
  );
}
