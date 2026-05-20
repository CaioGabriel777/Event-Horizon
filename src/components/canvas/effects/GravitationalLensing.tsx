/**
 * GravitationalLensing — Custom Post-Processing Effect
 * ====================================================
 * Extends the `postprocessing` Effect class to create a screen-space
 * gravitational lensing distortion. Integrates seamlessly with R3F's
 * EffectComposer pipeline.
 *
 * Usage:
 *   <EffectComposer>
 *     <GravitationalLensing mass={0.5} />
 *   </EffectComposer>
 *
 * The effect is merged into a single EffectPass by the postprocessing
 * library, so it shares a render pass with Bloom and ChromaticAberration.
 */

"use client";

import { forwardRef, useMemo } from "react";
import { Uniform, Vector2 } from "three";
import { Effect } from "postprocessing";
import { useThree } from "@react-three/fiber";

// ─── GLSL Fragment Shader (inline for Effect class) ─────────────────────────
// The postprocessing library uses `mainImage` instead of `main()`
const fragmentShader = /* glsl */ `
  uniform float uMass;
  uniform vec2 uLensCenter;
  uniform float uSchwarzschildRadius;
  uniform float uAspectRatio;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Aspect-corrected coordinates
    vec2 aspectUV = uv;
    aspectUV.x *= uAspectRatio;

    vec2 aspectCenter = uLensCenter;
    aspectCenter.x *= uAspectRatio;

    // Vector from fragment to lens center
    vec2 delta = aspectUV - aspectCenter;
    float dist = length(delta);
    float safeDist = max(dist, 0.0001);
    vec2 dir = delta / safeDist;

    // Einstein ring deflection
    float deflection = uMass * uMass / (safeDist * safeDist + uMass * 0.1);
    vec2 offset = dir * deflection * 0.08;
    vec2 distortedUV = uv - offset;

    // Clamp to prevent sampling outside texture
    distortedUV = clamp(distortedUV, vec2(0.0), vec2(1.0));

    // Event horizon: pure black inside Schwarzschild radius
    float horizonMask = smoothstep(
      uSchwarzschildRadius - 0.005,
      uSchwarzschildRadius + 0.01,
      dist
    );

    // Photon ring glow at 1.5x Schwarzschild radius
    float photonDist = abs(dist - uSchwarzschildRadius * 1.5);
    float photonGlow = exp(-photonDist * 40.0) * uMass * 0.3;
    vec3 ringColor = vec3(1.0, 0.85, 0.6) * photonGlow;

    // Sample distorted scene
    vec4 sceneColor = texture2D(inputBuffer, distortedUV);

    // Composite
    vec3 finalColor = mix(vec3(0.0), sceneColor.rgb + ringColor, horizonMask);
    outputColor = vec4(finalColor, sceneColor.a);
  }
`;

// ─── Effect Implementation ──────────────────────────────────────────────────

class GravitationalLensingImpl extends Effect {
  constructor({
    mass = 0,
    lensCenter = new Vector2(0.5, 0.5),
    schwarzschildRadius = 0.08,
    aspectRatio = 1,
  } = {}) {
    super("GravitationalLensing", fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ["uMass", new Uniform(mass)],
        ["uLensCenter", new Uniform(lensCenter)],
        ["uSchwarzschildRadius", new Uniform(schwarzschildRadius)],
        ["uAspectRatio", new Uniform(aspectRatio)],
      ]),
    });
  }

  /** Update mass (called from useFrame via parent) */
  set mass(value: number) {
    this.uniforms.get("uMass")!.value = value;
  }

  /** Update the lens center position (screen-space 0→1) */
  set lensCenter(value: Vector2) {
    this.uniforms.get("uLensCenter")!.value = value;
  }

  /** Update aspect ratio on resize */
  set aspectRatio(value: number) {
    this.uniforms.get("uAspectRatio")!.value = value;
  }
}

// ─── React Component ────────────────────────────────────────────────────────

interface GravitationalLensingProps {
  mass?: number;
  lensCenter?: [number, number];
  schwarzschildRadius?: number;
}

export const GravitationalLensing = forwardRef<
  GravitationalLensingImpl,
  GravitationalLensingProps
>(function GravitationalLensing(
  { mass = 0, lensCenter = [0.5, 0.5], schwarzschildRadius = 0.08 },
  ref
) {
  const { size } = useThree();
  const aspectRatio = size.width / size.height;

  const effect = useMemo(() => {
    return new GravitationalLensingImpl({
      mass,
      lensCenter: new Vector2(...lensCenter),
      schwarzschildRadius,
      aspectRatio,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update uniforms reactively
  useMemo(() => {
    effect.mass = mass;
    effect.lensCenter = new Vector2(...lensCenter);
    effect.aspectRatio = aspectRatio;
  }, [effect, mass, lensCenter, aspectRatio]);

  return <primitive ref={ref} object={effect} />;
});
