/**
 * Landing Page — The Cinematic Experience
 * ========================================
 * Client Component that dynamically imports the Experience
 * with SSR disabled to avoid window/WebGL errors.
 *
 * In Next.js 16, `ssr: false` with `next/dynamic` requires
 * a Client Component, so we use `'use client'` here.
 */

"use client";

import dynamic from "next/dynamic";

// Dynamic import with SSR disabled — Canvas requires browser APIs
const Experience = dynamic(
  () =>
    import("@/components/canvas/Experience").then((mod) => ({
      default: mod.Experience,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#030308] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border border-slate-700 border-t-slate-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs tracking-[0.4em] uppercase text-slate-600">
            Initializing spacetime
          </p>
        </div>
      </div>
    ),
  }
);

const Navigation = dynamic(
  () =>
    import("@/components/ui/Navigation").then((mod) => ({
      default: mod.Navigation,
    })),
  { ssr: false }
);

const SceneOverlay = dynamic(
  () =>
    import("@/components/ui/SceneOverlay").then((mod) => ({
      default: mod.SceneOverlay,
    })),
  { ssr: false }
);

const HUD = dynamic(
  () =>
    import("@/components/ui/HUD").then((mod) => ({
      default: mod.HUD,
    })),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden" id="landing-page">
      {/* 3D Experience (fullscreen Canvas) */}
      <Experience />

      {/* DOM Overlay Layer */}
      <Navigation />
      <SceneOverlay />
      <HUD />
    </main>
  );
}
