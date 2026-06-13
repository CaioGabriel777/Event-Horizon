/**
 * useOrbitCamera — Cinematic Orbital Approach Controller
 * ========================================================
 * Drives an automatic, input-free decaying spiral orbit around the
 * black hole when the experience enters the `event-horizon` phase.
 *
 * Architecture:
 *  - Single-source-of-truth timer (t: 0.0 → 1.0 over ORBIT.durationSec),
 *    following the same pattern as the SingularityPass timeline.
 *  - State machine: idle → running → completed → idle (re-armed after
 *    the experience loops back to the early phases).
 *  - While running, this hook OWNS the camera. SceneManager and
 *    useScrollPhase both early-out via `isOrbitActive` in the store.
 *  - On completion, it atomically hands over to the singularity
 *    sequence: gravity → 1.0, phase → 'singularity'. The SingularityPass
 *    entry condition fires on the very same frame (it runs at
 *    renderPriority=1, after this priority-0 callback).
 *
 * Orbital path (all values tunable in ORBIT, lib/constants.ts):
 *  - Radius decays from startRadius (seamless with the scroll camera's
 *    final Z position) down to endRadius — INSIDE the accretion disk's
 *    outer annulus, recreating the Interstellar disk fly-over.
 *  - Height follows a sine arc: level → high above the disk → crossing
 *    the disk plane edge-on → below the disk → settling near the plane
 *    for the final dive.
 *  - Camera always looks at the black hole center, so the RK4
 *    raymarcher (fed by the real camera matrix) renders true
 *    gravitational lensing from every angle.
 *
 * HUD integration (future-proof):
 *  - `orbitProgress` (0→1) is broadcast to the store every frame.
 *    HUD components can derive warnings, integrity decay, proximity
 *    readouts, etc., from this single value without touching this hook.
 *  - `gravity` ramps 0.9 → 1.0 across the orbit, so existing
 *    gravity-driven HUD/shader reactions intensify organically.
 */

"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { useExperienceStore } from "@/store/useExperienceStore";
import { ORBIT } from "@/lib/constants";
import { lerp, smoothstep, easeInOutSine } from "@/lib/math";

/**
 * Black hole world position.
 * Must match BH_Z in SceneManager.tsx, the BlackHole position prop,
 * and BLACK_HOLE_POSITION in Singularity.tsx.
 */
const BLACK_HOLE_POSITION = new Vector3(0, 0, -20);

/** Lifecycle states for the orbital sequence. */
type OrbitState = "idle" | "running" | "completed";

/**
 * Computes the camera's world position along the orbital path.
 *
 * @param t   Normalized orbit progress (0 → 1).
 * @param out Pre-allocated Vector3 to write into (zero allocation per frame).
 * @returns   The same `out` vector, for chaining.
 */
function computeOrbitPosition(t: number, out: Vector3): Vector3 {
  // Angular sweep — constant angular velocity reads as a confident,
  // deliberate cinematic drone move.
  const angle = t * Math.PI * 2 * ORBIT.revolutions;

  // Radius decays with a sine ease: gentle at the start (imperceptible
  // hand-off from the scroll camera), gentle at the end (settling into
  // the final dive position).
  const radius = lerp(ORBIT.startRadius, ORBIT.endRadius, easeInOutSine(t));

  // Vertical arc: rises above the disk, crosses the plane edge-on
  // (the disk becomes a blade of light), then dips below it.
  const rawHeight =
    ORBIT.heightAmplitude * Math.sin(t * Math.PI * 2 * ORBIT.heightCycles);

  // Converge to finalHeight in the last stretch so the singularity
  // sequence always starts from a consistent, near-plane vantage.
  const settle = smoothstep(ORBIT.settleStart, 1.0, t);
  const height = lerp(rawHeight, ORBIT.finalHeight, settle);

  out.set(
    BLACK_HOLE_POSITION.x + Math.sin(angle) * radius,
    BLACK_HOLE_POSITION.y + height,
    BLACK_HOLE_POSITION.z + Math.cos(angle) * radius
  );
  return out;
}

/**
 * Orbital camera controller hook.
 * Call once inside SceneManager (must live inside <Canvas>).
 */
