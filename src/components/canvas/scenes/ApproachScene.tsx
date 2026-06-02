/**
 * ApproachScene — Scene 3: THE MAIN SHOWCASE
 * ==========================================
 * The showcase scene where gravity takes hold.
 *
 * LAYOUT: Texts positioned on the LEFT side of the viewport,
 * leaving the black hole (center/right) as the undisputed visual focus.
 * As gravity increases, the texts are pulled toward the black hole.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { GravityText } from "../objects/GravityText";

import { useExperienceStore } from "@/store/useExperienceStore";

interface ApproachSceneProps {
  active: boolean;
}

export function ApproachScene({ active }: ApproachSceneProps) {
  const groupRef = useRef<Group>(null!);
  const gravity = useExperienceStore((s) => s.gravity);

  // Smooth opacity transition
  useFrame(() => {
    if (!groupRef.current) return;
    const targetVisible = active;
    groupRef.current.visible = targetVisible || gravity > 0.05;
  });

  return (
    <group ref={groupRef}>
      {/* ─── Ambient Light ───────────────────────────────────────── */}
      <ambientLight intensity={0.03} color="#0a0e1a" />

      {/* ─── Point light at accretion disk ───────────────────────── */}
      <pointLight
        position={[0, 0, -18]}
        intensity={gravity * 1.5}
        color="#ff9a3c"
        distance={30}
        decay={2}
      />
    </group>
  );
}
