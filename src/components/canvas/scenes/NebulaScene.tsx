/**
 * NebulaScene — Scene 1: Cinematic Entrance
 * ==========================================
 * The user's first impression. A dense, volumetric nebula cloud
 * (pink/purple tones) surrounds the camera. As they scroll,
 * the nebula dissolves to reveal deep space and the black hole.
 *
 * Components:
 * - Nebula: Instanced particle cloud with GLSL volumetric noise
 * - Ambient lighting: subtle purple wash
 * - Text content is handled by the DOM SceneOverlay
 *
 * The point lights are anchored to NEBULA_CENTER_Z so the internal glow
 * tracks the nebula's world position dynamically.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

import { Nebula } from "../objects/Nebula";
import { NEBULA_CENTER_Z } from "@/lib/constants";

interface NebulaSceneProps {
  active: boolean;
}

export function NebulaScene({ active }: NebulaSceneProps) {
  const groupRef = useRef<Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    // Keep visible during nebula AND discovery (dissolve continues)
    groupRef.current.visible = active;
  });

  // Point-light Z positions are offsets from the nebula center, so the
  // glow stays embedded in the cloud wherever the cloud is placed.
  const cz = NEBULA_CENTER_Z;

  return (
    <group ref={groupRef}>
      {/* ─── Volumetric Nebula Cloud ─────────────────────────────── */}
      <Nebula />

      {/* ─── Ambient Light: subtle purple cosmic wash ────────────── */}
      <ambientLight intensity={0.04} color="#1a0a2e" />

      {/* ─── Point lights for internal nebula glow (anchored) ────── */}
      <pointLight
        position={[8, 5, cz + 5]}
        intensity={0.8}
        color="#8b2a6b"
        distance={30}
        decay={2}
      />
      <pointLight
        position={[-6, -3, cz - 2]}
        intensity={0.5}
        color="#3a1860"
        distance={25}
        decay={2}
      />
      <pointLight
        position={[0, 8, cz + 10]}
        intensity={0.3}
        color="#c45590"
        distance={20}
        decay={2}
      />
    </group>
  );
}