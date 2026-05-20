/**
 * Gravitational Lensing — Fragment Shader
 * ========================================
 * Screen-space post-processing effect that simulates the bending of light
 * around a supermassive black hole using a simplified Einstein ring equation.
 *
 * The shader displaces UV sampling coordinates based on:
 * 1. Distance from the lens center (black hole projected position)
 * 2. Mass uniform (gravitational intensity)
 * 3. Schwarzschild radius (event horizon — pure black inside)
 *
 * References:
 * - Einstein ring: θ = sqrt(4GM/c² × D_LS / D_S × D_L)
 * - Simplified for real-time: deflection = mass / (distance + epsilon)
 */

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

    // Avoid division by zero
    float safeDist = max(dist, 0.0001);
    vec2 dir = delta / safeDist;

    // ─── Einstein ring deflection ──────────────────────────────────────
    // Strength falls off with distance, scaled by mass
    float deflection = uMass * uMass / (safeDist * safeDist + uMass * 0.1);

    // Displace the sampling UV toward the lens center
    vec2 offset = dir * deflection * 0.08;
    vec2 distortedUV = uv - offset;

    // Clamp to prevent sampling outside the texture
    distortedUV = clamp(distortedUV, vec2(0.0), vec2(1.0));

    // ─── Event Horizon (Schwarzschild radius) ─────────────────────────
    // Anything inside the radius is absorbed — pure black
    float horizonMask = smoothstep(
        uSchwarzschildRadius - 0.005,
        uSchwarzschildRadius + 0.01,
        dist
    );

    // ─── Photon ring glow ─────────────────────────────────────────────
    // Subtle bright ring just outside the event horizon
    float photonRing = exp(-pow((dist - uSchwarzschildRadius * 1.5) * 30.0, 2.0));
    photonRing *= uMass * 0.3;

    // Sample the distorted scene
    vec4 sceneColor = texture2D(inputBuffer, distortedUV);

    // Add photon ring glow (warm white-orange)
    vec3 ringColor = vec3(1.0, 0.85, 0.6) * photonRing;

    // Composite: scene + ring, masked by event horizon
    vec3 finalColor = mix(vec3(0.0), sceneColor.rgb + ringColor, horizonMask);

    outputColor = vec4(finalColor, sceneColor.a);
}
