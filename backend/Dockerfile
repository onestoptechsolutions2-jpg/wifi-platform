FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies (dev included — needed for tsc + prisma CLI)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source and generate Prisma client + compile
COPY . .
RUN npx prisma generate
RUN npx tsc --noEmitOnError false || true

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json ./

# Copy compiled JS, Prisma schema, and the full node_modules
# (node_modules includes the generated Prisma client — no need to regenerate)
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/prisma      ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/index.js"]
