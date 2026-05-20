/**
 * DiscoveryScene — Scene 2: First Sight
 * ======================================
 * Placeholder scene for Phase 2.
 * Will contain: distant black hole reveal, light distortion,
 * chromatic aberration increase, accretion disk first visible.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { Text } from "@react-three/drei";
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
      <Text
        position={[0, 3, 8]}
        fontSize={0.3}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        font="/fonts/SpaceGrotesk-Medium.ttf"
        material-transparent
        material-opacity={0.7}
      >
        Something pulls at the fabric of space
      </Text>
    </group>
  );
}
