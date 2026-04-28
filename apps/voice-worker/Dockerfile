# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      ca-certificates \
      curl \
      build-essential \
 && pip3 install --no-cache-dir --break-system-packages 'yt-dlp==2025.10.22' \
 && rm -rf /var/lib/apt/lists/*

FROM deps AS builder
WORKDIR /repo
RUN npm install -g pnpm@10.33.0
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/voice-worker ./apps/voice-worker
RUN pnpm install --frozen-lockfile=false \
 && pnpm --filter "@zero-to-citric/shared-types" build \
 && pnpm --filter "@zero-to-citric/voice-worker" build

FROM deps AS runtime
WORKDIR /app
RUN useradd --create-home --shell /usr/sbin/nologin app
COPY --from=builder /repo/apps/voice-worker/package.json ./package.json
COPY --from=builder /repo/apps/voice-worker/dist ./dist
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/worker/health || exit 1
USER app
CMD ["node", "dist/index.js"]
