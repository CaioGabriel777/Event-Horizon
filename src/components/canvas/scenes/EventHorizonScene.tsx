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
