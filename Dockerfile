# syntax=docker/dockerfile:1
# Production image for HouseHunting. Works on Docker Desktop, Engine, and CI.
# Build from the repo root: docker compose up --build

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=43123

# Use the distroless-friendly `node` user shipped by the official image (uid 1000).
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --chown=node:node docker/healthcheck.js ./healthcheck.js

USER node
EXPOSE 43123

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "healthcheck.js"]

CMD ["node", "server.js"]
