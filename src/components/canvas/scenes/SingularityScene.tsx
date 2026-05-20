/**
 * SingularityScene — Scene 5: The End
 * ====================================
 * Placeholder scene for Phase 5.
 * Will contain: black screen, gravitational noise,
 * glitch artifacts, fade to total silence.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

interface SingularitySceneProps {
  active: boolean;
}

export function SingularityScene({ active }: SingularitySceneProps) {
  const groupRef = useRef<Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = active;
  });

  return (
    <group ref={groupRef}>
      {/* Scene 5: Pure void — nothing renders */}
      {/* In future: subtle noise/glitch via post-processing */}
    </group>
  );
}
