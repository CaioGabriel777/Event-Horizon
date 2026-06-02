"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const C      = "#00d4ff";
const C_DIM  = "rgba(0,212,255,0.38)";
const C_FAINT= "rgba(0,212,255,0.10)";
const OK     = "#00ff88";
const WARN   = "#ff8c00";
const PANEL  = "rgba(0,5,16,0.82)";
const BORDER = "rgba(0,212,255,0.18)";
const MONO   = "'Courier New','Lucida Console',monospace";

// ─── ECG animated wave ────────────────────────────────────────────────────────
function ECGLine() {
  return (
    <svg width="110" height="20" viewBox="0 0 110 20" style={{ display:"block" }}>
      <path
        d="M0,10 L12,10 L15,2 L18,18 L21,10 L36,10 L39,10 L42,3 L45,17 L48,10 L63,10 L66,10 L69,2 L72,18 L75,10 L90,10 L93,10 L96,3 L99,17 L102,10 L110,10"
        fill="none" stroke={C} strokeWidth="1.5"
        strokeDasharray="250" strokeDashoffset="250"
        style={{ animation:"ecg 1.7s linear infinite" }}
      />
    </svg>
  );
}

// ─── Radar sweep ─────────────────────────────────────────────────────────────
function RadarSweep({ angle }: { angle: number }) {
  const s=56, cx=28, cy=28, r=25;
  const rad = (angle * Math.PI) / 180;
  const x = cx + r * Math.sin(rad);
  const y = cy - r * Math.cos(rad);
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {[r, r*.65, r*.33].map((ri,i) => (
        <circle key={i} cx={cx} cy={cy} r={ri} fill="none"
          stroke={C_FAINT} strokeWidth="0.6" />
      ))}
      <line x1={cx} y1={cy} x2={cx} y2={cy-r} stroke={C_FAINT} strokeWidth="0.5"/>
      <line x1={cx-r} y1={cy} x2={cx+r} y2={cy} stroke={C_FAINT} strokeWidth="0.5"/>
      <line x1={cx} y1={cy} x2={x} y2={y} stroke={C} strokeWidth="1.5"/>
      <circle cx={cx} cy={cy} r={2.5} fill={C}/>
    </svg>
  );
}

