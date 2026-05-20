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
 * CAMERA LOOK-AT: The camera always looks at the origin during
 * early phases, but smoothly transitions to look toward the
 * black hole position (-20z) during singularity, so the camera
 * can physically "enter" the black hole without losing sight of it.
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
  const scrollProgress = useExperienceStore((s) => s.scrollProgress);

  // Camera animation targets
  const targetPos = useRef(new Vector3(...CAMERA.initialPosition));
  const lookTarget = useRef(new Vector3(0, 0, 0));

  // ─── Camera Animation ───────────────────────────────────────
  useFrame((_, delta) => {
    // Find current phase config for target camera Z
    const config = PHASES.find((p) => p.id === phase);
    if (!config) return;

    // Smooth camera movement
    targetPos.current.z = config.cameraZ;

    camera.position.x = damp(camera.position.x, 0, 3, delta);
    camera.position.y = damp(camera.position.y, 0, 3, delta);
    camera.position.z = damp(camera.position.z, targetPos.current.z, 2, delta);

    // ─── Dynamic Look-At ──────────────────────────────────────
    // During singularity, the camera passes z=0 and enters the
    // black hole. We smoothly shift the look-at target from the
    // origin (0,0,0) toward the BH position (0,0,-20) so the
    // camera keeps facing the black hole as it enters.
    const isEntering = phase === "singularity" || phase === "event-horizon";
    const targetLookZ = isEntering ? BH_Z : 0;
    lookTarget.current.z = damp(lookTarget.current.z, targetLookZ, 1.5, delta);

    camera.lookAt(lookTarget.current);
  });

  // ─── Render all scenes ──────────────────────────────────────
  // All scenes are always mounted but can internally skip rendering
  // based on phase to avoid mount/unmount overhead
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
