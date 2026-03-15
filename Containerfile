# Base stage with Node.js
FROM node:20-alpine AS base
RUN apk add --no-cache git python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --frozen-lockfile

# Build backend
FROM deps AS backend-build
COPY packages/backend ./packages/backend
RUN pnpm --filter @licensescope/backend build

# Build frontend
FROM deps AS frontend-build
COPY packages/frontend ./packages/frontend
RUN pnpm --filter @licensescope/frontend build

# Runtime
FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=backend-build /app/packages/backend/dist ./packages/backend/dist
COPY --from=frontend-build /app/packages/frontend/dist ./packages/frontend/dist
COPY packages/backend/package.json ./packages/backend/
COPY package.json ./

RUN mkdir -p /app/data

ENV DATABASE_PATH=/app/data/licensescope.db
ENV PORT=3001
ENV STATIC_DIR=/app/packages/frontend/dist

EXPOSE 3001

WORKDIR /app/packages/backend
CMD ["node", "dist/main.js"]
