# ---- Base ----
FROM oven/bun:1.2 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Dev (hot reload, source mounted via volume) ----
FROM base AS dev
COPY . .
EXPOSE 3000
CMD ["bun", "run", "--hot", "src/index.ts"]

# ---- Build ----
FROM base AS build
COPY . .
RUN bun build src/index.ts --outdir dist

# ---- Production ----
FROM oven/bun:1.2-slim AS production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER bun
EXPOSE 3000
CMD ["bun", "dist/index.js"]
