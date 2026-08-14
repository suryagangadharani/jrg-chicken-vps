# Stage 1: Build Frontend and Server
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build Vite / TanStack frontend
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

# Copy build artifacts and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

# Create directory for persistent uploads
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
