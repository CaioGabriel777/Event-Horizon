/**
 * BlackHole — Procedural Raymarched Black Hole Component
 * ======================================================
 * Renders a supermassive black hole with:
 * - Schwarzschild event horizon
 * - Procedural accretion disk (FBM noise)
 * - Blackbody radiation coloring
 * - Doppler beaming
 * - Photon sphere glow
 *
 * Performance Architecture:
 * - When WASM geodesic LUT is available: single texture lookup per pixel (~50-100x faster)
 * - Fallback: per-pixel RK4 integration (original shader path)
 *
 * Rendering Strategy:
 * Uses alphaTest instead of transparency. The shader outputs alpha=1
 * for all BH-affected pixels (center, disk, ring) and alpha=0 for
 * areas with no effect. alphaTest discards alpha<threshold fragments,
 * while drawn fragments write to the depth buffer — properly occluding
 * stars behind the BH without the gray halo artifact.
 */

"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { ShaderMaterial, DoubleSide, DataTexture, FloatType, RGBAFormat } from "three";
import { SHADER } from "@/lib/constants";
import { useExperienceStore } from "@/store/useExperienceStore";
import { useGeodesicLUT } from "@/hooks/useGeodesicLUT";

import vertexShader from "@/shaders/blackhole/vertex.glsl";
import fragmentShader from "@/shaders/blackhole/fragment.glsl";

interface BlackHoleProps {
  position?: [number, number, number];
  scale?: number;
}

// 1x1 dummy texture to avoid null uniform (GLSL requires a valid sampler)
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

  // Load WASM geodesic lookup table
  const { texture: lutTexture, loading: lutLoading, computeTimeMs } = useGeodesicLUT();

  // Create uniforms once
  const dummyTex = useMemo(() => createDummyTexture(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMass: { value: 0.8 },
      uGravity: { value: 0 },
      uBlackHolePos: { value: [0, 0, 0] },
      uInnerRadius: { value: SHADER.accretionInnerRadius },
      uOuterRadius: { value: SHADER.accretionOuterRadius },
      uFov: { value: 1.3 },
      // LUT uniforms
      uGeodesicLUT: { value: dummyTex },
      uUseLUT: { value: 0.0 },
    }),
    [dummyTex]
  );

  // When LUT texture becomes available, update the uniform
  useEffect(() => {
    if (lutTexture && materialRef.current) {
      materialRef.current.uniforms.uGeodesicLUT.value = lutTexture;
      materialRef.current.uniforms.uUseLUT.value = 1.0;
      console.log(
        `[BlackHole] LUT enabled (computed in ${computeTimeMs}ms). ` +
        `Shader switched from RK4 loop → texture lookup.`
      );
    }
  }, [lutTexture, computeTimeMs]);

  // Animate uniforms every frame (no React re-render)
  useFrame((state) => {
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uGravity.value = gravity;

    // Mass scales with gravity for dramatic reveal
    const targetMass = 0.3 + gravity * 0.7;
    materialRef.current.uniforms.uMass.value +=
      (targetMass - materialRef.current.uniforms.uMass.value) * 0.05;
  });

  return (
    <mesh position={position} scale={scale} renderOrder={10}>
      <planeGeometry args={[2, 2, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={DoubleSide}
        transparent={false}
        alphaTest={0.005}
        depthWrite={true}
        depthTest={true}
      />
    </mesh>
  );
}
