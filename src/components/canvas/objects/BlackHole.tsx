"use client";

/**
 * Black Hole Component (React Three Fiber)
 * =========================================================================
 * This component is responsible for rendering the Gargantua-style black hole.
 *
 * Architecture & Integration:
 *  1. WASM/Rust Pipeline: Relies on `useGeodesicLUT` to asynchronously
 *     compute the Geodesic Lookup Table via a Rust Web Worker.
 *  2. High-Fidelity Data: The LUT is injected into the shader as an RGBA16F 
 *     (HalfFloat) DataTexture with native LinearFilter for smooth interpolation.
 *  3. Seamless Transition: Initially renders using an analytic RK4 raytracer
 *     (fallback), then atomically switches to the optimized LUT once ready,
 *     preventing any visual glitches or "mixed states".
 *  4. Screen-Space Rendering: Employs a simple PlaneGeometry acting as a 
 *     render quad. The complex relativistic physics and raymarching are
 *     executed entirely within the Fragment Shader.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  ShaderMaterial,
  DoubleSide,
  DataTexture,
  FloatType,
  RGBAFormat,
  NormalBlending,
} from "three";
import { SHADER } from "@/lib/constants";
import { useExperienceStore } from "@/store/useExperienceStore";
import { useGeodesicLUT } from "@/hooks/useGeodesicLUT";

import vertexShader from "@/shaders/blackhole/vertex.glsl";
import fragmentShader from "@/shaders/blackhole/fragment.glsl";

interface BlackHoleProps {
  position?: [number, number, number];
  scale?: number;
}

// Creates an empty 1x1 fallback texture to satisfy the WebGL program
// before the actual Rust LUT is computed and loaded.
function createDummyTexture(): DataTexture {
  const tex = new DataTexture(
    new Float32Array([0, 0, 0, 0]),
    1, 1,
    RGBAFormat,
    FloatType
  );
  tex.needsUpdate = true;
  return tex;
}

export function BlackHole({
  position = [0, 0, -20],
  scale = 12,
}: BlackHoleProps) {
  const materialRef = useRef<ShaderMaterial>(null!);

  const gravity = useExperienceStore((s) => s.gravity);
  const scrollProgress = useExperienceStore((s: any) => s.scrollProgress);

  const { texture: lutTexture } = useGeodesicLUT();

  const dummyTex = useMemo(() => createDummyTexture(), []);

  // Initialize shader uniforms. These are kept stable via useMemo.
  // The 'uUseLUT' flag acts as the switch between the RK4 and LUT pathways.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMass: { value: 0.8 },
      uGravity: { value: 0 },
      uBlackHolePos: { value: [0, 0, 0] },
      uInnerRadius: { value: SHADER.accretionInnerRadius },
      uOuterRadius: { value: SHADER.accretionOuterRadius },
      uFov: { value: 1.3 },
      uScrollProgress: { value: 0 },
      uGeodesicLUT: { value: dummyTex },
      uUseLUT: { value: 0.0 },
    }),
    [dummyTex]
  );

  // ─── ATOMIC LUT ACTIVATION ───────────────────────────────────────────
  // All texture configuration (wrap/filter/needsUpdate) has already been
  // done inside useGeodesicLUT, BEFORE the texture arrives here.
  // This effect ONLY does two assignments — it doesn't mutate the texture.
  // This eliminates the "mixed state" window between frames that caused
  // visual glitches during the RK4 → LUT transition.
  useEffect(() => {
    if (!lutTexture || !materialRef.current) return;
    materialRef.current.uniforms.uGeodesicLUT.value = lutTexture;
    materialRef.current.uniforms.uUseLUT.value = 1.0;
  }, [lutTexture]);

  // ─── FRAME LOOP (ANIMATION) ──────────────────────────────────────────
  useFrame((state) => {
    if (!materialRef.current) return;
    
    // Update continuous time for accretion disk turbulence
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    
    // Sync external store states
    materialRef.current.uniforms.uGravity.value = gravity;
    materialRef.current.uniforms.uScrollProgress.value = scrollProgress;

    // Smoothly interpolate the black hole mass (easing) for visual transitions
    const targetMass = 0.3 + gravity * 0.7;
    materialRef.current.uniforms.uMass.value +=
      (targetMass - materialRef.current.uniforms.uMass.value) * 0.05;
  });

  return (
    <mesh position={position} scale={scale} renderOrder={10}>
      <planeGeometry args={[5, 5]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={DoubleSide}
        transparent={true}
        depthWrite={false}
        depthTest={true}
        blending={NormalBlending}
      />
    </mesh>
  );
}
