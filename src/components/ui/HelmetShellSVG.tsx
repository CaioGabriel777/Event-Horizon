/**
 * HelmetShellSVG — Physical Helmet Shell with CSS Variable Theming
 * =================================================================
 * Renders the hexagonal helmet shell from the base SVG asset with:
 *   - CSS custom properties for cohesive sci-fi theming
 *   - Three visual variants: nominal, warning, danger
 *   - Ambient visor glow and top light gradients
 *   - Smooth 0.6s transitions between states
 *
 * All color values are driven by CSS variables scoped to the SVG element,
 * never leaking to :root. Variant overrides only affect seam highlights
 * and circuit traces — the metal shell stays neutral.
 */

"use client";

import { memo } from "react";

/** Visual state variant for the helmet shell */
type ShellVariant = "nominal" | "warning" | "danger";

interface HelmetShellSVGProps {
  /** Current visual state — affects seam/circuit accent colors */
  variant?: ShellVariant;
}

/**
 * Returns CSS custom property overrides for the given variant.
 * Only seam highlights and circuit traces change — the base metal stays neutral.
 */
function getVariantOverrides(variant: ShellVariant): Record<string, string> {
  switch (variant) {
    case "warning":
      return {
        "--seam-highlight": "#5a4a2a",
        "--circuit-primary": "#4a3d20",
        "--circuit-node": "#5a4820",
        "--visor-glow-color": "rgba(100,160,255,0.04)",
      };
    case "danger":
      return {
        "--seam-highlight": "#3d2020",
        "--circuit-primary": "#3a2222",
        "--circuit-node": "#442828",
        "--visor-glow-color": "rgba(255,80,80,0.05)",
      };
    default:
      return {
        "--seam-highlight": "#3e4246",
        "--circuit-primary": "#373d45",
        "--circuit-node": "#3f4650",
        "--visor-glow-color": "rgba(100,160,255,0.04)",
      };
  }
}

/** Base color palette for the helmet shell */
const BASE_COLORS = {
  shellBase:      "#0d1a24",  
  shellMid:       "#112030", 
  shellLight:     "#162840",  
  shellDeep:      "#080f16",  
  dotFill:        "#1a3045",  
  seamStroke:     "#1e3a52", 
  seamLight:      "#254a66",  
  seamHighlight:  "#4a8fa8",  
  boltFace:       "#2a4a60",  
  visorRingOuter: "#1a3a52",  
  visorRingInner: "#6ab4cc",  
  visorGasket:    "#060d14",  
  circuitPrimary:   "#2a5570", 
  circuitSecondary: "#1e3d52",
  circuitNode:      "#3a7a96",
  visorGlowColor: "rgba(80,180,220,0.06)", 
};

/** Returns merged color palette for the given variant */
function getColors(variant: ShellVariant) {
  const base = { ...BASE_COLORS };
  if (variant === "warning") {
    base.seamHighlight = "#5a4a2a";
    base.circuitPrimary = "#4a3d20";
    base.circuitNode = "#5a4820";
  } else if (variant === "danger") {
    base.seamHighlight = "#3d2020";
    base.circuitPrimary = "#3a2222";
    base.circuitNode = "#442828";
    base.visorGlowColor = "rgba(255,80,80,0.05)";
  }
  return base;
}

