/**
 * SingularityOverlay
 * ==================
 * Renders the absolute black overlay that hides the DOM reset during
 * the singularity cinematic sequence. It derives its opacity strictly 
 * from the \`singularityProgress\` timeline in the global store.
 */
"use client";

import { useExperienceStore } from "@/store/useExperienceStore";

/** Pure JS smoothstep function for timeline interpolation */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function SingularityOverlay() {
  const progress = useExperienceStore((s) => s.singularityProgress);

  // Absolute pitch black in act 3 (progress 0.50 → 0.82)
  // Fade out to reveal the reset scene in act 4 (progress 0.85 → 1.0)
  const blackOpacity = progress > 0
    ? smoothstep(0.50, 0.75, progress) * (1 - smoothstep(0.85, 1.0, progress))
    : 0;

  if (blackOpacity < 0.001) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      background: 'black',
      opacity: blackOpacity,
      pointerEvents: blackOpacity > 0.5 ? 'all' : 'none',
      // No CSS transitions used — opacity is strictly tied to the 
      // frame-driven timer, interpolating smoothly every delta step
    }} />
  );
}
