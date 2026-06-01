/**
 * Nebula — Vertex Shader
 * ============================================================================
 * Implements organic Perlin Noise for procedural density and coloration.
 * This runs per-instance (50 times total), maintaining extremely high performance.
 */

// ─── Attributes & Varyings ──────────────────────────────────────────────────

attribute vec3 instanceColor;

varying vec2 vUv;
varying float vDensity;
varying float vDustMask; 
varying vec3 vBaseColor; 

// ─── Uniforms ───────────────────────────────────────────────────────────────

uniform float uTime;
uniform float uScroll;

// ─── Noise ──────────────────────────────────────────────────────────────────

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float n = mix(
        mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
            dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
        mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
            dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y
    );
    return n * 0.5 + 0.5; 
}

// ─── Main ───────────────────────────────────────────────────────────────────

void main() {
    float vSeed = instanceColor.r;
    vDensity = instanceColor.g;
    float vColorVar = instanceColor.b;

    // ─── Instance Position & Dust Mask ──────────────────────────────────────
    
    vec3 instancePos = vec3(
        instanceMatrix[3][0],
        instanceMatrix[3][1],
        instanceMatrix[3][2]
    );

    float dustNoise = perlinNoise(instancePos.xy * 0.05);
    vDustMask = smoothstep(0.3, 0.6, dustNoise); 

    // ─── Color Palette (Cyan / Magenta) ─────────────────────────────────────
    
    float isOxygen = smoothstep(0.4, 0.6, vColorVar);
    float spaceNoise = perlinNoise(instancePos.xy * 0.05 + vec2(uTime * 0.01));
    
    vec3 deepVoid = vec3(0.05, 0.01, 0.10);       
    vec3 oxygenCyan = vec3(0.10, 0.60, 0.95);     
    vec3 hydrogenPink = vec3(0.90, 0.10, 0.50);   

    vec3 chemicalColor = mix(hydrogenPink, oxygenCyan, isOxygen);
    vBaseColor = mix(deepVoid, chemicalColor, 0.3 + 0.7 * spaceNoise);

    // ─── Quad Rotation & Drift ──────────────────────────────────────────────
    
    float rotT = uTime * 0.05 * (vSeed - 0.5) * 2.0; 
    float initialRot = vSeed * 6.28318; 
    float angle = initialRot + rotT;
    
    float s = sin(angle);
    float c = cos(angle);
    
    vec2 rotatedPos = vec2(
        position.x * c - position.y * s,
        position.x * s + position.y * c
    );

    rotatedPos *= (0.4 + 0.6 * vDustMask);

    vUv = uv;
    
    vec3 drift = vec3(
        sin(uTime * 0.1 + vSeed * 10.0) * 2.0,
        cos(uTime * 0.08 - vSeed * 5.0) * 1.5,
        sin(uTime * 0.05 + vSeed * 20.0) * 1.0
    );
    instancePos += drift;
    instancePos.z += uScroll * 80.0;

    // ─── Camera-Facing Billboarding ─────────────────────────────────────────

    float scaleX = length(vec3(instanceMatrix[0])); 

    vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 cameraUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

    vec3 worldPos = instancePos 
        + cameraRight * rotatedPos.x * scaleX
        + cameraUp * rotatedPos.y * scaleX;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}