/**
 * SceneManager — Cinematic Timeline Orchestrator
 * ================================================
 * Lives inside <ScrollControls> and <Canvas>.
 *
 * KEY ARCHITECTURE: Camera Z is driven by continuous keyframe
 * interpolation from CAMERA_KEYFRAMES, NOT discrete phase jumps.
 * This gives butter-smooth camera movement through the entire
 * scroll range.
 *
 * SHADER WARMUP: On frame 0 (!isReady), all heavy 3D components are forced
 * to be visible. This guarantees that Three.js gl.compile() processes them
 * synchronously before the canvas fades in, preventing extreme lag spikes.
 */

"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useScrollPhase } from "@/hooks/useScrollPhase";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import { useExperienceStore } from "@/store/useExperienceStore";
import { CAMERA_KEYFRAMES } from "@/lib/constants";
import { damp, lerp, clamp } from "@/lib/math";

// Scene components
import { NebulaScene } from "./scenes/NebulaScene";
import { DiscoveryScene } from "./scenes/DiscoveryScene";
import { ApproachScene } from "./scenes/ApproachScene";
import { EventHorizonScene } from "./scenes/EventHorizonScene";
import { SingularityScene } from "./scenes/SingularityScene";
import { BlackHole } from "./objects/BlackHole";

const BH_Z = -20;

/**
 * Interpolate camera Z from the keyframe table.
 * Linear interpolation between the two surrounding keyframes.
 */
function getCameraZ(scroll: number): number {
  const kf = CAMERA_KEYFRAMES;
  if (scroll <= kf[0].scroll) return kf[0].z;
  if (scroll >= kf[kf.length - 1].scroll) return kf[kf.length - 1].z;

  for (let i = 0; i < kf.length - 1; i++) {
    if (scroll >= kf[i].scroll && scroll <= kf[i + 1].scroll) {
      const t = (scroll - kf[i].scroll) / (kf[i + 1].scroll - kf[i].scroll);
      return lerp(kf[i].z, kf[i + 1].z, t);
    }
  }
  return kf[kf.length - 1].z;
}

import { useScroll } from "@react-three/drei";

export function SceneManager() {
  useScrollPhase();
  usePerformanceMonitor();
  useAdaptiveQuality();

  const { camera } = useThree();
  const phase = useExperienceStore((s) => s.phase);
  const isReady = useExperienceStore((s) => s.isReady);
  const setReady = useExperienceStore((s) => s.setReady);
  const setAntialias = useExperienceStore((s) => s.setAntialias);
  const scroll = useScroll();

  const lookTarget = useRef(new Vector3(0, 0, 0));
  const readySignaled = useRef(false);

  useFrame((_, delta) => {
    // Signal ready after shaders compile
    if (!readySignaled.current) {
      readySignaled.current = true;
      // Synchronous compilation has already occurred in this frame.
      // The next RequestAnimationFrame triggers the fade-in, releasing the screen to the user.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setReady();
        });
      });
    }

    const scrollProgress = scroll.offset;

    // ─── Continuous Camera Z from keyframes ────────────────────
    const targetZ = getCameraZ(scrollProgress);
    camera.position.x = damp(camera.position.x, 0, 3, delta);
    camera.position.y = damp(camera.position.y, 0, 3, delta);

    // Singularity gets faster damping for suck-in effect
    const isSingularity = phase === "singularity";
    const dampSpeed = isSingularity ? 12 : 3;
    camera.position.z = damp(camera.position.z, targetZ, dampSpeed, delta);

    // ─── Dynamic Look-At ───────────────────────────────────────
    const isEntering = isSingularity || phase === "event-horizon";
    const targetLookZ = isEntering ? BH_Z : 0;
    const lookDamp = isSingularity ? 8 : 1.5;
    lookTarget.current.z = damp(lookTarget.current.z, targetLookZ, lookDamp, delta);
    camera.lookAt(lookTarget.current);
  });

  // ─── Scene Visibility ────────────────────────────────────────
  // Nebula: visible during home → revelation (0.00 - 0.60)
  const nebulaActive =
    phase === "home" ||
    phase === "awakening" ||
    phase === "traversal" ||
    phase === "revelation";

  // BH scenes: visible from revelation onward (0.40+)
  const bhActive =
    phase === "revelation" ||
    phase === "discovery" ||
    phase === "approach" ||
    phase === "event-horizon" ||
    phase === "singularity";

  return (
    <group>
      <BlackHole position={[0, 0, -20]} scale={22} visible={!isReady || true} />
      <NebulaScene active={!isReady || nebulaActive} />
      <DiscoveryScene active={!isReady || phase === "discovery" || phase === "approach" || phase === "revelation"} />
      <ApproachScene active={!isReady || bhActive} />
      <EventHorizonScene active={!isReady || phase === "event-horizon"} />
      <SingularityScene active={!isReady || phase === "singularity"} />
    </group>
  );
}
