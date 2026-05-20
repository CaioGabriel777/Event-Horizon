/**
 * DiscoveryScene — Scene 2: First Sight
 * ======================================
 * Phase 2: Minimal scene that hints at the gravitational presence.
 * The main text content is handled by the SceneOverlay (DOM layer).
 * This scene only adds subtle ambient lighting.
 *
 * NOTE: The 3D text "Something pulls..." was removed because it
 * overlapped with ApproachScene's "TIME IS RELATIVE" text when
 * both scenes are active simultaneously.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

interface DiscoverySceneProps {
  active: boolean;
}

export function DiscoveryScene({ active }: DiscoverySceneProps) {
  const groupRef = useRef<Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = active;
  });

  return (
    <group ref={groupRef}>
      {/* Scene 2: Subtle ambient only — text is in SceneOverlay DOM */}
      <ambientLight intensity={0.015} color="#0a0e1a" />
    </group>
  );
}
