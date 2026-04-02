FROM oven/bun:1.2 AS base

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production stage
FROM oven/bun:1.2-slim

WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/bun.lock ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist

USER bun

EXPOSE ${APP_PORT:-3000}

CMD ["bun", "dist/index.js"]
