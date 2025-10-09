# ProteOS Server Dockerfile
FROM node:20-alpine

# Install Docker CLI to manage containers from within
RUN apk add --no-cache docker-cli

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY dockerfile.* ./

# Install dependencies
RUN npm install

# Copy application files
COPY server ./server
COPY public ./public
COPY .env* ./

# Create workspace directory
RUN mkdir -p /workspace

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "server/index.js"]
