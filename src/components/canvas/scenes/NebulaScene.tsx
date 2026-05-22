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
 * - 3D Text removed — all text handled by DOM SceneOverlay
 *
 * The nebula remains visible during discovery phase (partially
 * dissolved) for a seamless transition to the approach phase.
 */

"use client";

import { useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

import { Nebula } from "../objects/Nebula";

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

  return (
    <group ref={groupRef}>
      {/* ─── Volumetric Nebula Cloud ─────────────────────────────── */}
      <Nebula />

      {/* ─── Ambient Light: subtle purple cosmic wash ────────────── */}
      <ambientLight intensity={0.04} color="#1a0a2e" />

      {/* ─── Point lights for internal nebula glow ───────────────── */}
      <pointLight
        position={[8, 5, 45]}
        intensity={0.8}
        color="#8b2a6b"
        distance={30}
        decay={2}
      />
      <pointLight
        position={[-6, -3, 38]}
        intensity={0.5}
        color="#3a1860"
        distance={25}
        decay={2}
      />
      <pointLight
        position={[0, 8, 50]}
        intensity={0.3}
        color="#c45590"
        distance={20}
        decay={2}
      />
    </group>
  );
}
