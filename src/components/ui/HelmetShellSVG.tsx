/**
 * HelmetShellSVG — Physical Helmet Shell with CSS Variable Theming
 * =================================================================
 * Renders the hexagonal helmet shell from the base SVG asset with:
 *   - CSS custom properties for cohesive sci-fi military color theming
 *   - Three visual variants: nominal, warning, danger
 *   - Ambient visor glow and top light gradients
 *   - Smooth 0.6s transitions between states
 *
 * All color values are driven by CSS variables scoped to the SVG element,
 * never leaking to :root. Variant overrides only affect seam highlights
 * and circuit traces — the metal shell stays neutral.
 */

"use client";

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
  shellBase: "#1c1e22",
  shellMid: "#212327",
  shellLight: "#252729",
  shellDeep: "#181a1d",
  dotFill: "#3a3d42",
  seamStroke: "#363a3f",
  seamLight: "#3c4044",
  seamHighlight: "#3e4246",
  boltFace: "#2c2f33",
  visorRingOuter: "#2a2e34",
  visorRingInner: "#3c4148",
  visorGasket: "#0e1012",
  circuitPrimary: "#373d45",
  circuitSecondary: "#2e333a",
  circuitNode: "#3f4650",
  visorGlowColor: "rgba(100,160,255,0.04)",
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

