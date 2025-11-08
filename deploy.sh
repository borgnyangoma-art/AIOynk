#!/bin/bash

# Deployment Script for AIO Creative Hub
# Usage: ./deploy.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME="aio-creative-hub"
VERSION=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment to $ENVIRONMENT${NC}"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo -e "${YELLOW}Loading environment from .env.$ENVIRONMENT${NC}"
    export $(cat ".env.$ENVIRONMENT" | xargs)
else
    echo -e "${YELLOW}Warning: .env.$ENVIRONMENT not found${NC}"
fi

# Build and push images based on environment
case $ENVIRONMENT in
    dev)
        echo -e "${GREEN}Building development images...${NC}"
        docker-compose -f docker-compose.dev.yml build --no-cache
        echo -e "${GREEN}Starting development services...${NC}"
        docker-compose -f docker-compose.dev.yml up -d
        ;;
    staging)
        echo -e "${GREEN}Building staging images...${NC}"
        docker-compose -f docker-compose.yml build --no-cache
        echo -e "${GREEN}Starting staging services...${NC}"
        docker-compose -f docker-compose.yml up -d
        ;;
    prod)
        echo -e "${GREEN}Building production images...${NC}"
        docker-compose -f docker-compose.yml build --no-cache
        echo -e "${GREEN}Running production deployment...${NC}"
        docker-compose -f docker-compose.yml up -d --remove-orphans
        echo -e "${GREEN}Pruning old images...${NC}"
        docker image prune -af
        ;;
    *)
        echo -e "${RED}Invalid environment. Use: dev, staging, or prod${NC}"
        exit 1
        ;;
esac

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 30

# Health checks
echo -e "${YELLOW}Performing health checks...${NC}"

services=("postgres:5432" "redis:6379" "backend:3000" "frontend:80")
for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if docker-compose -f docker-compose${ENVIRONMENT:+.$ENVIRONMENT}.yml exec -T $name sh -c "curl -f http://localhost:$port/health" 2>/dev/null; then
        echo -e "${GREEN}✓ $name is healthy${NC}"
    else
        echo -e "${RED}✗ $name is not responding${NC}"
    fi
done

# Run database migrations for non-dev environments
if [ "$ENVIRONMENT" != "dev" ]; then
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker-compose -f docker-compose${ENVIRONMENT:+.$ENVIRONMENT}.yml exec -T backend npm run migrate
fi

# Show running services
echo -e "${GREEN}Deployment complete! Running services:${NC}"
docker-compose -f docker-compose${ENVIRONMENT:+.$ENVIRONMENT}.yml ps

echo -e "${GREEN}Done! ${NC}"
