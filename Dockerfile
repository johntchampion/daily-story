# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create stories directory
RUN mkdir -p stories && chown -R node:node /app

# Use non-root user
USER node

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE $PORT

# Run node directly instead of through npm
CMD ["node", "dist/index.js"]