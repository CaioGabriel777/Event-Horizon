/**
 * Event Horizon — Math Utilities
 * ==============================
 * Pure helper functions for interpolation, easing, and physics.
 * Zero dependencies. All functions are deterministic.
 */

/** Linear interpolation between a and b */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Remap value from one range to another */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

/** Smooth step (Hermite interpolation) */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Smoother step (Ken Perlin's improved version) */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Exponential ease-in */
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
}

/** Exponential ease-out */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Sine ease-in-out */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Compute phase-local progress from global scroll progress.
 * Returns 0 at phase start, 1 at phase end.
 */
export function getPhaseProgress(
  globalProgress: number,
  phaseStart: number,
  phaseEnd: number
): number {
  return clamp((globalProgress - phaseStart) / (phaseEnd - phaseStart), 0, 1);
}

/**
 * Compute gravity intensity from global scroll progress.
 * Gravity is 0 in nebula/discovery, ramps up in approach,
 * peaks at event-horizon, and holds at 1 in singularity.
 */
export function computeGravity(scrollProgress: number): number {
  if (scrollProgress < 0.3) return 0;
  if (scrollProgress < 0.4) return smoothstep(0.3, 0.4, scrollProgress) * 0.1;
  if (scrollProgress < 0.6) return remap(scrollProgress, 0.4, 0.6, 0.1, 0.7);
  if (scrollProgress < 0.8) return remap(scrollProgress, 0.6, 0.8, 0.7, 1.0);
  return 1.0;
}

/** Damped lerp — frame-rate independent smooth interpolation */
export function damp(
  current: number,
  target: number,
  lambda: number,
  dt: number
): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
