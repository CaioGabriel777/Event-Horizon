/**
 * Nebula — Vertex Shader
 * ==================================================
 * Restores massive billboard scale for thick cumuliform gas,
 * maintains Dust Lanes via 2D Noise, Organic Drift, 
 * and Native Z-Axis Traversal.
 */

attribute vec3 instanceColor;

varying vec2 vUv;
varying vec3 vInstancePos;
varying float vSeed;
varying float vDensity;
varying float vColorVar;
varying float vDustMask; 

uniform float uTime;
uniform float uScroll;

// ─── Fast 2D Value Noise for Dust Lanes ──────────────────────────────────────

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

void main() {
    vSeed = instanceColor.r;
    vDensity = instanceColor.g;
    vColorVar = instanceColor.b;

    vec3 instancePos = vec3(
        instanceMatrix[3][0],
        instanceMatrix[3][1],
        instanceMatrix[3][2]
    );

    // ─── Dust Lanes (Procedural Void Generation) ─────────────────
    // We use a macro-scale 2D noise based on the instance position
    // to determine if this particle sits inside a "Dust Lane".
    float dustNoise = valueNoise(instancePos.xy * 0.05);
    vDustMask = smoothstep(0.3, 0.6, dustNoise); 

    // ─── Billboard Rotation ──────────────────────────────────────
    float rotT = uTime * 0.1 * (vSeed - 0.5) * 2.0; 
    float initialRot = vSeed * 6.28318; 
    float angle = initialRot + rotT;
    
    float s = sin(angle);
    float c = cos(angle);
    
    // We removed the severe XY squashing so the Fragment Shader has
    // a full square canvas to generate thick cumuliform clouds.
    vec2 rotatedPos = vec2(
        position.x * c - position.y * s,
        position.x * s + position.y * c
    );

    // If it's a dust lane, we shrink the particle slightly to physically tear the gas
    rotatedPos *= (0.4 + 0.6 * vDustMask);

    vUv = uv;
    vInstancePos = instancePos;
    
    // Organic Drift
    vec3 drift = vec3(
        sin(uTime * 0.15 + vSeed * 10.0) * 3.0,
        cos(uTime * 0.12 - vSeed * 5.0) * 2.0,
        sin(uTime * 0.08 + vSeed * 20.0) * 1.5
    );
    instancePos += drift;

    // Native Traversal
    instancePos.z += uScroll * 80.0;

    float scaleX = length(vec3(instanceMatrix[0])); 

    vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 cameraUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

    vec3 worldPos = instancePos 
        + cameraRight * rotatedPos.x * scaleX
        + cameraUp * rotatedPos.y * scaleX;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
