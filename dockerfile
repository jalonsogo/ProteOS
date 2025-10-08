# WhaleOS - Containerized Distribution
# This container runs the WhaleOS server and manages Docker containers via Docker socket
FROM node:20-alpine

# Install Docker CLI (not Docker daemon - we'll use host's Docker via socket)
RUN apk add --no-cache docker-cli git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application files
COPY server/ ./server/
COPY public/ ./public/
COPY dockerfile* ./

# Create workspace directory
RUN mkdir -p /workspace/containers

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server/index.js"]