// ─── The immersive visor frame ────────────────────────────────────────────────
function VisorFrame() {
  return (
    <svg
      style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none" }}
      preserveAspectRatio="none"
    >
      <defs>
        {/* Cuts out the oval visor window from the dark overlay */}
        <mask id="visor-cutout">
          <rect width="100%" height="100%" fill="white"/>
          <ellipse cx="50%" cy="50%" rx="42%" ry="41%" fill="black"/>
        </mask>
        {/* Soft radial for the rim inner face */}
        <radialGradient id="rim-grad" cx="50%" cy="30%" r="70%" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#0a1020"/>
          <stop offset="60%"  stopColor="#050810"/>
          <stop offset="100%" stopColor="#020408"/>
        </radialGradient>
        {/* Glow filter for cyan lines */}
        <filter id="cyan-glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ① Fully opaque dark frame — covers corners completely */}
      <rect width="100%" height="100%"
        fill="rgba(0,2,8,0.97)"
        mask="url(#visor-cutout)"
      />

      {/* ② Extra dark vignette layer for depth */}
      <rect width="100%" height="100%"
        fill="rgba(0,0,4,0.40)"
        mask="url(#visor-cutout)"
      />

      {/* ③ Rim bevel — outermost dark stroke (physical depth) */}
      <ellipse cx="50%" cy="50%" rx="42%" ry="41%"
        fill="none" stroke="rgba(1,3,10,1)" strokeWidth="18"/>

      {/* ④ Metallic mid-rim gradient stroke */}
      <ellipse cx="50%" cy="50%" rx="42%" ry="41%"
        fill="none" stroke="rgba(20,40,70,0.9)" strokeWidth="8"/>

      {/* ⑤ Chrome highlight line — inner edge of the rim */}
      <ellipse cx="50%" cy="50%" rx="42%" ry="41%"
        fill="none" stroke="rgba(80,130,180,0.55)" strokeWidth="1.5"/>

      {/* ⑥ Cyan glow seam — light bleeding from HUD electronics */}
      <ellipse cx="50%" cy="50%" rx="41.6%" ry="40.6%"
        fill="none" stroke="rgba(0,212,255,0.30)" strokeWidth="1"
        filter="url(#cyan-glow)"/>

      {/* ⑦ Diffuse inner glow (the luminous ring inside the visor) */}
      <ellipse cx="50%" cy="50%" rx="41.2%" ry="40.2%"
        fill="none" stroke="rgba(0,180,230,0.08)" strokeWidth="12"/>

      {/* ⑧ Technical tick marks — major every 30° (12 marks) */}
      <ellipse cx="50%" cy="50%" rx="42.8%" ry="41.8%"
        fill="none" stroke="rgba(0,212,255,0.45)" strokeWidth="1"
        strokeDasharray="3 calc((100% * 3.1416 * 2 - 36) / 11)"
      />

      {/* ⑨ Minor tick marks (denser, smaller) */}
      <ellipse cx="50%" cy="50%" rx="43.2%" ry="42.2%"
        fill="none" stroke="rgba(0,212,255,0.18)" strokeWidth="0.7"
        strokeDasharray="1 14"
      />

      {/* ⑩ Top glass reflection highlight */}
      <ellipse cx="50%" cy="33%" rx="22%" ry="5%"
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>

      {/* ⑪ Bottom chin — extra-dark area (chin of helmet is wider) */}
      <rect x="0" y="82%" width="100%" height="18%" fill="rgba(0,1,5,0.60)"
        mask="url(#visor-cutout)"/>

      {/* ⑫ Side reinforcement marks (left & right frame details) */}
      {[["8.5%","48%"],["8.5%","50%"],["8.5%","52%"],["91.5%","48%"],["91.5%","50%"],["91.5%","52%"]].map(([x,y],i) => (
        <rect key={i} x={x} y={y} width="0.6%" height="0.3"
          fill="rgba(0,212,255,0.5)" rx="1"/>
      ))}
    </svg>
  );
}

// ─── Corner tactical bracket ──────────────────────────────────────────────────
function CornerBracket({ pos }: { pos:"tl"|"tr"|"bl"|"br" }) {
  const mirror = { tl:"", tr:"scale(-1,1)", bl:"scale(1,-1)", br:"scale(-1,-1)" };
  return (
    <div style={{
      position:"absolute", width:28, height:28,
      ...(pos[0]==="t" ? { top:"10%" } : { bottom:"10%" }),
      ...(pos[1]==="l" ? { left:"10%" } : { right:"10%" }),
    }}>
      <svg width="28" height="28" viewBox="0 0 28 28"
        style={{ transform:mirror[pos], transformOrigin:"center" }}>
        <path d="M22,3 L3,3 L3,22" fill="none" stroke={C} strokeWidth="2"
          strokeLinecap="square"/>
        <rect x="1" y="1" width="4" height="4" fill={C}
          style={{ animation:"blink 2.8s ease-in-out infinite" }}/>
      </svg>
    </div>
  );
}

