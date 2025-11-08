# AIO Creative Hub - Deployment Procedures

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Local Development Deployment](#local-development-deployment)
5. [Staging Deployment](#staging-deployment)
6. [Production Deployment](#production-deployment)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Rollback Procedures](#rollback-procedures)
10. [Post-Deployment Verification](#post-deployment-verification)
11. [Troubleshooting](#troubleshooting)

## Overview

This document provides step-by-step instructions for deploying the AIO Creative Hub platform across different environments. The deployment process is automated through CI/CD pipelines but can also be executed manually when needed.

### Deployment Environments
- **Local Development**: Docker Compose for local testing
- **Staging**: Cloud environment for pre-production testing
- **Production**: Live environment for end users
- **Kubernetes**: Container orchestration (optional)

### Architecture
```
┌──────────────┐
│  Source Code │
│   (Git)      │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│   CI Pipeline    │
│  (GitHub Actions)│
└──────┬───────────┘
       │
       ├───────────┬────────────┐
       ▼           ▼            ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│ Staging │  │Production│  │  Docker  │
│Deploy   │  │ Deploy   │  │ Registry │
└─────────┘  └──────────┘  └──────────┘
```

## Prerequisites

### System Requirements
- **Docker**: 20.10+ and Docker Compose 2.0+
- **Node.js**: 18+ (for local development)
- **Python**: 3.11+ (for NLP service)
- **Git**: Latest version
- **Make**: For build automation (optional)

### Required Accounts
- **GitHub**: For code repository and CI/CD
- **Cloud Provider**: AWS, GCP, or Azure (for staging/production)
- **Container Registry**: Docker Hub or GitHub Container Registry
- **Domain Registrar**: For custom domain setup
- **SSL Certificate**: Let's Encrypt or commercial CA

### Access Requirements
- **SSH Access**: To deployment servers
- **Database Access**: For production databases
- **Cloud Credentials**: For infrastructure provisioning
- **Secrets**: JWT keys, API keys, database passwords

## Environment Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/aio-creative-hub.git
cd aio-creative-hub

# Verify all submodules
git submodule update --init --recursive
```

### 2. Environment Configuration

#### Development (.env)
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

```env
# Environment
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=aio
DB_PASSWORD=aio_password
DB_NAME=aio_creative_hub
DATABASE_URL=postgresql://aio:aio_password@localhost:5432/aio_creative_hub

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=aio_redis_password
REDIS_URL=redis://:aio_redis_password@localhost:6379/0

# JWT Keys (generate using openssl)
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Logging
LOG_LEVEL=debug
```

#### Staging (.env.staging)
```env
# Environment
NODE_ENV=staging
PORT=3000

# Database (Production-ready)
DB_HOST=your-staging-db-host
DB_PORT=5432
DB_USER=aio_staging
DB_PASSWORD=secure_staging_password
DB_NAME=aio_creative_hub_staging
DATABASE_URL=postgresql://aio_staging:secure_staging_password@your-staging-db-host:5432/aio_creative_hub_staging

# Redis
REDIS_HOST=your-staging-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password
REDIS_URL=redis://:secure_redis_password@your-staging-redis-host:6379/0

# JWT Keys (use different keys from production)
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----

# Google OAuth
GOOGLE_CLIENT_ID=your_staging_google_client_id
GOOGLE_CLIENT_SECRET=your_staging_google_client_secret
GOOGLE_REDIRECT_URI=https://staging-api.aio-creative-hub.com/api/auth/google/callback

# Logging
LOG_LEVEL=info
```

#### Production (.env.production)
```env
# Environment
NODE_ENV=production
PORT=3000

# Database (HA setup)
DB_HOST=your-prod-db-primary
DB_PORT=5432
DB_USER=aio_prod
DB_PASSWORD=very_secure_production_password
DB_NAME=aio_creative_hub
DATABASE_URL=postgresql://aio_prod:very_secure_production_password@your-prod-db-primary:5432/aio_creative_hub

# Redis (Cluster mode)
REDIS_HOST=your-prod-redis-cluster
REDIS_PORT=6379
REDIS_PASSWORD=very_secure_redis_password
REDIS_URL=redis://:very_secure_redis_password@your-prod-redis-cluster:6379/0

# JWT Keys (secure key management)
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----

# Google OAuth
GOOGLE_CLIENT_ID=your_prod_google_client_id
GOOGLE_CLIENT_SECRET=your_prod_google_client_secret
GOOGLE_REDIRECT_URI=https://api.aio-creative-hub.com/api/auth/google/callback

# Logging
LOG_LEVEL=warn

# Monitoring
JAEGER_AGENT_HOST=jaeger.aio-creative-hub.com
PROMETHEUS_URL=http://prometheus.aio-creative-hub.com:9090
```

### 3. Generate Security Keys

```bash
# Generate JWT RSA key pair
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Convert to single line for .env
echo "JWT_PRIVATE_KEY=$(cat jwt-private.pem | tr '\n' '\\n')" >> .env
echo "JWT_PUBLIC_KEY=$(cat jwt-public.pem | tr '\n' '\\n')" >> .env

# Clean up
rm jwt-private.pem jwt-public.pem
```

## Local Development Deployment

### 1. Start Infrastructure Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be ready
docker-compose ps

# Verify database connection
docker exec -it aio-postgres psql -U aio -d aio_creative_hub -c "SELECT version();"
```

### 2. Run Database Migrations

```bash
# Backend migrations
cd apps/backend
npm run migrate

# Verify tables created
docker exec -it aio-postgres psql -U aio -d aio_creative_hub -c "\dt"
```

### 3. Start All Services

```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up

# Or start individually
docker-compose up -d nlp-service backend graphics-service web-designer-service ide-service cad-service video-service frontend

# View logs
docker-compose logs -f backend
```

### 4. Verify Deployment

```bash
# Check service health
curl http://localhost:3000/health

# Check frontend
curl http://localhost/

# Check creative tools
curl http://localhost:3001/health  # Graphics
curl http://localhost:3002/health  # Web Designer
curl http://localhost:3003/health  # IDE
curl http://localhost:3004/health  # CAD
curl http://localhost:3005/health  # Video
curl http://localhost:3006/health  # NLP
```

### 5. Access URLs

- **Frontend**: http://localhost/
- **Backend API**: http://localhost:3000
- **Graphics Service**: http://localhost:3001
- **Web Designer**: http://localhost:3002
- **IDE Service**: http://localhost:3003
- **CAD Service**: http://localhost:3004
- **Video Service**: http://localhost:3005
- **NLP Service**: http://localhost:3006

## Staging Deployment

### 1. Prepare Staging Environment

```bash
# On staging server
git clone https://github.com/your-org/aio-creative-hub.git
cd aio-creative-hub

# Checkout staging branch
git checkout develop

# Copy staging environment
cp .env.staging .env
```

### 2. Provision Infrastructure

```bash
# Using Terraform or CloudFormation
terraform init
terraform plan -var-file="staging.tfvars"
terraform apply -var-file="staging.tfvars"
```

### 3. Set Up Database

```bash
# Create database and user
psql -h $DB_HOST -U postgres -c "CREATE USER aio_staging WITH PASSWORD 'secure_staging_password';"
psql -h $DB_HOST -U postgres -c "CREATE DATABASE aio_creative_hub_staging OWNER aio_staging;"

# Run migrations
cd apps/backend
npm run migrate
```

### 4. Deploy with Docker Compose

```bash
# Pull latest images
docker-compose pull

# Deploy services
docker-compose -f docker-compose.yml up -d

# Monitor deployment
docker-compose logs -f
```

### 5. Configure Nginx

```bash
# Copy Nginx configuration
cp nginx/nginx.staging.conf /etc/nginx/sites-available/aio-staging
ln -s /etc/nginx/sites-available/aio-staging /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### 6. Set Up SSL

```bash
# Using Certbot
certbot --nginx -d staging-api.aio-creative-hub.com

# Verify certificate
certbot certificates
```

### 7. Run Integration Tests

```bash
# Wait for services to be ready
sleep 60

# Run health checks
curl -f https://staging-api.aio-creative-hub.com/health

# Run E2E tests
npm run test:e2e
```

### 8. Monitor Deployment

```bash
# Check service status
docker-compose ps

# Check resource usage
docker stats

# Check logs
docker-compose logs --tail=100

# Check monitoring dashboards
# Grafana: http://staging-grafana.aio-creative-hub.com:3001
# Jaeger: http://staging-jaeger.aio-creative-hub.com:16686
```

## Production Deployment

### 1. Pre-Deployment Checklist

```bash
# Verify all prerequisites
☐ Environment variables configured
☐ SSL certificates obtained
☐ Database backups taken
☐ Monitoring systems configured
☐ Alert notifications tested
☐ DNS records configured
☐ CDN configured (if applicable)
☐ Load balancer configured
☐ Firewall rules updated
☐ Security scan completed
```

### 2. Database Backup

```bash
# Create production backup
./scripts/backup-db.sh /backups/production-$(date +%Y%m%d-%H%M%S).sql.gz

# Verify backup
zcat /backups/production-*.sql.gz | head -20

# Upload to S3 (optional)
aws s3 cp /backups/production-*.sql.gz s3://your-backup-bucket/
```

### 3. Deploy Services

```bash
# On production server
git clone https://github.com/your-org/aio-creative-hub.git
cd aio-creative-hub

# Checkout main branch
git checkout main

# Pull latest code
git pull origin main

# Copy production environment
cp .env.production .env

# Pull latest images
docker-compose pull

# Deploy with zero-downtime
docker-compose -f docker-compose.yml up -d --remove-orphans

# Wait for services to be healthy
sleep 30
```

### 4. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# Health check
curl -f https://api.aio-creative-hub.com/health

# Check all tool endpoints
curl -f https://api.aio-creative-hub.com/api/tools
curl -f https://api.aio-creative-hub.com/api/tools/graphics/canvas -X POST
```

### 5. Run Smoke Tests

```bash
# User registration
curl -X POST https://api.aio-creative-hub.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","firstName":"Test","lastName":"User"}'

# User login
curl -X POST https://api.aio-creative-hub.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Chat test
curl -X POST https://api.aio-creative-hub.com/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"message":"Hello"}'
```

### 6. Update Load Balancer

```bash
# Add new instances to load balancer pool
# (AWS ELB, GCP Load Balancer, or Nginx upstream)

# Example Nginx upstream update
upstream backend_cluster {
    server backend1.aio-creative-hub.com:3000;
    server backend2.aio-creative-hub.com:3000;
    server backend3.aio-creative-hub.com:3000;
}
```

### 7. Monitor Deployment

```bash
# Watch logs
docker-compose logs -f --tail=50

# Check metrics
curl http://prometheus.aio-creative-hub.com:9090/api/v1/query?query=up

# Check Grafana
# http://grafana.aio-creative-hub.com:3001

# Check Jaeger
# http://jaeger.aio-creative-hub.com:16686
```

## Kubernetes Deployment

### 1. Install Kubernetes Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install kustomize
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/
```

### 2. Deploy with Helm

```bash
# Add Helm repository
helm repo add aio-creative-hub https://charts.aio-creative-hub.com
helm repo update

# Install with custom values
helm install aio-creative-hub aio-creative-hub/aio-creative-hub \
  --namespace aio-creative-hub \
  --create-namespace \
  -f values-production.yaml

# Check deployment status
helm status aio-creative-hub -n aio-creative-hub

# List pods
kubectl get pods -n aio-creative-hub
```

### 3. Deploy with Kustomize

```bash
# Build and apply
kustomize build overlays/production | kubectl apply -f -

# Verify deployment
kubectl get all -n aio-creative-hub

# Check logs
kubectl logs -n aio-creative-hub deployment/backend
```

## CI/CD Pipeline

### 1. GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build images
        run: |
          docker build -t ${{ secrets.REGISTRY }}/aio-creative-hub/backend:${{ github.sha }} ./apps/backend
          docker push ${{ secrets.REGISTRY }}/aio-creative-hub/backend:${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - name: Deploy to staging
        run: |
          ssh ${{ secrets.STAGING_USER }}@${{ secrets.STAGING_HOST }} \
            "cd /opt/aio-creative-hub && git pull && docker-compose pull && docker-compose up -d"

  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          ssh ${{ secrets.PRODUCTION_USER }}@${{ secrets.PRODUCTION_HOST }} \
            "cd /opt/aio-creative-hub && git pull && docker-compose pull && docker-compose up -d"
```

### 2. Manual Deployment via CI

```bash
# Trigger deployment
git push origin main

# Monitor pipeline
# View at: https://github.com/your-org/aio-creative-hub/actions

# Rollback if needed
git revert <commit-hash>
git push origin main
```

## Rollback Procedures

### 1. Docker Compose Rollback

```bash
# Stop current services
docker-compose down

# Rollback to previous version
git checkout <previous-commit>

# Pull previous images
docker-compose pull

# Restart services
docker-compose up -d

# Verify rollback
curl -f https://api.aio-creative-hub.com/health
```

### 2. Blue-Green Deployment Rollback

```bash
# Switch traffic back to green environment
nginx -s reload

# Decommission blue environment
docker-compose -f docker-compose.blue.yml down
```

### 3. Database Rollback

```bash
# Stop application
docker-compose down

# Restore database
gunzip -c /backups/production-20240101-120000.sql.gz | psql -h $DB_HOST -U aio_prod aio_creative_hub

# Start application
docker-compose up -d

# Verify data
psql -h $DB_HOST -U aio_prod aio_creative_hub -c "SELECT COUNT(*) FROM users;"
```

### 4. Automated Rollback Script

```bash
#!/bin/bash
# rollback.sh

PREVIOUS_VERSION=$1
ENVIRONMENT=$2

if [ -z "$PREVIOUS_VERSION" ] || [ -z "$ENVIRONMENT" ]; then
  echo "Usage: ./rollback.sh <previous-version> <environment>"
  exit 1
fi

echo "Rolling back to $PREVIOUS_VERSION in $ENVIRONMENT environment"

# Checkout previous version
git checkout $PREVIOUS_VERSION

# Deploy
if [ "$ENVIRONMENT" == "production" ]; then
  ./deploy.sh production
elif [ "$ENVIRONMENT" == "staging" ]; then
  ./deploy.sh staging
fi

# Verify
./health-check.sh $ENVIRONMENT

echo "Rollback completed"
```

## Post-Deployment Verification

### 1. Service Health Checks

```bash
#!/bin/bash
# health-check.sh

ENVIRONMENT=$1
API_URL="https://api.aio-creative-hub.com"

if [ "$ENVIRONMENT" == "staging" ]; then
  API_URL="https://staging-api.aio-creative-hub.com"
fi

echo "Running health checks for $ENVIRONMENT..."

# Check main API
curl -f $API_URL/health || exit 1

# Check creative tools
for port in 3001 3002 3003 3004 3005 3006; do
  curl -f $API_URL/api/tools/graphics/canvas -X POST 2>/dev/null || echo "Tool on port $port may be unavailable"
done

echo "Health checks completed"
```

### 2. Functional Testing

```bash
# User registration flow
./tests/registration.sh

# User login flow
./tests/login.sh

# Chat functionality
./tests/chat.sh

# Creative tool tests
./tests/graphics.sh
./tests/web-designer.sh
./tests/ide.sh
./tests/cad.sh
./tests/video.sh
```

### 3. Performance Testing

```bash
# Run load tests
k6 run tests/load/api-load-test.js

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s $API_URL/api/chat

# Monitor resource usage
docker stats --no-stream
```

### 4. Monitoring Checks

```bash
# Check Prometheus alerts
curl http://prometheus.aio-creative-hub.com:9090/api/v1/alerts

# Check Grafana dashboards
# http://grafana.aio-creative-hub.com:3001

# Check error rates
curl http://prometheus.aio-creative-hub.com:9090/api/v1/query?query=rate\(http_requests_total\{status=~"5.."\}\[5m\]\)

# Check Jaeger traces
# http://jaeger.aio-creative-hub.com:16686
```

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check logs
docker-compose logs service_name

# Check configuration
cat .env

# Check port conflicts
netstat -tulpn | grep :3000

# Restart service
docker-compose restart service_name
```

#### 2. Database Connection Failed

```bash
# Check database status
docker-compose ps postgres

# Test connection
docker exec -it aio-postgres psql -U aio -d aio_creative_hub

# Check credentials
grep DB_PASSWORD .env

# Restart database
docker-compose restart postgres
```

#### 3. High Memory Usage

```bash
# Check container stats
docker stats

# Check for memory leaks
docker exec aio-backend ps aux --sort=-%mem

# Restart affected service
docker-compose restart service_name
```

#### 4. SSL Certificate Issues

```bash
# Check certificate
openssl s_client -connect api.aio-creative-hub.com:443

# Renew certificate
certbot renew

# Check Nginx configuration
nginx -t
```

#### 5. Slow Performance

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s $API_URL/health

# Check database queries
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "SELECT * FROM pg_stat_activity;"

# Check Redis cache
docker exec -it aio-redis redis-cli info stats

# Monitor resources
htop
```

### Log Locations

```bash
# Application logs
docker-compose logs backend
docker-compose logs graphics-service
docker-compose logs nlp-service

# Nginx logs
/var/log/nginx/access.log
/var/log/nginx/error.log

# Database logs
docker exec aio-postgres cat /var/log/postgresql/postgresql-15.log

# System logs
journalctl -u docker
```

### Emergency Contacts

- **On-Call Engineer**: +1-555-0100
- **DevOps Team**: devops@aio-creative-hub.com
- **Database Administrator**: dba@aio-creative-hub.com
- **Infrastructure Team**: infrastructure@aio-creative-hub.com

### Monitoring Dashboards

- **Grafana**: https://grafana.aio-creative-hub.com:3001
- **Prometheus**: http://prometheus.aio-creative-hub.com:9090
- **Jaeger**: http://jaeger.aio-creative-hub.com:16686
- **Kibana**: http://kibana.aio-creative-hub.com:5601
- **Alertmanager**: http://alertmanager.aio-creative-hub.com:9093

## Maintenance

### Regular Tasks

#### Daily
- [ ] Check system health
- [ ] Review error logs
- [ ] Monitor resource usage
- [ ] Check security alerts

#### Weekly
- [ ] Review performance metrics
- [ ] Update security patches
- [ ] Clean up old logs
- [ ] Test backup restore

#### Monthly
- [ ] Review and tune alerts
- [ ] Update dependencies
- [ ] Review security scan results
- [ ] Capacity planning review

### Backup Strategy

```bash
# Database backups (daily)
0 2 * * * /opt/aio-creative-hub/scripts/backup-db.sh

# Artifact backups (weekly)
0 3 * * 0 /opt/aio-creative-hub/scripts/backup-artifacts.sh

# Configuration backups (monthly)
0 4 1 * * /opt/aio-creative-hub/scripts/backup-config.sh
```

## Conclusion

This deployment guide provides comprehensive instructions for deploying the AIO Creative Hub platform across multiple environments. Follow the procedures carefully and maintain proper documentation of any environment-specific customizations. For questions or issues, contact the DevOps team.
