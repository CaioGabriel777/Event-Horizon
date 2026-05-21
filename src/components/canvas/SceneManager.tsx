/**
 * SceneManager — Cinematic Scene Orchestrator
 * ============================================
 * Lives inside <ScrollControls> and <Canvas>.
 * Responsibilities:
 * 1. Bridge scroll position → Zustand store
 * 2. Animate camera position based on current phase
 * 3. Render all scenes (conditionally active based on phase)
 * 4. Run performance monitoring hooks
 *
 * SINGULARITY SUCK-IN: During the singularity phase, the camera
 * accelerates exponentially toward the black hole (10x damp speed),
 * creating a dramatic "being sucked in" effect before the blackout.
 */

"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useScrollPhase } from "@/hooks/useScrollPhase";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PHASES, CAMERA } from "@/lib/constants";
import { damp } from "@/lib/math";

// Scene components
import { NebulaScene } from "./scenes/NebulaScene";
import { DiscoveryScene } from "./scenes/DiscoveryScene";
import { ApproachScene } from "./scenes/ApproachScene";
import { EventHorizonScene } from "./scenes/EventHorizonScene";
import { SingularityScene } from "./scenes/SingularityScene";

// Black hole Z position (must match ApproachScene's BlackHole position)
const BH_Z = -20;

export function SceneManager() {
  // ─── Hooks ──────────────────────────────────────────────────
  useScrollPhase();          // Bridge scroll → Zustand
  usePerformanceMonitor();   // Track FPS, draw calls
  useAdaptiveQuality();      // Auto-downgrade quality

  const { camera } = useThree();
  const phase = useExperienceStore((s) => s.phase);

  // Camera animation targets
  const targetPos = useRef(new Vector3(...CAMERA.initialPosition));
  const lookTarget = useRef(new Vector3(0, 0, 0));

  // ─── Camera Animation ───────────────────────────────────────
  useFrame((_, delta) => {
    // Find current phase config for target camera Z
    const config = PHASES.find((p) => p.id === phase);
    if (!config) return;

    // Set target Z from phase config
    targetPos.current.z = config.cameraZ;

    // Camera speed: normal = 2, singularity = 12 (6x faster for suck-in)
    const isSingularity = phase === "singularity";
    const dampSpeed = isSingularity ? 12 : 2;

    camera.position.x = damp(camera.position.x, 0, 3, delta);
    camera.position.y = damp(camera.position.y, 0, 3, delta);
    camera.position.z = damp(camera.position.z, targetPos.current.z, dampSpeed, delta);

    // ─── Dynamic Look-At ──────────────────────────────────────
    // From event-horizon onward, the camera looks directly at the
    // black hole instead of the origin, so it stays in view as
    // the camera enters the singularity.
    const isEntering = isSingularity || phase === "event-horizon";
    const targetLookZ = isEntering ? BH_Z : 0;
    const lookDampSpeed = isSingularity ? 8 : 1.5;
    lookTarget.current.z = damp(lookTarget.current.z, targetLookZ, lookDampSpeed, delta);

    camera.lookAt(lookTarget.current);
  });

  // ─── Render all scenes ──────────────────────────────────────
  return (
    <group>
      <NebulaScene active={phase === "nebula"} />
      <DiscoveryScene active={phase === "discovery" || phase === "approach"} />
      <ApproachScene active={
        phase === "approach" ||
        phase === "discovery" ||
        phase === "event-horizon" ||
        phase === "singularity"
      } />
      <EventHorizonScene active={phase === "event-horizon"} />
      <SingularityScene active={phase === "singularity"} />
    </group>
  );
}
