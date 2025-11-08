# IDE Service Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S ide -u 1001

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Install Docker CLI for code execution
RUN apk add --no-cache docker-cli

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/storage ./storage

RUN mkdir -p /app/logs /app/code && \
    chown -R ide:nodejs /app

USER ide

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
