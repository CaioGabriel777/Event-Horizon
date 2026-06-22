/**
 * Black Hole — Vertex Shader
 * ===========================
 * Simple passthrough for the fullscreen quad used by the raymarcher.
 * Passes UV coordinates and ray direction to the fragment shader.
 */

/**
 * Black Hole — Vertex Shader (Fullscreen Quad, NDC)
 * ==================================================
 * Pins the quad directly in clip space (-1 to +1).
 * Bypasses all Three.js projection/modelView transforms.
 * The raymarcher in the fragment shader handles all 3D geometry.
 */
varying vec2 vUv;

void main() {
  vUv = uv;
  // Bypass all transforms — position directly in clip space
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
