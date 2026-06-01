/**
 * HelmetHUD — Cinematic White Astronaut Visor
 * ============================================================================
 * Diegetic UI overlay executing a sleek, modern sci-fi aesthetic.
 * Features a white polymer helmet frame using advanced CSS shadows,
 * SVG film grain, parallax telemetry, and glowing typography.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function HelmetHUD() {
  // ─── State & Refs ─────────────────────────────────────────────────────────

  const [isHelmetOn, setIsHelmetOn] = useState(true);

  const hudRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  // ─── Global Keyboard Listener ─────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "h") {
        setIsHelmetOn((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Parallax Animation Loop ──────────────────────────────────────────────

  useEffect(() => {
    if (!isHelmetOn) return;

    const handleMouseMove = (e: MouseEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      mouse.current.x += (target.current.x - mouse.current.x) * 0.1;
      mouse.current.y += (target.current.y - mouse.current.y) * 0.1;

      if (hudRef.current) {
        const tx = mouse.current.x * -30;
        const ty = mouse.current.y * -30;
        hudRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isHelmetOn]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isHelmetOn && (
        <motion.div
          key="helmet-hud"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
          transition={{ duration: 0.3, ease: "circIn" }}
          className="fixed inset-0 z-40 pointer-events-none overflow-hidden"
        >
          {/* ─── Layer 1: Glass Grain ────────────────────────────────────── */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03] z-10 pointer-events-none">
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
          </svg>

          {/* ─── Layer 2: Futuristic White Helmet Frame ──────────────────── */}
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              top: '4vw', bottom: '4vw', left: '4vw', right: '4vw',
              borderRadius: '4vw',
              boxShadow: `
                0 0 0 100vmax #f8fafc, 
                inset 0 0 50px 10px rgba(0,0,0,0.8),
                inset 0 0 120px rgba(34, 211, 238, 0.1)
              `,
            }}
          />

          {/* ─── Layer 2.1: Inner Edge Shadow ────────────────────────────── */}
          <div className="absolute inset-0 z-20 shadow-[inset_0_0_150px_rgba(0,0,0,0.6)]" />

          {/* ─── Layer 3: Crosshairs & Mechanical Markers ────────────────── */}
          <div className="absolute inset-0 z-30 flex items-center justify-center opacity-20">
            <div className="w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] border border-cyan-500/30 rounded-full" />
            <div className="absolute w-[2px] h-[20px] bg-cyan-500/50 top-1/2 -mt-[10px] left-[15vw]" />
            <div className="absolute w-[2px] h-[20px] bg-cyan-500/50 top-1/2 -mt-[10px] right-[15vw]" />
            <div className="absolute w-[20px] h-[2px] bg-cyan-500/50 left-1/2 -ml-[10px] top-[15vh]" />
            <div className="absolute w-[20px] h-[2px] bg-cyan-500/50 left-1/2 -ml-[10px] bottom-[15vh]" />
          </div>

          {/* ─── Layer 4: Parallax UI Telemetry ──────────────────────────── */}
          <div ref={hudRef} className="absolute inset-0 z-40 flex justify-between items-center p-[9vw] transition-transform duration-75">

            {/* Left Panel */}
            <div className="h-full flex flex-col justify-center gap-12" style={{ perspective: "1000px" }}>
              <div
                className="space-y-8 font-mono origin-left"
                style={{ transform: "rotateY(12deg)" }}
              >
                <div className="border-l-2 border-cyan-500/50 pl-4">
                  <div className="text-[10px] text-cyan-500/70 tracking-[0.3em] mb-1">O2 LEVEL</div>
                  <div className="text-xl text-cyan-300 font-bold tracking-wider" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                    98.4% <span className="text-xs text-cyan-600/80 ml-2">[NOMINAL]</span>
                  </div>
                </div>

                <div className="border-l-2 border-cyan-500/50 pl-4">
                  <div className="text-[10px] text-cyan-500/70 tracking-[0.3em] mb-1">SUIT INTEGRITY</div>
                  <div className="text-xl text-cyan-300 font-bold tracking-wider" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                    100%
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="h-full flex flex-col justify-center gap-12 text-right" style={{ perspective: "1000px" }}>
              <div
                className="space-y-8 font-mono origin-right"
                style={{ transform: "rotateY(-12deg)" }}
              >
                <div className="border-r-2 border-cyan-500/50 pr-4">
                  <div className="text-[10px] text-cyan-500/70 tracking-[0.3em] mb-1">GRAV-SENSORS</div>
                  <div className="text-xl text-orange-400 font-bold tracking-wider" style={{ textShadow: "0 0 15px rgba(251,146,60,0.4)" }}>
                    ANOMALY
                  </div>
                </div>

                <div className="border-r-2 border-cyan-500/50 pr-4">
                  <div className="text-[10px] text-cyan-500/70 tracking-[0.3em] mb-1">RADAR</div>
                  <div className="text-xl text-cyan-300 font-bold tracking-wider" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                    ACTIVE
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Diegetic Remove Helmet Button ───────────────────────────── */}
          <div className="absolute bottom-[6vh] left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <button
              onClick={() => setIsHelmetOn(false)}
              className="group flex flex-col items-center gap-2 focus:outline-none"
            >
              <div className="px-6 py-2 border border-cyan-900 bg-[#020205]/80 backdrop-blur-md flex items-center justify-center text-cyan-500 transition-all duration-300 hover:border-cyan-400 hover:bg-cyan-900/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] relative overflow-hidden">
                <div className="absolute top-0 left-[-100%] w-full h-[2px] bg-cyan-400/50 group-hover:left-[100%] transition-all duration-1000 ease-in-out" />
                <span className="font-mono text-xs tracking-[0.3em] text-cyan-600 group-hover:text-cyan-300 transition-colors">
                  DISENGAGE [H]
                </span>
              </div>
            </button>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}