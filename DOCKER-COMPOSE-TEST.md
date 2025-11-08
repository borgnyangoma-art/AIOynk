# Docker Compose Usage Guide

## Quick Start

### Development Environment

```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up

# Run in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Production Environment

```bash
# Build and start production services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart
```

## Services

### Database & Caching
- **PostgreSQL** (port 5432)
  - Database: aio_creative_hub
  - User: aio
  - Password: aio_password
- **Redis** (port 6379)
  - Auth enabled

### Backend Services
- **Backend API** (port 3000)
  - Main application server
  - Health check: http://localhost:3000/health

### Creative Tool Services
- **Graphics Service** (port 3001)
  - Canvas-based graphics editor
  - Health check: http://localhost:3001/health

- **Web Designer** (port 3002)
  - HTML/CSS generator
  - Health check: http://localhost:3002/health

- **IDE Service** (port 3003)
  - Code execution engine
  - Health check: http://localhost:3003/health

- **CAD Service** (port 3004)
  - 3D modeling
  - Health check: http://localhost:3004/health

- **Video Service** (port 3005)
  - Video editor
  - Health check: http://localhost:3005/health

### Frontend
- **Nginx** (port 80)
  - Static file serving
  - Reverse proxy to backend

### Monitoring
- **Prometheus** (port 9090)
  - Metrics collection
  - Access: http://localhost:9090

- **Grafana** (port 3001)
  - Dashboards
  - Login: admin/admin

- **Elasticsearch** (port 9200)
  - Log storage

- **Kibana** (port 5601)
  - Log visualization
  - Access: http://localhost:5601

- **Logstash** (port 5044)
  - Log processing

## Common Commands

### Database Operations

```bash
# Create database backup
./scripts/backup-db.sh ./backups

# Restore from backup
./scripts/restore-db.sh ./backups/aio-backup-20240101-120000.sql.gz

# Access PostgreSQL
docker exec -it aio-postgres psql -U aio -d aio_creative_hub

# Access Redis
docker exec -it aio-redis redis-cli
```

### Docker Operations

```bash
# View running services
docker-compose ps

# View logs
docker-compose logs [service]

# Restart service
docker-compose restart [service]

# Scale service
docker-compose up -d --scale backend=3

# Update images
docker-compose pull
docker-compose up -d

# Clean up
docker-compose down -v
docker system prune -af
```

### Monitoring

```bash
# View Prometheus metrics
curl http://localhost:9090/metrics

# Access Grafana
open http://localhost:3001

# View Kibana
open http://localhost:5601
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DB_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password

# JWT Keys
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Troubleshooting

### Service not starting

```bash
# Check logs
docker-compose logs [service]

# Restart service
docker-compose restart [service]

# Rebuild service
docker-compose up -d --build [service]
```

### Database issues

```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres
# Wait for postgres to start
docker-compose exec backend npm run migrate
```

### Port conflicts

```bash
# Check port usage
lsof -i :3000

# Change ports in docker-compose.yml
ports:
  - "3001:3000"  # Use external port 3001 instead
```

### Memory issues

```bash
# Check memory usage
docker stats

# Limit memory for services
deploy:
  resources:
    limits:
      memory: 512M
```

## Performance Optimization

### Production Settings

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

### Health Checks

All services include health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 40s
```

## Security

### SSL Certificates

```bash
# Generate self-signed certificate (development)
./ssl/generate-cert.sh aio-creative-hub.com

# For production, use Let's Encrypt or trusted CA
```

### Firewall

Only expose necessary ports:

```bash
# Check open ports
netstat -tuln

# Close unnecessary ports
ufw deny 5432  # PostgreSQL (internal only)
```

## Backup and Recovery

### Automated Backup

```bash
# Add to crontab for daily backups
0 2 * * * /opt/aio-creative-hub/scripts/backup-db.sh

# Upload to cloud storage
./scripts/backup-db.sh && \
  aws s3 cp ./backups/ s3://your-backup-bucket/ --recursive
```

### Disaster Recovery

```bash
# 1. Backup current state
./scripts/backup-db.sh

# 2. Stop services
docker-compose down

# 3. Restore from backup
./scripts/restore-db.sh ./backups/aio-backup-20240101-120000.sql.gz

# 4. Restart services
docker-compose up -d
```

## Scaling

### Horizontal Scaling

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3

# Scale graphics service
docker-compose up -d --scale graphics-service=2
```

### Load Balancing

Nginx is configured for load balancing:

```nginx
upstream backend_cluster {
    server backend:3000;
    server backend:3000;
    server backend:3000;
}
```

## Logs

### Viewing Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Centralized Logging

Logs are automatically sent to:
- **Elasticsearch** for storage
- **Kibana** for visualization
- **Logstash** for processing

Access Kibana at http://localhost:5601

## Networking

### Internal Communication

Services communicate via internal Docker network:

```
backend -> postgres:5432
backend -> redis:6379
backend -> graphics-service:3001
```

### External Access

Only exposed ports:
- 80 (Frontend)
- 3000 (Backend API)
- 9090 (Prometheus)
- 3001 (Grafana)

## Custom Configuration

### Modify docker-compose.yml

```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
      - CUSTOM_VAR=value
    volumes:
      - ./custom-config:/app/config
    ports:
      - "3000:3000"
```

### Add New Service

```yaml
new-service:
  build:
    context: ./services/new-service
    dockerfile: Dockerfile
  ports:
    - "3007:3007"
  depends_on:
    - postgres
    - redis
  networks:
    - aio-network
```

## Maintenance

### Update Services

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build

# Clean up old images
docker image prune -af
```

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove all unused resources
docker system prune -af
```

## Best Practices

1. **Always use specific image tags** instead of `latest`
2. **Set resource limits** for all services
3. **Use health checks** to ensure service availability
4. **Regular backups** of database and important data
5. **Monitor logs** for errors and performance issues
6. **Keep images updated** with security patches
7. **Use secrets management** for sensitive data
8. **Implement proper logging** for troubleshooting
9. **Test deployments** in staging environment first
10. **Document configurations** for team collaboration
