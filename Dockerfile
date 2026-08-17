# Stage 1: Build Frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build Vite static frontend
COPY . .
RUN npm run build

# Stage 2: Production Server
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies (needed for tsx server runtime)
COPY package*.json ./
RUN npm ci

# Copy built frontend assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

# Create directory for persistent uploads
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
