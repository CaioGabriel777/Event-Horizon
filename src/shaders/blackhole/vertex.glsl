/**
 * Black Hole — Vertex Shader
 * ===========================
 * Simple passthrough for the fullscreen quad used by the raymarcher.
 * Passes UV coordinates and ray direction to the fragment shader.
 */

varying vec2 vUv;
varying vec3 vRayDir;

uniform float uFov;

void main() {
    vUv = uv;

    // Compute ray direction from camera through this vertex
    // This assumes the quad is at z = -1 in camera space
    float halfFov = tan(uFov * 0.5);
    vRayDir = normalize(vec3(
        (uv.x - 0.5) * 2.0 * halfFov,
        (uv.y - 0.5) * 2.0 * halfFov,
        -1.0
    ));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
