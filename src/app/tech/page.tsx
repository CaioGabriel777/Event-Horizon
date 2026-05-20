/**
 * Tech Dashboard — Engineering Showcase
 * ======================================
 * Real-time rendering metrics designed to impress.
 * Displays: FPS, Draw Calls, Particles, DPR, GPU Tier,
 * rendering strategy, and architecture decisions.
 *
 * This page is Server-rendered with a Client component
 * for the live metrics panel.
 */

import Link from "next/link";
import { TechMetrics } from "./TechMetrics";

export const metadata = {
  title: "Tech — Event Horizon",
  description:
    "Real-time rendering performance dashboard. See FPS, draw calls, GPU tier, and the engineering behind Event Horizon.",
};

export default function TechPage() {
  return (
    <main className="min-h-screen bg-[#030308] text-[#e8e6e3] px-8 py-16 max-w-4xl mx-auto">
      {/* Navigation back */}
      <Link
        href="/"
        className="text-xs tracking-[0.3em] uppercase text-slate-500 hover:text-slate-300 transition-colors mb-12 block"
        id="tech-back-link"
      >
        ← Back to Experience
      </Link>

      <h1 className="text-4xl font-light tracking-[0.1em] mb-2">
        ENGINEERING
      </h1>
      <p className="text-sm text-slate-500 tracking-wide mb-12">
        Real-time performance metrics & architecture
      </p>

      {/* Live Metrics Panel */}
      <TechMetrics />

      {/* Architecture Section */}
      <section className="mt-16" id="tech-architecture">
        <h2 className="text-lg tracking-[0.15em] text-slate-300 mb-6 uppercase">
          Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rendering */}
          <div className="border border-slate-800 rounded-lg p-6">
            <h3 className="text-xs tracking-[0.3em] uppercase text-slate-400 mb-3">
              Rendering Pipeline
            </h3>
            <ul className="text-xs text-slate-500 space-y-2">
              <li>• React Three Fiber v9 + Three.js r184</li>
              <li>• Custom GLSL vertex & fragment shaders</li>
              <li>• Post-processing: Lensing → ChromAb → Bloom</li>
              <li>• Zero textures — 100% procedural generation</li>
            </ul>
          </div>

          {/* Performance */}
          <div className="border border-slate-800 rounded-lg p-6">
            <h3 className="text-xs tracking-[0.3em] uppercase text-slate-400 mb-3">
              Performance Strategy
            </h3>
            <ul className="text-xs text-slate-500 space-y-2">
              <li>• InstancedMesh for all particles</li>
              <li>• Dynamic DPR (Device Pixel Ratio)</li>
              <li>• Adaptive quality tiers (High/Medium/Low)</li>
              <li>• Merged EffectPass (single render pass)</li>
            </ul>
          </div>

          {/* State */}
          <div className="border border-slate-800 rounded-lg p-6">
            <h3 className="text-xs tracking-[0.3em] uppercase text-slate-400 mb-3">
              State Machine
            </h3>
            <ul className="text-xs text-slate-500 space-y-2">
              <li>• Zustand with subscribeWithSelector</li>
              <li>• 5-phase scroll-driven state machine</li>
              <li>• Imperative updates via useFrame (no re-renders)</li>
              <li>• Derived state: phase, gravity, progress</li>
            </ul>
          </div>

          {/* Shaders */}
          <div className="border border-slate-800 rounded-lg p-6">
            <h3 className="text-xs tracking-[0.3em] uppercase text-slate-400 mb-3">
              Custom Shaders
            </h3>
            <ul className="text-xs text-slate-500 space-y-2">
              <li>• Gravitational Lensing (Einstein ring)</li>
              <li>• Black Hole (raymarched FBM accretion)</li>
              <li>• Gravity Text (4-phase vertex distortion)</li>
              <li>• Simplex noise, Doppler beaming, SDF melting</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 pt-8 mt-16">
        <p className="text-xs text-slate-600 tracking-wide">
          Built with Next.js, React Three Fiber, GLSL, Zustand & Framer Motion
        </p>
      </footer>
    </main>
  );
}
