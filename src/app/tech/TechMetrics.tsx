/**
 * TechMetrics — Live Performance Dashboard (Client Component)
 * ============================================================
 * Reads from the Performance Zustand store and renders
 * real-time metrics with a terminal-inspired aesthetic.
 */

"use client";

import { useEffect, useState } from "react";
import { usePerformanceStore } from "@/store/usePerformanceStore";

export function TechMetrics() {
  const metrics = usePerformanceStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Metrics grid items
  const items = [
    { label: "FPS", value: mounted ? metrics.fps : "—", unit: "fps", status: metrics.fps > 50 ? "good" : metrics.fps > 30 ? "warn" : "critical" },
    { label: "Frame Time", value: mounted ? metrics.frameTime.toFixed(1) : "—", unit: "ms", status: "neutral" },
    { label: "Draw Calls", value: mounted ? metrics.drawCalls : "—", unit: "calls", status: "neutral" },
    { label: "Triangles", value: mounted ? metrics.triangles.toLocaleString() : "—", unit: "tris", status: "neutral" },
    { label: "Geometries", value: mounted ? metrics.geometries : "—", unit: "geo", status: "neutral" },
    { label: "Textures", value: mounted ? metrics.textures : "—", unit: "tex", status: "neutral" },
    { label: "DPR", value: mounted ? metrics.currentDPR.toFixed(1) : "—", unit: "×", status: "neutral" },
    { label: "GPU Tier", value: mounted ? metrics.gpuTier.toUpperCase() : "—", unit: "", status: metrics.gpuTier === "high" ? "good" : metrics.gpuTier === "medium" ? "warn" : "critical" },
  ];

  const statusColors: Record<string, string> = {
    good: "text-emerald-500",
    warn: "text-amber-500",
    critical: "text-red-500",
    neutral: "text-slate-300",
  };

  return (
    <section id="tech-live-metrics">
      <h2 className="text-lg tracking-[0.15em] text-slate-300 mb-6 uppercase">
        Live Metrics
      </h2>
      <p className="text-xs text-slate-600 mb-4">
        {mounted
          ? "Navigate to the Experience page to see live data"
          : "Loading metrics..."}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="border border-slate-800 rounded-lg p-4 bg-slate-900/30"
          >
            <p className="text-[10px] tracking-[0.3em] uppercase text-slate-600 mb-1">
              {item.label}
            </p>
            <p className={`text-2xl font-light ${statusColors[item.status]}`}>
              {item.value}
              <span className="text-xs text-slate-600 ml-1">{item.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