export function useOrbitCamera() {
  const orbitState = useRef<OrbitState>("idle");
  const orbitTime = useRef(0);
  const entryPos = useRef(new Vector3());
  const entryLookAt = useRef(new Vector3());
  const orbitPos = useRef(new Vector3());
  const blendedLook = useRef(new Vector3());
  const lookDir = useRef(new Vector3());
  const lastMilestone = useRef(0);

  useFrame(({ camera }, delta) => {
    const state = useExperienceStore.getState();

    // ─── Re-arm after the loop reset ─────────────────────────────────
    // Once the experience has fully returned to the early phases
    // (and the singularity timeline has finished), the orbit becomes
    // available for the next cycle.
    if (
      orbitState.current === "completed" &&
      state.phase !== "event-horizon" &&
      state.phase !== "singularity" &&
      !state.isSingularityActive
    ) {
      orbitState.current = "idle";
      lastMilestone.current = 0;
      console.log("[Orbit] Re-armed for next cycle");
    }

    // ─── Entry detection ─────────────────────────────────────────────
    // The scroll-driven phase resolver flips to 'event-horizon' at
    // scroll ≈ 0.82. From that frame on, the orbit owns the experience:
    // useScrollPhase locks the scroll element via isOrbitActive.
    if (
      orbitState.current === "idle" &&
      state.phase === "event-horizon" &&
      !state.isSingularityActive
    ) {
      orbitState.current = "running";
      orbitTime.current = 0;
      entryPos.current.copy(camera.position);
      // Capture the point the scroll camera was looking at, so the orbit
      // eases orientation from here toward the black hole instead of
      // snapping (Bug 3, sub-problem B). A point 10 units ahead of the
      // current forward vector reconstructs the entry gaze target.
      camera.getWorldDirection(lookDir.current);
      entryLookAt.current
        .copy(camera.position)
        .addScaledVector(lookDir.current, 10);
      state.setIsOrbitActive(true);
      state.setOrbitProgress(0);
      console.log(
        `[Orbit] Engaged — ${ORBIT.durationSec}s cinematic approach, ` +
          `entry at (${camera.position.x.toFixed(1)}, ` +
          `${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`
      );
    }

    if (orbitState.current !== "running") return;

    // ─── Advance the single-source-of-truth timeline ─────────────────
    orbitTime.current = Math.min(
      ORBIT.durationSec,
      orbitTime.current + delta
    );
    const t = orbitTime.current / ORBIT.durationSec;

    // Broadcast progress for HUD overlays and future phase reactions.
    state.setOrbitProgress(t);

    // Gravity ramps 0.9 → 1.0 across the orbit. Every existing
    // gravity-driven system (HUD telemetry, uMass lensing intensity,
    // helmet shell variants) intensifies organically as we spiral in.
    state.setGravity(0.9 + t * 0.1);

    // ─── Diagnostic milestones (25 / 50 / 75%) ───────────────────────
    // Logs position AND orientation: `fwd` is the camera's actual world
    // forward vector, `toBH` is the ideal direction to the black hole.
    // If lookAt tracking is healthy, the two vectors must match (≈).
    const quarter = Math.floor(t * 4);
    if (quarter > lastMilestone.current && quarter < 4) {
      lastMilestone.current = quarter;
      camera.getWorldDirection(lookDir.current);
      const toBH = orbitPos.current
        .copy(BLACK_HOLE_POSITION)
        .sub(camera.position)
        .normalize();
      console.log(
        `[Orbit] ${quarter * 25}% — ` +
          `pos (${camera.position.x.toFixed(1)}, ` +
          `${camera.position.y.toFixed(1)}, ` +
          `${camera.position.z.toFixed(1)}), ` +
          `dist ${camera.position.distanceTo(BLACK_HOLE_POSITION).toFixed(1)}, ` +
          `fwd (${lookDir.current.x.toFixed(2)}, ` +
          `${lookDir.current.y.toFixed(2)}, ${lookDir.current.z.toFixed(2)}), ` +
          `toBH (${toBH.x.toFixed(2)}, ${toBH.y.toFixed(2)}, ${toBH.z.toFixed(2)})`
      );
    }

    // ─── Apply orbital position ──────────────────────────────────────
    computeOrbitPosition(t, orbitPos.current);

    // Blend from the scroll camera's exact position during the first
    // moments — guarantees a seam-free hand-off even if scroll momentum
    // left the camera slightly off the analytic orbit start point.
    const blendIn = smoothstep(0, ORBIT.blendInWindow, t);
    camera.position.lerpVectors(entryPos.current, orbitPos.current, blendIn);

    // Blend the look-at target the same way: from the entry gaze point
    // toward the black hole. This eases the camera rotation in instead
    // of snapping it on the first orbit frame (Bug 3). Once blendIn
    // reaches 1.0 the camera locks onto the black hole for the rest of
    // the orbit, so the world-space raymarcher gets true lensing from
    // every angle.
    blendedLook.current.lerpVectors(
      entryLookAt.current,
      BLACK_HOLE_POSITION,
      blendIn
    );
    camera.lookAt(blendedLook.current);

    // ─── Completion → hand over to the singularity sequence ──────────
    if (t >= 1.0) {
      orbitState.current = "completed";
      // Lock the camera dead-on the black hole on the final frame. The
      // singularity collapse (and its dolly-zoom) assumes a centered
      // gaze; without this explicit lock a large-delta final frame could
      // leave the camera slightly off-axis (Bug 2).
      camera.position.copy(orbitPos.current);
      camera.lookAt(BLACK_HOLE_POSITION);
      state.setIsOrbitActive(false);
      state.setOrbitProgress(1);
      state.setGravity(1.0);
      state.setPhase("singularity");
      console.log(
        "[Orbit] Complete — camera locked on BH, handing over to singularity"
      );
    }
  });
}