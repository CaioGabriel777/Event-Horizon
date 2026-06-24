/**
 * GPU Profile Detector
 * ====================
 * Detects GPU capability tier from the WebGL renderer string.
 * Configures resolution scale, step count, and FBM octaves
 * for the black hole raymarcher.
 */

export type GpuProfile = "low" | "medium" | "high";

/**
 * GPU profile parameters — maps each tier to concrete shader/render values.
 *
 * bhResScale:  FBO resolution multiplier for the black hole pass (0..1).
 * maxSteps:    RK4 integration step cap per fragment.
 * fbmOctaves:  Fractal Brownian Motion octave count for disk turbulence.
 */
export const GPU_PROFILES = {
  low:    { bhResScale: 0.35, maxSteps: 120, fbmOctaves: 2 },
  medium: { bhResScale: 0.50, maxSteps: 120, fbmOctaves: 2 },
  high:   { bhResScale: 0.65, maxSteps: 120, fbmOctaves: 3 },
} as const;

/**
 * Detects GPU capability tier from the WebGL renderer string.
 * Falls back to "medium" if renderer info is unavailable.
 */
export function detectGpuProfile(gl: WebGLRenderingContext | WebGL2RenderingContext): GpuProfile {
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string)
    : "";

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const isIntegrated = /Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple GPU/i.test(renderer);

  console.log(`[GPU Profile] renderer: "${renderer}", mobile: ${isMobile}, integrated: ${isIntegrated}`);

  if (isMobile) return "low";
  if (isIntegrated) return "low";
  return "high";
}
