# syntax=docker/dockerfile:1
#
# Quote System production image.
#
#   docker build -t quote-system .
#   docker buildx build --platform linux/amd64,linux/arm64 -t quote-system .
#
# Multi-arch without QEMU: every stage that executes code runs on the build
# machine's own platform ($BUILDPLATFORM). The standalone output is plain
# JavaScript (sharp/libvips are excluded in next.config.ts), so only the final
# stage is per-architecture, and it has no RUN instructions.

# ---- dependencies ----------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- build -----------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# - A native addon would be built for $BUILDPLATFORM and crash on the other
#   architecture, so refuse to ship one.
# - drizzle/, assets/ and branding-defaults/ are traced into the standalone
#   output too; drop those copies so the explicit COPYs below are the only
#   ones (otherwise the 14 MB of fonts would be stored twice).
# - The license texts of the npm packages the app ships are collected from
#   the full install and the build output (scripts/third-party-licenses.mjs).
# - Empty directories become the only paths the runtime user may write to.
RUN npm run build \
 && if find .next/standalone -name '*.node' | grep -q .; then \
      echo "ERROR: native addon in the standalone output; the image would not be portable across architectures:" >&2; \
      find .next/standalone -name '*.node' >&2; \
      exit 1; \
    fi \
 && rm -rf .next/standalone/drizzle .next/standalone/assets .next/standalone/branding-defaults \
 && node scripts/third-party-licenses.mjs --out THIRD_PARTY_LICENSES.txt \
 && mkdir -p /writable/cache /writable/branding

# ---- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runner

ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="Quote System" \
      org.opencontainers.image.description="Self-hosted quotation management for small businesses (Next.js + PostgreSQL)" \
      org.opencontainers.image.source="https://github.com/sychen6192/quote-system" \
      org.opencontainers.image.url="https://github.com/sychen6192/quote-system" \
      org.opencontainers.image.documentation="https://github.com/sychen6192/quote-system#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# App files stay root-owned, so the app cannot modify its own code. Only the
# Next cache and the legacy branding/ mount point belong to `node` (uid 1000,
# built into the base image).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/branding-defaults ./branding-defaults
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/LICENSE /app/THIRD_PARTY_NOTICES.md /app/THIRD_PARTY_LICENSES.txt ./
COPY --from=builder --chown=node:node /writable/cache ./.next/cache
COPY --from=builder --chown=node:node /writable/branding ./branding

USER node
EXPOSE 3000

# busybox wget ships with node:*-alpine. 127.0.0.1 rather than localhost: the
# server listens on IPv4 0.0.0.0. ${PORT} keeps it working when PORT is changed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=2s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

# Pending database migrations are applied on start (instrumentation.ts).
CMD ["node", "server.js"]
