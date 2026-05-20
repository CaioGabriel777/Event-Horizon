/**
 * Gravity Text — Fragment Shader
 * ==============================
 * Complements the vertex distortion with visual decay effects:
 * - Color shifting (white → blue-shift → red-shift via Doppler)
 * - Opacity decay as gravity increases
 * - Scanline glitch at high gravity
 * - SDF edge noise for "melting" text edges
 *
 * NOTE: This shader is designed to work with troika-three-text's
 * MSDF rendering pipeline. The `gl_FragColor` is computed after
 * troika's standard SDF distance calculation. We modify the
 * output color and alpha based on our gravity uniforms.
 */

uniform float uGravity;
uniform float uTime;

varying vec2 vUv;
varying float vGravity;
varying float vDistortion;

// ─── Hash noise for glitch effects ──────────────────────────────────────────
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

void main() {
    // Base color: soft scientific white
    vec3 baseColor = vec3(0.91, 0.88, 0.85);

    // ─── Color Shift (Doppler-inspired) ─────────────────────────────────
    // As gravity increases:
    // 0.0 → 0.3: White → slight blue shift
    // 0.3 → 0.7: Blue shift → red shift (gravitational redshift)
    // 0.7 → 1.0: Red shift → dim, nearly invisible

    float blueShift = smoothstep(0.0, 0.3, uGravity);
    float redShift = smoothstep(0.3, 0.7, uGravity);
    float dimming = smoothstep(0.7, 1.0, uGravity);

    vec3 color = baseColor;
    color = mix(color, vec3(0.7, 0.8, 1.0), blueShift * 0.5);   // Subtle blue
    color = mix(color, vec3(1.0, 0.5, 0.2), redShift * 0.6);     // Warm red-shift
    color = mix(color, vec3(0.2, 0.05, 0.0), dimming * 0.8);     // Dying light

    // ─── Scanline Glitch ────────────────────────────────────────────────
    // Horizontal scanlines appear at high gravity, flickering with time
    float scanlinePhase = smoothstep(0.5, 0.7, uGravity);
    float scanline = step(0.97, fract(vUv.y * 80.0 + uTime * 5.0));
    float glitchBlock = step(0.95, hash(floor(uTime * 8.0) + floor(vUv.y * 20.0)));

    // Random horizontal offset blocks (data corruption aesthetic)
    float blockGlitch = glitchBlock * scanlinePhase * 0.3;
    color = mix(color, vec3(1.0, 0.3, 0.1), scanline * scanlinePhase * 0.5);

    // ─── Opacity Decay ──────────────────────────────────────────────────
    // Text fades as it's consumed by the black hole
    float alpha = 1.0;
    alpha *= 1.0 - dimming * 0.9;                // Fade near singularity
    alpha *= 1.0 - scanline * scanlinePhase * 0.3; // Scanline transparency

    // Flickering at high gravity
    float flicker = 1.0 - step(0.96, hash(uTime * 100.0 + vUv.x * 50.0)) * smoothstep(0.6, 0.9, uGravity) * 0.5;
    alpha *= flicker;

    // ─── Edge Noise (SDF Melting) ───────────────────────────────────────
    // At high gravity, the crisp text edges become noisy and irregular
    // This is achieved by perturbing the alpha threshold
    // (troika handles the actual SDF, we modulate the result)
    float edgeNoise = hash(vUv.x * 100.0 + vUv.y * 100.0 + uTime * 2.0);
    float edgeMelt = smoothstep(0.6, 0.9, uGravity);
    alpha -= edgeNoise * edgeMelt * 0.4;

    // ─── Output ─────────────────────────────────────────────────────────
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
}
