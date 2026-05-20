/**
 * EventHorizonScene — Scene 4: Point of No Return
 * ================================================
 * Placeholder scene for Phase 4.
 * Will contain: extreme lensing, FPS intentional drop,
 * audio dampening UI, maximum distortion.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

interface EventHorizonSceneProps {
  active: boolean;
}

export function EventHorizonScene({ active }: EventHorizonSceneProps) {
  const groupRef = useRef<Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = active;
  });

  return (
    <group ref={groupRef}>
      <Text
        position={[0, 1, 2]}
        fontSize={0.4}
        color="#8b2500"
        anchorX="center"
        anchorY="middle"
        font="/fonts/SpaceGrotesk-Medium.ttf"
        material-transparent
        material-opacity={0.9}
      >
        NO RETURN
      </Text>

      {/* Intense accretion glow */}
      <pointLight
        position={[0, 0, -5]}
        intensity={5}
        color="#e87c2a"
        distance={20}
        decay={2}
      />
    </group>
  );
}
