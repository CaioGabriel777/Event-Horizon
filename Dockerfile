# ==============================================================================
# STAGE 1: Build the WebAssembly (WASM) LUT from Rust
# ==============================================================================
FROM rust:1.80-slim AS wasm-builder

# Install build dependencies: curl, build-essential, pkg-config, and ssl dev libraries
RUN apt-get update && apt-get install -y \
    curl \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install wasm-pack using the precompiled binary installer
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

WORKDIR /app

# Copy only the Rust source and configuration to leverage Docker layer caching
COPY rust/geodesic-lut/Cargo.toml rust/geodesic-lut/Cargo.lock ./rust/geodesic-lut/
COPY rust/geodesic-lut/src ./rust/geodesic-lut/src

# Compile the Rust code to WASM
WORKDIR /app/rust/geodesic-lut
RUN wasm-pack build --target web --release --out-dir ../../public/wasm

# ==============================================================================
# STAGE 2: Base Node Environment (Shared Dependencies)
# ==============================================================================
FROM node:20-alpine AS base

WORKDIR /app

# Copy package configuration files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# ==============================================================================
# STAGE 3: Development Environment (With Hot Reload / Fast Refresh)
# ==============================================================================
FROM base AS development

# Copy the precompiled WebAssembly assets from the wasm-builder stage
COPY --from=wasm-builder /app/public/wasm ./public/wasm

# Copy the rest of the application files
COPY . .

ENV NODE_ENV=development
EXPOSE 3000

# Start Next.js in development mode
CMD ["npm", "run", "dev"]

# ==============================================================================
# STAGE 4: Next.js Production Builder
# ==============================================================================
FROM base AS builder

# Copy the precompiled WebAssembly assets from the wasm-builder stage
COPY --from=wasm-builder /app/public/wasm ./public/wasm

# Copy the rest of the application files
COPY . .

# Build the Next.js production bundle directly (bypassing prebuild script)
RUN npx next build

# ==============================================================================
# STAGE 5: Production Runner (Minimal image, high security)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root system user and group for enhanced runtime security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only necessary files for production execution
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Ensure permissions are correct (only run during production builds)
RUN chown -R nextjs:nodejs /app

# Switch to the non-root user
USER nextjs

# Expose the default port
EXPOSE 3000

# Start the Next.js production server
CMD ["npm", "start"]
