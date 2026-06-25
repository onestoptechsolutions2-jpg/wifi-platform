FROM node:20-alpine AS builder
WORKDIR /app

# OpenSSL needed by Prisma engine
RUN apk add --no-cache openssl

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npx prisma generate
RUN npx tsc --noEmitOnError false || true

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# OpenSSL needed by Prisma at runtime
RUN apk add --no-cache openssl

COPY package.json ./
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/prisma      ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/src/index.js"]
