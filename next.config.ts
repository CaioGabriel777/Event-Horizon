import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile Three.js ecosystem packages for SSR compatibility
  transpilePackages: ["three"],

  // Turbopack configuration (Next.js 16 default bundler)
  turbopack: {
    rules: {
      // Handle .glsl, .vert, .frag files as raw strings
      "*.glsl": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
      "*.vert": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
      "*.frag": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },

  // Webpack fallback for production builds if needed
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      use: "raw-loader",
      exclude: /node_modules/,
    });

    return config;
  },
};

export default nextConfig;
