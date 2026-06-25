FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source and generate Prisma client
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/prisma       ./prisma
COPY package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
