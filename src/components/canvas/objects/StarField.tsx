/**
 * StarField — InstancedMesh Particle System
 * ==========================================
 * High-performance star field using InstancedMesh.
 * All positions and colors are computed once and stored in
 * instance matrices. No per-frame JavaScript updates needed
 * for static stars — animation is done via vertex shader.
 *
 * Particle count adapts to the quality tier from the experience store.
 *
 * VISUAL FIX: Uses higher-poly spheres (8 segments) to avoid the
 * pixelated/blocky appearance that was caused by using only 4 segments.
 * The visual cost is minimal because the spheres are tiny (0.02-0.08 scale).
 */

"use client";

import { useRef, useMemo, useLayoutEffect, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  Color,
} from "three";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PERFORMANCE, COLORS } from "@/lib/constants";

interface StarFieldProps {
  radius?: number;
}

export function StarField({ radius = 300 }: StarFieldProps) {
  const meshRef = useRef<InstancedMesh>(null!);
  const qualityTier = useExperienceStore((s) => s.qualityTier);
  const gravity = useExperienceStore((s) => s.gravity);
  const isReady = useExperienceStore((s) => s.isReady);

  const [lockedCount, setLockedCount] = useState(PERFORMANCE.particles[qualityTier]);

  useEffect(() => {
    if (!isReady) {
      setLockedCount(PERFORMANCE.particles[qualityTier]);
    }
  }, [isReady, qualityTier]);

  // Pre-compute all instance transforms
  const { matrices, colors } = useMemo(() => {
    const tempMatrix = new Matrix4();
    const tempPosition = new Vector3();
    const mats: Matrix4[] = [];
    const cols: Float32Array = new Float32Array(lockedCount * 3);

    const starColor = new Color(COLORS.starWhite);
    const dimColor = new Color(COLORS.softWhite);
    // Warm and cool tints for color variety
    const warmColor = new Color("#ffe4c4");
    const coolColor = new Color("#c4d8ff");

    for (let i = 0; i < lockedCount; i++) {
      // Distribute on a sphere with some clustering
      // EXCLUSION ZONE: no stars within a cylinder around the BH center
      // (BH is at [0, 0, -20], so we exclude a cylinder along the camera→BH axis)
      let attempts = 0;
      do {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius * (0.3 + Math.random() * 0.7);
        tempPosition.setFromSphericalCoords(r, phi, theta);
        attempts++;
      } while (
        // Small exclusion: only prevent stars directly on the BH center
        // line-of-sight. Stars behind the BH are already handled by
        // alphaTest + depthWrite on the BH shader material.
        Math.sqrt(tempPosition.x * tempPosition.x + tempPosition.y * tempPosition.y) < 6 &&
        tempPosition.z > -25 && tempPosition.z < 20 &&
        attempts < 5
      );

      // Random scale for size variation
      const scale = 0.02 + Math.random() * 0.06;
      tempMatrix.makeTranslation(tempPosition.x, tempPosition.y, tempPosition.z);
      tempMatrix.scale(new Vector3(scale, scale, scale));

      mats.push(tempMatrix.clone());

      // Color variation: white, warm, and cool tones
      const colorRoll = Math.random();
      let c: Color;
      if (colorRoll > 0.9) c = warmColor;
      else if (colorRoll > 0.8) c = coolColor;
      else if (colorRoll > 0.6) c = starColor;
      else c = dimColor;

      const brightness = 0.7 + Math.random() * 0.3;
      cols[i * 3] = c.r * brightness;
      cols[i * 3 + 1] = c.g * brightness;
      cols[i * 3 + 2] = c.b * brightness;
    }

    return { matrices: mats, colors: cols };
  }, [lockedCount, radius]);

  // Apply instance transforms
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < lockedCount; i++) {
      meshRef.current.setMatrixAt(i, matrices[i]);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Apply per-instance colors
    const colorAttr = meshRef.current.instanceColor;
    if (colorAttr) {
      for (let i = 0; i < lockedCount; i++) {
        meshRef.current.setColorAt(
          i,
          new Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
        );
      }
      meshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [lockedCount, matrices, colors]);

  // Subtle rotation of the entire star field
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Efeito Skybox: Acompanhar a Câmera
    meshRef.current.position.copy(state.camera.position);

    // Slow rotation — stars drift
    meshRef.current.rotation.y += delta * 0.005;

    // At high gravity, stars get pulled inward (scale down)
    const targetScale = 1.0 - gravity * 0.3;
    meshRef.current.scale.lerp(
      new Vector3(targetScale, targetScale, targetScale),
      0.02
    );
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, lockedCount]}
      frustumCulled={false}
      renderOrder={-1}
    >
      {/* 8 segments instead of 4 — smooth spheres, no pixelated look */}
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={COLORS.starWhite} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}
