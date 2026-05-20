import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Event Horizon — Immersive WebGL Experience",
  description:
    "A cinematic journey through spacetime. Traverse a nebula, witness gravitational lensing, and approach a supermassive black hole in this real-time WebGL experience built with React Three Fiber.",
  keywords: [
    "WebGL",
    "Three.js",
    "React Three Fiber",
    "black hole",
    "gravitational lensing",
    "creative coding",
    "GLSL",
    "shaders",
  ],
  authors: [{ name: "Caio Amorim" }],
  openGraph: {
    title: "Event Horizon — Immersive WebGL Experience",
    description:
      "A cinematic journey into a supermassive black hole. Real-time WebGL with custom GLSL shaders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#030308] text-[#e8e6e3] no-select">
        {children}
      </body>
    </html>
  );
}
