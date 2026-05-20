/**
 * NebulaScene — Scene 1: Entrance
 * ================================
 * Placeholder scene for Phase 1.
 * Will contain: volumetric nebula particles, intro text fade,
 * ambient cosmic dust, slow camera drift.
 *
 * Currently renders a minimal star field and title text.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

interface NebulaSceneProps {
  active: boolean;
}

export function NebulaScene({ active }: NebulaSceneProps) {
  const groupRef = useRef<Group>(null!);
  const textRef = useRef<any>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.visible = active;

    // Subtle text fade pulse
    if (textRef.current?.material) {
      textRef.current.material.opacity =
        0.6 + Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <Text
        ref={textRef}
        position={[0, 0, 10]}
        fontSize={0.8}
        color="#e8e6e3"
        anchorX="center"
        anchorY="middle"
        font="/fonts/SpaceGrotesk-Medium.ttf"
        material-transparent
        material-opacity={0.8}
      >
        EVENT HORIZON
      </Text>

      <Text
        position={[0, -1.2, 10]}
        fontSize={0.2}
        color="#64748b"
        anchorX="center"
        anchorY="middle"
        font="/fonts/SpaceGrotesk-Medium.ttf"
        material-transparent
        material-opacity={0.6}
      >
        Scroll to begin your descent
      </Text>

      <ambientLight intensity={0.02} color="#0a0e1a" />
    </group>
  );
}
