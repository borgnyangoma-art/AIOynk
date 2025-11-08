# Video Service Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install FFmpeg dependencies
RUN apk add --no-cache \
    ffmpeg \
    build-base \
    python3 \
    g++ \
    make

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS production

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S video -u 1001

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/storage ./storage

RUN mkdir -p /app/logs /app/temp && \
    chown -R video:nodejs /app

USER video

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
