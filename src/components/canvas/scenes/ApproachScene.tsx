/**
 * ApproachScene — Scene 3: "A SACADA PRINCIPAL"
 * =============================================
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
import { BlackHole } from "../objects/BlackHole";
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
      {/* ─── The Black Hole (center of attention) ────────────────── */}
      <BlackHole position={[0, 0, -20]} scale={22} />


      {/* ─── Gravity-Distorted Text Elements ─────────────────────── */}
      {/* Positioned on the LEFT side, far from the black hole center */}

      {/* Main title — top-left area */}
      <GravityText
        position={[-4.5, 3, 8]}
        fontSize={0.5}
        color="#e8e6e3"
        maxWidth={6}
        blackHolePosition={[0, 0, -20]}
        anchorX="left"
      >
        TIME IS RELATIVE
      </GravityText>

      {/* Subtitle — left side, below title */}
      <GravityText
        position={[-4.5, 1.5, 8]}
        fontSize={0.18}
        color="#94a3b8"
        maxWidth={5.5}
        blackHolePosition={[0, 0, -20]}
        anchorX="left"
      >
        As you approach the event horizon, time dilates. What feels like seconds here is centuries elsewhere.
      </GravityText>

      {/* Scientific data readout — bottom-left */}
      <GravityText
        position={[-4.5, -2.5, 8]}
        fontSize={0.12}
        color="#64748b"
        maxWidth={5}
        blackHolePosition={[0, 0, -20]}
        anchorX="left"
      >
        SCHWARZSCHILD RADIUS: 2GM/c²
      </GravityText>

      {/* Right-side small label — just a hint near the black hole */}
      <GravityText
        position={[4.2, -3, 8]}
        fontSize={0.1}
        color="#3a3a3a"
        maxWidth={4}
        blackHolePosition={[0, 0, -20]}
        anchorX="right"
      >
        GRAVITATIONAL REDSHIFT ACTIVE
      </GravityText>

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
