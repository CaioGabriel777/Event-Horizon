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
import { CinematicSplash } from "@/components/ui/CinematicSplash";

// Dynamic import with SSR disabled — Canvas requires browser APIs
const Experience = dynamic(
  () =>
    import("@/components/canvas/Experience").then((mod) => ({
      default: mod.Experience,
    })),
  { ssr: false }
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
      {/* Cinematic splash — shows immediately while Canvas loads */}
      <CinematicSplash minimumDisplayMs={2800} />

      {/* 3D Experience (fullscreen Canvas) */}
      <Experience />

      {/* DOM Overlay Layer */}
      <Navigation />
      <SceneOverlay />
      <HUD />
    </main>
  );
}
