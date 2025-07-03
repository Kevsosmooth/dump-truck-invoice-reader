# Build stage for client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Build stage for server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Install production dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production
RUN npx prisma generate

# Copy built files
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/prisma ./prisma
COPY --from=client-builder /app/client/dist ../client/dist

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]