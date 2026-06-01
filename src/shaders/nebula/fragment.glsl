/**
 * Nebula — Intelligent Volumetric Gas Shader
 * ============================================================================
 * 1. UV Warping: Distorts the static texture to create organic fluid behavior.
 * 2. Zero-Accumulation: Forces thin smoke to output vec3(0.0) to prevent 
 * additive blending from forming solid "plastic" walls of light.
 */

// ─── Varyings & Uniforms ────────────────────────────────────────────────────

varying vec2 vUv;
varying float vDensity;
varying float vDustMask;
varying vec3 vBaseColor; 

uniform float uTime;
uniform float uProgress;
uniform sampler2D uTexture; 

// ─── Main ───────────────────────────────────────────────────────────────────

void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // ─── Soft Edge Fade ─────────────────────────────────────────────────────
    // Much softer spherical edge to break the square shape of the quad.
    
    float edgeFade = 1.0 - smoothstep(0.10, 0.48, dist);
    if (edgeFade <= 0.01) discard;

    float randX = fract(vDensity * 143.345);
    float randY = fract(vDensity * 287.912);
    
    vec2 randomUv = vUv;
    if (randX > 0.5) randomUv.x = 1.0 - randomUv.x;
    if (randY > 0.5) randomUv.y = 1.0 - randomUv.y;

    // ─── Organic Turbulence (UV Warping) ────────────────────────────────────
    // Warps the texture coordinates to simulate fluid motion. This breaks
    // the hard edges of the static texture and merges the 50 instances.
    
    float warpTime = uTime * 0.15 + vDensity * 20.0;
    randomUv.x += sin(randomUv.y * 4.0 + warpTime) * 0.035;
    randomUv.y += cos(randomUv.x * 4.0 + warpTime) * 0.035;

    vec4 texColor = texture2D(uTexture, randomUv);
    float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Sculpting the smoke with a parabolic curve
    float structure = pow(luminance, 2.0); 
    structure = smoothstep(0.02, 0.80, structure); 

    // ─── Zero-Accumulation (Anti-Plastic) ───────────────────────────────────
    // Direct color multiplication by structure. 
    // Thin smoke = Color 0.0 (Black). Summing zero prevents solid walls!
    
    vec3 color = vBaseColor * (structure * 3.5);

    // Core glow illuminates only the absolute center of the dust
    float coreGlow = exp(-dist * dist * 15.0) * (vDensity * 0.5);
    color += vBaseColor * coreGlow;

    // ─── Dissolve & Alpha Compositing ───────────────────────────────────────
    
    float dissolve = 1.0 - smoothstep(0.0, 0.8, uProgress);
    float alpha = structure * vDensity * dissolve * (0.1 + 0.9 * vDustMask);
    
    // Phantom multiplier perfectly sustains 25-50 particles
    alpha *= 0.25; 
    
    alpha *= pow(edgeFade, 2.0);

    if (alpha <= 0.005) discard; 

    gl_FragColor = vec4(color * alpha, alpha);
}