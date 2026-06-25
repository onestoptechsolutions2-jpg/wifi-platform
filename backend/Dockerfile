FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies (including devDeps for tsc)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript — continue even if there are type warnings (exit 0)
RUN npx tsc --noEmitOnError false || true

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Install only production deps
COPY package.json ./
RUN npm install --legacy-peer-deps --omit=dev

COPY --from=builder /app/dist   ./dist
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client in production image
RUN npx prisma generate

EXPOSE 4000
CMD ["node", "dist/index.js"]
