# ==============================================================================
# STAGE 1: Base Node Environment (Shared Dependencies)
# ==============================================================================
FROM node:22-alpine AS base

WORKDIR /app

# Copy package configuration files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# ==============================================================================
# STAGE 2: Development Environment (With Hot Reload / Fast Refresh)
# ==============================================================================
FROM base AS development

# Copy the rest of the application files
COPY . .

ENV NODE_ENV=development
EXPOSE 3000

# Start Next.js in development mode explicitly with Webpack (Turbopack has polling issues in Docker/WSL)
CMD ["npx", "next", "dev", "--webpack"]

# ==============================================================================
# STAGE 3: Next.js Production Builder
# ==============================================================================
FROM base AS builder

# Copy the rest of the application files
COPY . .

# Build the Next.js production bundle
RUN npx next build

# ==============================================================================
# STAGE 4: Production Runner (Minimal image, high security)
# ==============================================================================
FROM node:22-alpine AS runner

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