// ─── Reticle ──────────────────────────────────────────────────────────────────
function Reticle({ innerRef }: { innerRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div ref={innerRef} style={{
      position:"absolute", left:"50%", top:"50%",
      transform:"translate(-50%,-50%)",
      width:0, height:0, pointerEvents:"none",
    }}>
      {[88,58,36].map((sz,i) => (
        <div key={i} style={{
          position:"absolute", left:"50%", top:"50%",
          width:sz, height:sz, borderRadius:"50%",
          border:`1px solid rgba(0,212,255,${0.16-i*0.04})`,
          transform:"translate(-50%,-50%)",
          animation:`pulse-ring ${2.2+i*0.6}s ease-out infinite`,
          animationDelay:`${i*0.55}s`,
        }}/>
      ))}
      {/* Static ring */}
      <div style={{
        position:"absolute", left:"50%", top:"50%",
        width:44, height:44, borderRadius:"50%",
        border:`1px solid ${C_FAINT}`,
        transform:"translate(-50%,-50%)",
      }}/>
      {/* Crosshairs */}
      <div style={{ position:"absolute", top:"50%", left:-30, right:-30, height:1,
        background:`linear-gradient(90deg,transparent,${C_FAINT} 20%,${C_FAINT} 80%,transparent)`,
        transform:"translateY(-50%)" }}/>
      <div style={{ position:"absolute", left:"50%", top:-30, bottom:-30, width:1,
        background:`linear-gradient(180deg,transparent,${C_FAINT} 20%,${C_FAINT} 80%,transparent)`,
        transform:"translateX(-50%)" }}/>
      <div style={{
        position:"absolute", left:"50%", top:"50%",
        width:5, height:5, borderRadius:"50%",
        border:`1px solid rgba(0,212,255,0.6)`,
        transform:"translate(-50%,-50%)",
      }}/>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function HelmetHUD() {
  const [isHelmetOn, setIsHelmetOn]   = useState(true);
  const [heartRate,  setHeartRate]    = useState(72);
  const [elapsed,    setElapsed]      = useState(0);
  const [radarAngle, setRadarAngle]   = useState(0);
  const [gravity,    setGravity]      = useState("1.3G");

  const hudRef     = useRef<HTMLDivElement>(null!);
  const reticleRef = useRef<HTMLDivElement>(null!);
  const mouse      = useRef({ x:0, y:0 });
  const tgt        = useRef({ x:0, y:0 });
  const rafRef     = useRef<number>(0);

  // Keyboard toggle
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "h") setIsHelmetOn(p => !p);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // Biometrics loop
  useEffect(() => {
    if (!isHelmetOn) return;
    const hr = setInterval(() =>
      setHeartRate(p => Math.max(66,Math.min(84, p+(Math.random()-.5)*5))), 1800);
    const el = setInterval(() => setElapsed(p => p+1), 1000);
    const ra = setInterval(() => setRadarAngle(p => (p+2)%360), 20);
    const gv = setInterval(() =>
      setGravity(`${(1.1+Math.random()*.7).toFixed(1)}G`), 3200);
    return () => { clearInterval(hr); clearInterval(el); clearInterval(ra); clearInterval(gv); };
  }, [isHelmetOn]);

  // Mouse parallax
  useEffect(() => {
    if (!isHelmetOn) return;
    const onMove = (e: MouseEvent) => {
      tgt.current.x = (e.clientX/window.innerWidth)*2-1;
      tgt.current.y = (e.clientY/window.innerHeight)*2-1;
    };
    window.addEventListener("mousemove", onMove);
    const loop = () => {
      mouse.current.x += (tgt.current.x-mouse.current.x)*0.07;
      mouse.current.y += (tgt.current.y-mouse.current.y)*0.07;
      if (hudRef.current) {
        hudRef.current.style.transform =
          `translate3d(${mouse.current.x*-20}px,${mouse.current.y*-20}px,0)`;
      }
      if (reticleRef.current) {
        reticleRef.current.style.transform =
          `translate(calc(-50% + ${mouse.current.x*52}px),calc(-50% + ${mouse.current.y*52}px))`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isHelmetOn]);

  const formatTime = (s: number) => {
    const h   = String(Math.floor(s/3600)).padStart(2,"0");
    const m   = String(Math.floor((s%3600)/60)).padStart(2,"0");
    const sec = String(s%60).padStart(2,"0");
    return `T+${h}:${m}:${sec}`;
  };

  const panelBase: React.CSSProperties = {
    position:"absolute",
    background: PANEL,
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
    padding: "14px 13px",
    fontFamily: MONO,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  };

  return (
    <AnimatePresence>
      {isHelmetOn && (
        <motion.div
          key="helmet"
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          exit={{ opacity:0, scale:1.04, filter:"blur(12px)" }}
          transition={{ duration:0.7, ease:"easeInOut" }}
          style={{ position:"fixed", inset:0, zIndex:40, pointerEvents:"none", overflow:"hidden" }}
        >
          {/* ── Global keyframes ─────────────────────────────────────── */}
          <style>{`
            @keyframes ecg {
              0%   { stroke-dashoffset: 250; }
              85%  { stroke-dashoffset: 0;   }
              100% { stroke-dashoffset: 0;   }
            }
            @keyframes blink {
              0%,100% { opacity:1;   }
              50%     { opacity:0.15;}
            }
            @keyframes pulse-ring {
              0%   { transform:translate(-50%,-50%) scale(1);    opacity:0.45; }
              100% { transform:translate(-50%,-50%) scale(1.38); opacity:0;    }
            }
            @keyframes fadein {
              from { opacity:0; transform:translateY(5px); }
              to   { opacity:1; transform:translateY(0);   }
            }
          `}</style>

          {/* ── 1. VISOR FRAME (SVG — fully opaque dark rim) ─────────── */}
          <VisorFrame />

          {/* ── 2. Soft inner vignette for depth ─────────────────────── */}
          <div style={{
            position:"absolute", inset:0, zIndex:1, pointerEvents:"none",
            background:"radial-gradient(ellipse 80% 82% at 50% 50%, transparent 48%, rgba(0,2,10,0.45) 75%, rgba(0,0,6,0.80) 100%)",
          }}/>

          {/* ── 3. PARALLAX LAYER ─────────────────────────────────────── */}
          <div ref={hudRef} style={{ position:"absolute", inset:0, zIndex:5 }}>

            {/* Corner brackets */}
            {(["tl","tr","bl","br"] as const).map(c => <CornerBracket key={c} pos={c}/>)}

            {/* ── TOP STATUS BAR (centered via flex) ────────────────── */}
            <div style={{
              position:"absolute", top:"8%",
              left:0, right:0,
              display:"flex", justifyContent:"center",
              animation:"fadein 0.9s ease 0.3s both",
            }}>
              <div style={{
                display:"flex", alignItems:"center", gap:14,
                background:PANEL, border:`1px solid ${BORDER}`,
                borderRadius:2, padding:"5px 20px",
                fontFamily:MONO, fontSize:10, color:C,
                letterSpacing:"0.14em", whiteSpace:"nowrap",
                backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
              }}>
                <span style={{ color:C_DIM }}>STARK.OS</span>
                <span style={{ color:BORDER }}>│</span>
                <span>PHASE 2 — APPROACH</span>
                <span style={{ color:BORDER }}>│</span>
                <span style={{ color:OK, animation:"blink 2s ease-in-out infinite" }}>■</span>
                <span style={{ color:C_DIM }}>SYS NOMINAL</span>
                <span style={{ color:BORDER }}>│</span>
                <span style={{ color:C_DIM }}>{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* ── LEFT PANEL (biometrics, minimal) ─────────────────── */}
            <div style={{
              ...panelBase,
              left:"4%", top:"50%",
              transform:"translateY(-50%) rotateY(14deg)",
              transformOrigin:"right center",
              width:148,
              animation:"fadein 0.9s ease 0.1s both",
            }}>
              <div style={{ fontSize:9, color:C_DIM, letterSpacing:"0.2em",
                borderBottom:`1px solid ${BORDER}`, paddingBottom:8, marginBottom:12 }}>
                BIOMETRICS
              </div>

              {/* O2 */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:9, color:C_DIM, letterSpacing:"0.18em", marginBottom:3 }}>O₂ LEVEL</div>
                <div style={{ fontSize:13, color:OK, letterSpacing:"0.1em", marginBottom:4 }}>98%</div>
                <div style={{ height:2, background:"rgba(255,255,255,0.07)", borderRadius:1 }}>
                  <div style={{ width:"98%", height:"100%", background:OK, borderRadius:1 }}/>
                </div>
              </div>

              {/* Heart rate */}
              <div>
                <div style={{ fontSize:9, color:C_DIM, letterSpacing:"0.18em", marginBottom:4 }}>HEART RATE</div>
                <ECGLine/>
                <div style={{ fontSize:13, color:OK, letterSpacing:"0.1em" }}>
                  {Math.round(heartRate)}
                  <span style={{ fontSize:9, color:C_DIM, marginLeft:4 }}>BPM</span>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL (environment, minimal) ───────────────── */}
            <div style={{
              ...panelBase,
              right:"4%", top:"50%",
              transform:"translateY(-50%) rotateY(-14deg)",
              transformOrigin:"left center",
              width:148,
              animation:"fadein 0.9s ease 0.2s both",
            }}>
              <div style={{ fontSize:9, color:C_DIM, letterSpacing:"0.2em",
                borderBottom:`1px solid ${BORDER}`, paddingBottom:8, marginBottom:12 }}>
                ENVIRONMENT
              </div>

              {/* Gravity */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:C_DIM, letterSpacing:"0.18em", marginBottom:3 }}>GRAVITY</div>
                <div style={{ fontSize:13, color:WARN, letterSpacing:"0.1em",
                  animation:"blink 3s ease-in-out infinite" }}>
                  {gravity} <span style={{ fontSize:9, color:C_DIM }}>[WARN]</span>
                </div>
              </div>

              {/* Radar */}
              <div>
                <div style={{ fontSize:9, color:C_DIM, letterSpacing:"0.18em", marginBottom:6 }}>RADAR</div>
                <RadarSweep angle={radarAngle}/>
                <div style={{ fontSize:9, color:C_DIM, letterSpacing:"0.12em", marginTop:3 }}>
                  ACTIVE SCAN
                </div>
              </div>
            </div>

            {/* ── CENTER RETICLE ─────────────────────────────────────── */}
            <Reticle innerRef={reticleRef}/>

            {/* ── BOTTOM — centered via flex ─────────────────────────── */}
            <div style={{
              position:"absolute", bottom:"8%",
              left:0, right:0,
              display:"flex", flexDirection:"column", alignItems:"center", gap:8,
              animation:"fadein 1s ease 0.4s both",
            }}>
              {/* Data strip */}
              <div style={{
                display:"flex", gap:18,
                fontFamily:MONO, fontSize:9,
                color:C_DIM, letterSpacing:"0.13em",
              }}>
                <span>EH DIST <span style={{ color:C }}>4.2 AU</span></span>
                <span>MASS <span style={{ color:WARN }}>10⁶ M☉</span></span>
                <span>TEMP <span style={{ color:C }}>36.8°C</span></span>
              </div>

              {/* Remove button — pointer-events auto only here */}
              <button
                onClick={() => setIsHelmetOn(false)}
                style={{
                  pointerEvents:"auto", cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                  background:"none", border:"none", padding:0,
                }}
              >
                <div style={{
                  width:40, height:40, borderRadius:"50%",
                  border:`1px solid ${BORDER}`,
                  background: PANEL,
                  backdropFilter:"blur(10px)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:C, fontFamily:MONO, fontSize:12, letterSpacing:"0.1em",
                  transition:"border-color 0.3s",
                }}>H</div>
                <span style={{ fontFamily:MONO, fontSize:9, color:C_DIM, letterSpacing:"0.22em" }}>
                  REMOVE HELMET
                </span>
              </button>
            </div>

          </div>{/* /parallax */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}