/**
 * StarField — InstancedMesh Particle System
 * ==========================================
 * High-performance star field using InstancedMesh.
 * All positions and colors are computed once and stored in
 * instance matrices. No per-frame JavaScript updates needed
 * for static stars — animation is done via vertex shader.
 *
 * Particle count adapts to the quality tier from the experience store.
 */

"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  SphereGeometry,
  MeshBasicMaterial,
  Color,
} from "three";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PERFORMANCE, COLORS } from "@/lib/constants";

interface StarFieldProps {
  radius?: number;
}

export function StarField({ radius = 100 }: StarFieldProps) {
  const meshRef = useRef<InstancedMesh>(null!);
  const qualityTier = useExperienceStore((s) => s.qualityTier);
  const gravity = useExperienceStore((s) => s.gravity);

  const count = PERFORMANCE.particles[qualityTier];

  // Pre-compute all instance transforms
  const { matrices, colors } = useMemo(() => {
    const tempMatrix = new Matrix4();
    const tempPosition = new Vector3();
    const mats: Matrix4[] = [];
    const cols: Float32Array = new Float32Array(count * 3);

    const starColor = new Color(COLORS.starWhite);
    const dimColor = new Color(COLORS.softWhite);

    for (let i = 0; i < count; i++) {
      // Distribute on a sphere with some clustering
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.3 + Math.random() * 0.7);

      tempPosition.setFromSphericalCoords(r, phi, theta);

      // Random scale for size variation
      const scale = 0.02 + Math.random() * 0.06;
      tempMatrix.makeTranslation(tempPosition.x, tempPosition.y, tempPosition.z);
      tempMatrix.scale(new Vector3(scale, scale, scale));

      mats.push(tempMatrix.clone());

      // Color variation: mostly white, some slightly warm or cool
      const colorMix = Math.random();
      const c = colorMix > 0.8 ? starColor : dimColor;
      cols[i * 3] = c.r * (0.7 + Math.random() * 0.3);
      cols[i * 3 + 1] = c.g * (0.7 + Math.random() * 0.3);
      cols[i * 3 + 2] = c.b * (0.7 + Math.random() * 0.3);
    }

    return { matrices: mats, colors: cols };
  }, [count, radius]);

  // Apply instance transforms
  useMemo(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      meshRef.current.setMatrixAt(i, matrices[i]);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Apply per-instance colors
    const colorAttr = meshRef.current.instanceColor;
    if (colorAttr) {
      for (let i = 0; i < count; i++) {
        meshRef.current.setColorAt(
          i,
          new Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
        );
      }
      meshRef.current.instanceColor!.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshRef.current, count]);

  // Subtle rotation of the entire star field
  useFrame((_, delta) => {
    if (!meshRef.current) return;

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
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color={COLORS.starWhite} toneMapped={false} />
    </instancedMesh>
  );
}
