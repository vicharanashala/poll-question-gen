# -----------------------------
# Builder Stage
# -----------------------------
FROM node:22-alpine AS builder

# Install git & pnpm
RUN apk add --no-cache git dos2unix
RUN npm install -g pnpm@10.4.1 rimraf

WORKDIR /app

# Copy package files & scripts
COPY package.json pnpm-lock.yaml* ./
COPY .npmrc ./                          
COPY scripts ./scripts

# Ensure Unix line endings for scripts
RUN find scripts -type f -exec dos2unix {} +

# Install dependencies
RUN pnpm install

# Copy the rest of the code & compile
COPY . .
RUN pnpm tsc || echo "TypeScript compilation had errors but continuing build"

# -----------------------------
# Production Stage
# -----------------------------
FROM node:22-alpine

# Install system deps & dumb-init
RUN apk update && apk add --no-cache ca-certificates dumb-init dos2unix

WORKDIR /app

# Copy package files & scripts
COPY package.json ./ 
COPY .npmrc ./                          
COPY scripts ./scripts

# Ensure Unix line endings for scripts
RUN find scripts -type f -exec dos2unix {} + && chmod +x /app/scripts/start.sh

# Copy build and node_modules from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src

# Copy Tailscale binaries
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscaled /app/tailscaled
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscale /app/tailscale
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

# Expose port
ENV PORT=8080
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Start script
CMD ["sh", "/app/scripts/start.sh"]