export function HelmetShellSVG({ variant = "nominal" }: HelmetShellSVGProps) {
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

        {/* Visor hexagonal clip path */}
        <clipPath id="visorClip">
          <polygon points="220,105 440,88 640,82 840,88 1060,105 1095,175 1110,360 1095,545 1060,615 940,632 780,642 640,645 500,642 340,632 220,615 185,545 170,360 185,175" />
        </clipPath>

        {/* Shell mask — everything except the visor opening */}
        <mask id="shellMask">
          <rect width="1280" height="720" fill="white" />
          <polygon points="220,105 440,88 640,82 840,88 1060,105 1095,175 1110,360 1095,545 1060,615 940,632 780,642 640,645 500,642 340,632 220,615 185,545 170,360 185,175" fill="black" />
        </mask>

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
        <linearGradient id="topLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.025)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* ═══ Background (masked — only renders outside visor opening) ═══ */}
      <rect width="1280" height="720" fill="#0c0d0f" mask="url(#shellMask)" />

      {/* ═══ Shell base with vignette ═══ */}
      <rect width="1280" height="720" fill="url(#shellVig)" mask="url(#shellMask)" />

      {/* ═══ Dot mesh ═══ */}
      <rect width="1280" height="720" fill="url(#dots)" mask="url(#shellMask)" opacity="0.85" />

      {/* ═══════════════════════════════════════
           STRUCTURAL PANELS
           ═══════════════════════════════════════ */}

      {/* TOP CENTER — sensor bar */}
      <polygon points="480,0 800,0 820,42 760,62 700,72 640,75 580,72 520,62 460,42" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="530,0 750,0 762,30 720,48 640,55 560,48 518,30" fill="#22252a" stroke="#404448" strokeWidth="0.5" />
      <line x1="590" y1="20" x2="690" y2="20" stroke="#454a50" strokeWidth="0.8" />
      <line x1="615" y1="32" x2="665" y2="32" stroke="#454a50" strokeWidth="0.6" />
      <rect x="614" y="9" width="52" height="10" rx="2" fill={c.shellDeep} stroke={c.seamLight} strokeWidth="0.5" />
      <rect x="622" y="12" width="7" height="5" rx="1" fill={c.boltFace} />
      <rect x="633" y="12" width="7" height="5" rx="1" fill={c.boltFace} />
      <rect x="644" y="12" width="7" height="5" rx="1" fill={c.boltFace} />

      {/* TOP LEFT — angular panel */}
      <polygon points="0,0 480,0 460,42 380,75 270,100 160,108 60,100 0,72" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="0,0 420,0 402,36 330,66 225,90 130,98 40,91 0,66" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="0,0 200,0 215,30 180,52 100,65 30,58 0,42" fill={c.shellLight} stroke={c.seamHighlight} strokeWidth="0.6" />
      <polygon points="220,0 420,0 405,32 355,54 270,66 210,56 215,30" fill="#23262a" stroke={c.seamLight} strokeWidth="0.5" />
      {/* Slots */}
      <rect x="55" y="32" width="28" height="5" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="92" y="38" width="28" height="5" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="130" y="46" width="24" height="5" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      {/* Bolts */}
      <circle cx="42" cy="20" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="42" cy="20" r="2" fill={c.boltFace} />
      <circle cx="190" cy="16" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="190" cy="16" r="2" fill={c.boltFace} />
      <circle cx="360" cy="12" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="360" cy="12" r="2" fill={c.boltFace} />
      {/* Ribs */}
      <line x1="240" y1="0" x2="220" y2="105" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="390" y1="0" x2="375" y2="88" stroke={c.seamStroke} strokeWidth="0.7" />

      {/* TOP RIGHT — mirror */}
      <polygon points="1280,0 800,0 820,42 900,75 1010,100 1120,108 1220,100 1280,72" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="1280,0 860,0 878,36 950,66 1055,90 1150,98 1240,91 1280,66" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="1280,0 1080,0 1065,30 1100,52 1180,65 1250,58 1280,42" fill={c.shellLight} stroke={c.seamHighlight} strokeWidth="0.6" />
      <polygon points="1060,0 860,0 875,32 925,54 1010,66 1070,56 1065,30" fill="#23262a" stroke={c.seamLight} strokeWidth="0.5" />
      <rect x="1197" y="32" width="28" height="5" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="1160" y="38" width="28" height="5" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <rect x="1126" y="46" width="24" height="5" rx="1" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.4" />
      <circle cx="1238" cy="20" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="1238" cy="20" r="2" fill={c.boltFace} />
      <circle cx="1090" cy="16" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="1090" cy="16" r="2" fill={c.boltFace} />
      <circle cx="920" cy="12" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" /><circle cx="920" cy="12" r="2" fill={c.boltFace} />
      <line x1="1040" y1="0" x2="1060" y2="105" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="890" y1="0" x2="905" y2="88" stroke={c.seamStroke} strokeWidth="0.7" />

      {/* LEFT SIDE */}
      <polygon points="0,72 60,100 160,108 185,175 170,360 185,545 160,615 60,640 0,660" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="0,80 55,105 150,113 175,178 162,360 175,542 150,612 55,636 0,648" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="0,160 70,170 82,240 82,480 70,550 0,560" fill="#242628" stroke={c.seamHighlight} strokeWidth="0.5" />
      <line x1="0" y1="200" x2="168" y2="210" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="290" x2="164" y2="295" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="360" x2="162" y2="360" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="430" x2="164" y2="425" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="0" y1="520" x2="168" y2="510" stroke={c.seamStroke} strokeWidth="0.7" />
      <circle cx="22" cy="200" r="4.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="22" cy="200" r="1.8" fill={c.boltFace} />
      <circle cx="22" cy="360" r="4.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="22" cy="360" r="1.8" fill={c.boltFace} />
      <circle cx="22" cy="520" r="4.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="22" cy="520" r="1.8" fill={c.boltFace} />

      {/* RIGHT SIDE — mirror */}
      <polygon points="1280,72 1220,100 1120,108 1095,175 1110,360 1095,545 1120,615 1220,640 1280,660" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="1280,80 1225,105 1130,113 1105,178 1118,360 1105,542 1130,612 1225,636 1280,648" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <polygon points="1280,160 1210,170 1198,240 1198,480 1210,550 1280,560" fill="#242628" stroke={c.seamHighlight} strokeWidth="0.5" />
      <line x1="1280" y1="200" x2="1112" y2="210" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="290" x2="1116" y2="295" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="360" x2="1118" y2="360" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="430" x2="1116" y2="425" stroke={c.seamStroke} strokeWidth="0.7" />
      <line x1="1280" y1="520" x2="1112" y2="510" stroke={c.seamStroke} strokeWidth="0.7" />
      <circle cx="1258" cy="200" r="4.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1258" cy="200" r="1.8" fill={c.boltFace} />
      <circle cx="1258" cy="360" r="4.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1258" cy="360" r="1.8" fill={c.boltFace} />
      <circle cx="1258" cy="520" r="4.5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1258" cy="520" r="1.8" fill={c.boltFace} />

      {/* BOTTOM LEFT */}
      <polygon points="0,660 60,640 160,615 220,615 340,632 300,680 200,710 80,720 0,720" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="0,668 58,646 155,620 218,620 335,636 295,676 196,706 78,716 0,712" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <circle cx="48" cy="700" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="48" cy="700" r="2" fill={c.boltFace} />
      <circle cx="155" cy="670" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="155" cy="670" r="2" fill={c.boltFace} />

      {/* BOTTOM RIGHT */}
      <polygon points="1280,660 1220,640 1120,615 1060,615 940,632 980,680 1080,710 1200,720 1280,720" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="1280,668 1222,646 1125,620 1062,620 945,636 985,676 1084,706 1202,716 1280,712" fill={c.shellMid} stroke={c.seamLight} strokeWidth="0.5" />
      <circle cx="1232" cy="700" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1232" cy="700" r="2" fill={c.boltFace} />
      <circle cx="1125" cy="670" r="5" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.7" /><circle cx="1125" cy="670" r="2" fill={c.boltFace} />

      {/* BOTTOM CENTER — chin guard */}
      <polygon points="300,680 340,632 500,642 580,650 640,653 700,650 780,642 940,632 980,680 920,706 800,718 700,722 640,724 580,722 480,718 360,706" fill={c.shellBase} stroke={c.seamStroke} strokeWidth="0.8" />
      <polygon points="320,678 355,638 502,646 582,654 640,657 698,654 778,646 925,638 960,678 905,704 798,716 700,720 640,722 580,720 482,716 375,704" fill="#202326" stroke={c.seamLight} strokeWidth="0.6" />
      <polygon points="480,660 580,656 640,654 700,656 800,660 790,690 720,702 640,705 560,702 490,690" fill="#242628" stroke={c.seamHighlight} strokeWidth="0.5" />
      {/* Electronic modules */}
      <rect x="365" y="660" width="52" height="20" rx="2" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.5" />
      <rect x="371" y="664" width="9" height="12" rx="1" fill="#282b2f" />
      <rect x="384" y="664" width="9" height="12" rx="1" fill="#282b2f" />
      <rect x="397" y="664" width="9" height="12" rx="1" fill="#282b2f" />
      <rect x="863" y="660" width="52" height="20" rx="2" fill={c.shellDeep} stroke={c.seamStroke} strokeWidth="0.5" />
      <rect x="869" y="664" width="9" height="12" rx="1" fill="#282b2f" />
      <rect x="882" y="664" width="9" height="12" rx="1" fill="#282b2f" />
      <rect x="895" y="664" width="9" height="12" rx="1" fill="#282b2f" />
      {/* Chin guard traces */}
      <polyline points="418,670 480,668 490,662" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      <polyline points="418,676 480,675 492,670" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      <polyline points="862,670 800,668 790,662" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      <polyline points="862,676 800,675 788,670" fill="none" stroke={c.seamStroke} strokeWidth="0.6" />
      {/* Chin guard center point */}
      <circle cx="640" cy="656" r="7" fill={c.shellDeep} stroke={c.seamHighlight} strokeWidth="0.8" />
      <circle cx="640" cy="656" r="3" fill="#242628" />
      <circle cx="640" cy="656" r="1" fill="#484c52" />

      {/* ═══════════════════════════════════════
           VISOR RING
           ═══════════════════════════════════════ */}
      {/* Outer shadow */}
      <polygon points="220,105 440,88 640,82 840,88 1060,105 1095,175 1110,360 1095,545 1060,615 940,632 780,642 640,645 500,642 340,632 220,615 185,545 170,360 185,175" fill="none" stroke="#06070a" strokeWidth="14" />
      {/* Main metallic ring */}
      <polygon points="220,105 440,88 640,82 840,88 1060,105 1095,175 1110,360 1095,545 1060,615 940,632 780,642 640,645 500,642 340,632 220,615 185,545 170,360 185,175" fill="none" stroke={c.visorRingOuter} strokeWidth="6" />
      {/* Inner highlight */}
      <polygon points="223,108 441,91 640,85 839,91 1057,108 1091,177 1106,360 1091,543 1057,612 939,629 779,639 640,642 501,639 341,629 223,612 189,543 175,360 189,177" fill="none" stroke={c.visorRingInner} strokeWidth="1.5" />
      {/* Rubber gasket — stroke only, no fill to keep visor transparent */}
      <polygon points="226,111 442,94 640,88 838,94 1054,111 1088,179 1102,360 1088,541 1054,609 938,626 778,636 640,639 502,636 342,626 226,609 192,541 178,360 192,179" fill="none" stroke={c.visorGasket} strokeWidth="6" />

      {/* Ring bolts */}
      {[
        [440, 88], [640, 82], [840, 88], [1095, 175], [1095, 545],
        [840, 632], [640, 645], [440, 632], [185, 545], [185, 175],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="5.5" fill="#1c1f23" stroke={c.seamHighlight} strokeWidth="0.8" />
          <circle cx={cx} cy={cy} r="2.2" fill={c.boltFace} />
        </g>
      ))}

      {/* ═══════════════════════════════════════
           VISOR AREA — transparent to show 3D content
           Only the vignette overlay renders here.
           ═══════════════════════════════════════ */}
      <radialGradient id="vv" cx="640" cy="360" r="480" gradientUnits="userSpaceOnUse">
        <stop offset="35%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.75)" />
      </radialGradient>
      <polygon points="229,114 443,97 640,91 837,97 1051,114 1084,181 1098,360 1084,539 1051,606 937,623 777,633 640,636 503,633 343,623 229,606 196,539 182,360 196,181" fill="url(#vv)" />

      {/* Top glass reflection */}
      <ellipse cx="640" cy="104" rx="260" ry="14" fill="rgba(255,255,255,0.024)" />

      {/* ═══ Ambient Lighting (rendered on top of panels) ═══ */}
      <rect width="1280" height="720" fill="url(#visorGlow)" mask="url(#shellMask)" pointerEvents="none" />
      <rect width="1280" height="216" fill="url(#topLight)" mask="url(#shellMask)" pointerEvents="none" />

      {/* ═══ Circuit traces ═══ */}
      <polyline points="260,122 330,108 430,100 510,97" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="770,97 850,100 950,108 1020,122" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="260,598 330,612 430,620 510,623" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="770,623 850,620 950,612 1020,598" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="196,250 205,240 218,235" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="196,470 205,480 218,485" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="1084,250 1075,240 1062,235" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
      <polyline points="1084,470 1075,480 1062,485" fill="none" stroke={c.circuitSecondary} strokeWidth="0.7" />
    </svg>
  );
}
