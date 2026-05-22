/**
 * Nebula — Procedural Cumuliform Fragment Shader
 * =====================================================
 * Generates massive, dense, irregular cloud chunks using FBM.
 * Relies on heavy Additive Blending of 400 instances to create 
 * the colossal volume of the cosmic gas.
 */

varying vec2 vUv;
varying vec3 vInstancePos;
varying float vSeed;
varying float vDensity;
varying float vColorVar;
varying float vDustMask;

uniform float uTime;
uniform float uProgress;

// ─── Fast 2D Value Noise & FBM ──────────────────────────────────────────────

float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
        mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), 
        u.y
    );
}

// 2-Octave Fractional Brownian Motion (Fast but detailed enough for gas)
float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 2; i++) {
        f += amp * valueNoise(p);
        p *= 2.1;
        amp *= 0.5;
    }
    return f;
}

// ─── Chemical Color Palette ─────────────────────────────────────────────────

vec3 getChemicalColor(float isOxygen, vec3 pos) {
    // Spatial noise to blend colors across the nebula
    float spaceNoise = valueNoise(pos.xy * 0.05 + vec2(uTime * 0.02));
    
    // Core Palettes - Highly vibrant to survive Additive Blending
    vec3 deepPurple = vec3(0.05, 0.01, 0.12); // Space background
    vec3 oxygenCyan = vec3(0.10, 0.55, 0.95); // Vibrant OIII
    vec3 hydrogenPink = vec3(0.95, 0.15, 0.55); // Vibrant H-alpha

    vec3 baseColor = mix(hydrogenPink, oxygenCyan, isOxygen);
    
    // Mix with deep purple to give volume and shadow
    vec3 finalColor = mix(deepPurple, baseColor, 0.3 + 0.7 * spaceNoise);

    return finalColor;
}

void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // ─── Procedural Cumuliform Cloud ─────────────────────────────────────────
    
    // Generate complex noise to warp the distance field
    // This turns a perfect circle into a torn, fluffy cloud chunk
    vec2 fbmUv = vUv * 3.0 + vec2(vSeed * 20.0, uTime * 0.1);
    float noiseDistortion = fbm(fbmUv);
    
    // Warp the distance metric. 
    // If noise is high, dist increases (carving into the circle).
    float warpedDist = dist + (noiseDistortion * 0.35 - 0.15);

    // Early discard based on the WARPED distance
    if (warpedDist > 0.48) discard;

    // Create the soft gas mask using the warped geometry
    float mask = smoothstep(0.48, 0.1, warpedDist);
    
    // ─── Chemistry & Light ───────────────────────────────────────────────────
    
    float isOxygen = smoothstep(0.4, 0.6, vColorVar);
    vec3 color = getChemicalColor(isOxygen, vInstancePos);

    // Additive Hot Core: The center of the gas puff burns hotter
    float core = exp(-warpedDist * warpedDist * 25.0) * vDensity;
    color += vec3(0.1, 0.3, 0.4) * core * isOxygen; 
    color += vec3(0.4, 0.1, 0.2) * core * (1.0 - isOxygen);

    // ─── Dissolve & Dust Lanes ───────────────────────────────────────────────
    
    float dissolve = 1.0 - smoothstep(0.0, 0.8, uProgress);
    
    // Multiply alpha. We rely heavily on overlapping (density).
    // vDustMask violently kills the opacity if we are in a void.
    float alpha = mask * vDensity * dissolve * (0.05 + 0.95 * vDustMask);
    
    // Push base transparency up slightly to ensure volume is visible
    alpha *= 1.2; 

    if (alpha <= 0.01) discard;

    // Premultiplied alpha output for Additive Blending
    gl_FragColor = vec4(color * alpha, alpha);
}