export const HelmetShellSVG = memo(function HelmetShellSVG({ variant = "nominal" }: HelmetShellSVGProps) {
  const c = getColors(variant);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 60 }}
      viewBox="0 0 1280 720"
      preserveAspectRatio="none"
      role="img"
      aria-label="Helmet shell"
    >
      <defs>
        {/* Dot mesh pattern */}
        <pattern id="dots" x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="0.85" fill={c.dotFill} />
        </pattern>



        {/* Shell vignette gradient */}
        <radialGradient id="shellVig" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#2a2c30" />
          <stop offset="100%" stopColor="#0e0f11" />
        </radialGradient>

        {/* Visor glow — ambient light from the visor reflecting on the shell interior */}
        <radialGradient id="visorGlow" cx="50%" cy="50%" r="45%">
          <stop offset="0%" stopColor={c.visorGlowColor} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* Top light — simulates overhead illumination */}
        <linearGradient id="topLight" x1="0" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.025)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* ═══ Background (Direct Composition Friendly — No clipPath) ═══ */}
      <g>
        <path fill="#0c0d0f" fillRule="evenodd" d="M 0,0 L 1280,0 L 1280,720 L 0,720 Z M 31,0 L 350,0 L 640,0 L 930,0 L 1249,0 L 1280,91.8 L 1280,360 L 1280,628.3 L 1249,720 L 1075,720 L 843,720 L 640,720 L 437,720 L 205,720 L 31,720 L 0,628.3 L 0,360 L 0,91.8 Z" />
        <path fill="url(#shellVig)" fillRule="evenodd" d="M 0,0 L 1280,0 L 1280,720 L 0,720 Z M 31,0 L 350,0 L 640,0 L 930,0 L 1249,0 L 1280,91.8 L 1280,360 L 1280,628.3 L 1249,720 L 1075,720 L 843,720 L 640,720 L 437,720 L 205,720 L 31,720 L 0,628.3 L 0,360 L 0,91.8 Z" />
        <path fill="url(#dots)" opacity="0.85" fillRule="evenodd" d="M 0,0 L 1280,0 L 1280,720 L 0,720 Z M 31,0 L 350,0 L 640,0 L 930,0 L 1249,0 L 1280,91.8 L 1280,360 L 1280,628.3 L 1249,720 L 1075,720 L 843,720 L 640,720 L 437,720 L 205,720 L 31,720 L 0,628.3 L 0,360 L 0,91.8 Z" />
      </g>

      {/* ═══════════════════════════════════════
           STRUCTURAL PANELS
           ═══════════════════════════════════════ */}

      {/* TOP CENTER — sensor bar */}
      <polygon points="408,0 872,0 901,0 814,0 727,0 640,0 553,0 466,0 379,0" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="480.5,0 799.5,0 816.9,0 756,0 640,0 524,0 463.1,0" fill="#22252a" stroke="#404448" strokeWidth="0.5" />
      <line x1="567.5" y1="0" x2="712.5" y2="0" stroke="#454a50" strokeWidth="0.8" />
      <line x1="603.8" y1="0" x2="676.3" y2="0" stroke="#454a50" strokeWidth="0.6" />
      <rect x="602.3" y="0" width="75.4" height="14.5" rx="2" fill={c.shellDeep} stroke={c.seamLight} strokeWidth="0.5" />
      <rect x="613.9" y="0" width="10.2" height="7.3" rx="1" fill={c.boltFace} />
      <rect x="629.9" y="0" width="10.2" height="7.3" rx="1" fill={c.boltFace} />
      <rect x="645.8" y="0" width="10.2" height="7.3" rx="1" fill={c.boltFace} />

      {/* TOP LEFT — angular panel */}
      <polygon points="0,0 408,0 379,0 263,0 103.5,0 0,0 0,0 0,0" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="0,0 321,0 294.9,0 190.5,0 38.3,0 0,0 0,0 0,0" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="0,0 2,0 23.8,0 0,0 0,0 0,0 0,0" fill={c.shellLight} stroke={c.seamHighlight} strokeWidth="0.6" />
      <polygon points="31,0 321,0 299.3,0 226.8,0 103.5,0 16.5,0 23.8,0" fill="#23262a" stroke={c.seamLight} strokeWidth="0.5" />
      {/* Slots */}
      <rect x="0" y="0" width="40.6" height="7.3" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="0" y="0" width="40.6" height="7.3" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="0" y="0" width="34.8" height="7.3" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      {/* Bolts */}
      <circle cx="0" cy="0" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="0" cy="0" r="2.9" fill={c.boltFace} />
      <circle cx="0" cy="0" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="0" cy="0" r="2.9" fill={c.boltFace} />
      <circle cx="234" cy="0" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="234" cy="0" r="2.9" fill={c.boltFace} />
      {/* Ribs */}
      <line x1="60" y1="0" x2="31" y2="0" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="277.5" y1="0" x2="255.8" y2="0" stroke={c.seamStroke} strokeWidth="0.7" />

      {/* TOP RIGHT — mirror */}
      <polygon points="1280,0 872,0 901,0 1017,0 1176.5,0 1280,0 1280,0 1280,0" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="1280,0 959,0 985.1,0 1089.5,0 1241.8,0 1280,0 1280,0 1280,0" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="1280,0 1278,0 1256.3,0 1280,0 1280,0 1280,0 1280,0" fill={c.shellLight} stroke={c.seamHighlight} strokeWidth="0.6" />
      <polygon points="1249,0 959,0 980.8,0 1053.3,0 1176.5,0 1263.5,0 1256.3,0" fill="#23262a" stroke={c.seamLight} strokeWidth="0.5" />
      <rect x="1280" y="0" width="40.6" height="7.3" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="1280" y="0" width="40.6" height="7.3" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="1280" y="0" width="34.8" height="7.3" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <circle cx="1280" cy="0" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="1280" cy="0" r="2.9" fill={c.boltFace} />
      <circle cx="1280" cy="0" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="1280" cy="0" r="2.9" fill={c.boltFace} />
      <circle cx="1046" cy="0" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="1046" cy="0" r="2.9" fill={c.boltFace} />
      <line x1="1220" y1="0" x2="1249" y2="0" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1002.5" y1="0" x2="1024.3" y2="0" stroke={c.seamStroke} strokeWidth="0.7" />

      {/* LEFT SIDE */}
      <polygon points="0,0 0,0 0,0 0,91.8 0,360 0,628.3 0,720 0,720 0,720" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="0,0 0,0 0,1.9 0,96.1 0,360 0,623.9 0,720 0,720 0,720" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="0,70 0,84.5 0,186 0,534 0,635.5 0,650" fill="#242628" stroke={c.seamHighlight} strokeWidth="0.5" />
      <line x1="0" y1="128" x2="0" y2="142.5" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="258.5" x2="0" y2="265.8" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="360" x2="0" y2="360" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="461.5" x2="0" y2="454.3" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="592" x2="0" y2="577.5" stroke={c.seamStroke} strokeWidth="0.7" />
      <circle cx="0" cy="128" r="6.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="0" cy="128" r="2.6" fill={c.boltFace} />
      <circle cx="0" cy="360" r="6.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="0" cy="360" r="2.6" fill={c.boltFace} />
      <circle cx="0" cy="592" r="6.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="0" cy="592" r="2.6" fill={c.boltFace} />

      {/* RIGHT SIDE — mirror */}
      <polygon points="1280,0 1280,0 1280,0 1280,91.8 1280,360 1280,628.3 1280,720 1280,720 1280,720" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="1280,0 1280,0 1280,1.9 1280,96.1 1280,360 1280,623.9 1280,720 1280,720 1280,720" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="1280,70 1280,84.5 1280,186 1280,534 1280,635.5 1280,650" fill="#242628" stroke={c.seamHighlight} strokeWidth="0.5" />
      <line x1="1280" y1="128" x2="1280" y2="142.5" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="258.5" x2="1280" y2="265.8" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="360" x2="1280" y2="360" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="461.5" x2="1280" y2="454.3" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="592" x2="1280" y2="577.5" stroke={c.seamStroke} strokeWidth="0.7" />
      <circle cx="1280" cy="128" r="6.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1280" cy="128" r="2.6" fill={c.boltFace} />
      <circle cx="1280" cy="360" r="6.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1280" cy="360" r="2.6" fill={c.boltFace} />
      <circle cx="1280" cy="592" r="6.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1280" cy="592" r="2.6" fill={c.boltFace} />

      {/* BOTTOM LEFT */}
      <polygon points="0,720 0,720 0,720 31,720 205,720 147,720 2,720 0,720 0,720" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="0,720 0,720 0,720 28.1,720 197.8,720 139.8,720 0,720 0,720 0,720" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <circle cx="0" cy="720" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="0" cy="720" r="2.9" fill={c.boltFace} />
      <circle cx="0" cy="720" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="0" cy="720" r="2.9" fill={c.boltFace} />

      {/* BOTTOM RIGHT */}
      <polygon points="1280,720 1280,720 1280,720 1249,720 1075,720 1133,720 1278,720 1280,720 1280,720" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="1280,720 1280,720 1280,720 1251.9,720 1082.3,720 1140.3,720 1280,720 1280,720 1280,720" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <circle cx="1280" cy="720" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1280" cy="720" r="2.9" fill={c.boltFace} />
      <circle cx="1280" cy="720" r="7.3" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1280" cy="720" r="2.9" fill={c.boltFace} />

      {/* BOTTOM CENTER — chin guard */}
      <polygon points="147,720 205,720 437,720 553,720 640,720 727,720 843,720 1075,720 1133,720 1046,720 872,720 727,720 640,720 553,720 408,720 234,720" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="176,720 226.8,720 439.9,720 555.9,720 640,720 724.1,720 840.1,720 1053.3,720 1104,720 1024.3,720 869.1,720 727,720 640,720 553,720 410.9,720 255.8,720" fill="#202326" stroke={c.seamLight} strokeWidth="0.6" />
      <polygon points="408,720 553,720 640,720 727,720 872,720 857.5,720 756,720 640,720 524,720 422.5,720" fill="#242628" stroke={c.seamHighlight} strokeWidth="0.5" />
      {/* Electronic modules */}
      <rect x="241.3" y="720" width="75.4" height="29" rx="2" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.5" />
      <rect x="249.9" y="720" width="13" height="17.4" rx="1" fill="#282b2f" />
      <rect x="268.8" y="720" width="13" height="17.4" rx="1" fill="#282b2f" />
      <rect x="287.7" y="720" width="13" height="17.4" rx="1" fill="#282b2f" />
      <rect x="963.3" y="720" width="75.4" height="29" rx="2" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.5" />
      <rect x="972" y="720" width="13" height="17.4" rx="1" fill="#282b2f" />
      <rect x="990.9" y="720" width="13" height="17.4" rx="1" fill="#282b2f" />
      <rect x="1009.8" y="720" width="13" height="17.4" rx="1" fill="#282b2f" />
      {/* Chin guard traces */}
      <polyline points="318.1,720 408,720 422.5,720" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      <polyline points="318.1,720 408,720 425.4,720" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      <polyline points="961.9,720 872,720 857.5,720" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      <polyline points="961.9,720 872,720 854.6,720" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      {/* Chin guard center point */}
      <circle cx="640" cy="720" r="10.2" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" />
      <circle cx="640" cy="720" r="4.3" fill="#242628" />
      <circle cx="640" cy="720" r="1.4" fill="#484c52" />

      {/* ═══════════════════════════════════════
           VISOR RING
           ═══════════════════════════════════════ */}
      {/* Outer shadow */}
      <polygon points="31,0 350,0 640,0 930,0 1249,0 1280,91.8 1280,360 1280,628.3 1249,720 1075,720 843,720 640,720 437,720 205,720 31,720 0,628.3 0,360 0,91.8" fill="none" stroke="#06070a" strokeWidth="14" />
      {/* Main metallic ring */}
      <polygon points="31,0 350,0 640,0 930,0 1249,0 1280,91.8 1280,360 1280,628.3 1249,720 1075,720 843,720 640,720 437,720 205,720 31,720 0,628.3 0,360 0,91.8" fill="none" stroke={c.visorRingOuter} strokeWidth="6" />
      {/* Inner highlight */}
      <polygon points="35.4,0 351.4,0 640,0 928.5,0 1244.7,0 1280,94.7 1280,360 1280,625.3 1244.7,720 1073.5,720 841.5,720 640,720 438.5,720 206.4,720 35.4,720 0,625.3 0,360 0,94.7" fill="none" stroke={c.visorRingInner} strokeWidth="1.5" />
      {/* Rubber gasket — stroke only, no fill to keep visor transparent */}
      <polygon points="39.7,0 352.9,0 640,0 927.1,0 1240.3,0 1280,97.6 1280,360 1280,622.5 1240.3,720 1072.1,720 840.1,720 640,720 439.9,720 207.9,720 39.7,720 0,622.5 0,360 0,97.6" fill="none" stroke={c.visorGasket} strokeWidth="6" />

      {/* Ring bolts */}
      {[
        [350, 0], [640, 0], [930, 0], [1280, 91.8], [1280, 628.3],
        [930, 720], [640, 720], [350, 720], [0, 628.3], [0, 91.8],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="8" fill="#1c1f23" stroke={c.seamHighlight} strokeWidth="0.8" />
          <circle cx={cx} cy={cy} r="3.2" fill={c.boltFace} />
        </g>
      ))}

      {/* ═══════════════════════════════════════
           VISOR AREA — transparent to show 3D content
           Only the vignette overlay renders here.
           ═══════════════════════════════════════ */}
      <radialGradient id="vv" cx="640" cy="360" r="696" gradientUnits="userSpaceOnUse">
        <stop offset="35%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.75)" />
      </radialGradient>
      <polygon points="44.1,3.3 354.4,0 640,0 925.6,0 1235.9,3.3 1280,100.4 1280,360 1280,619.5 1235.9,716.7 1070.7,720 838.6,720 640,720 441.4,720 209.4,720 44.1,716.7 0,619.5 0,360 0,100.4" fill="url(#vv)" />

      {/* Top glass reflection */}
      <ellipse cx="640" cy="0" rx="377" ry="20.3" fill="rgba(255,255,255,0.024)" />

      {/* ═══ Ambient Lighting (rendered on top of panels) ═══ */}
      <g pointerEvents="none">
        <path fill="url(#visorGlow)" fillRule="evenodd" d="M 0,0 L 1280,0 L 1280,720 L 0,720 Z M 31,0 L 350,0 L 640,0 L 930,0 L 1249,0 L 1280,91.8 L 1280,360 L 1280,628.3 L 1249,720 L 1075,720 L 843,720 L 640,720 L 437,720 L 205,720 L 31,720 L 0,628.3 L 0,360 L 0,91.8 Z" />
        <path fill="url(#topLight)" fillRule="evenodd" d="M 0,0 L 1280,0 L 1280,720 L 0,720 Z M 31,0 L 350,0 L 640,0 L 930,0 L 1249,0 L 1280,91.8 L 1280,360 L 1280,628.3 L 1249,720 L 1075,720 L 843,720 L 640,720 L 437,720 L 205,720 L 31,720 L 0,628.3 L 0,360 L 0,91.8 Z" />
      </g>

      {/* ═══ Circuit traces ═══ */}
      <polyline points="89,14.9 190.5,0 335.5,0 451.5,0" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="828.5,0 944.5,0 1089.5,0 1191,14.9" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="89,705.1 190.5,720 335.5,720 451.5,720" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="828.5,720 944.5,720 1089.5,720 1191,705.1" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="0,200.5 9.3,186 28.1,178.8" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="0,519.5 9.3,534 28.1,541.3" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="1280,200.5 1270.8,186 1251.9,178.8" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="1280,519.5 1270.8,534 1251.9,541.3" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
    </svg>
  );
});
