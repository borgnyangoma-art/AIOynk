# Frontend Dockerfile - Multi-stage build
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S frontend -u 1001

# Set ownership
RUN chown -R frontend:nodejs /usr/share/nginx/html && \
    chown -R frontend:nodejs /var/cache/nginx && \
    chown -R frontend:nodejs /var/log/nginx && \
    chown -R frontend:nodejs /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R frontend:nodejs /var/run/nginx.pid

# Switch to non-root user
USER frontend

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
