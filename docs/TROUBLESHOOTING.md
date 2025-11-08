# AIO Creative Hub - Troubleshooting Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Common Issues](#common-issues)
3. [Service-Specific Issues](#service-specific-issues)
4. [Database Issues](#database-issues)
5. [Authentication Issues](#authentication-issues)
6. [Performance Issues](#performance-issues)
7. [Creative Tool Issues](#creative-tool-issues)
8. [Monitoring & Debugging](#monitoring--debugging)
9. [Emergency Procedures](#emergency-procedures)

## Getting Started

### Quick Diagnostics

```bash
# Check all service status
docker-compose ps

# Check system health
curl -f http://localhost:3000/health

# Check logs
docker-compose logs --tail=100

# Check resource usage
docker stats
```

### Log Locations

| Service | Log Command | Log File |
|---------|-------------|----------|
| Backend | `docker-compose logs backend` | - |
| Graphics Service | `docker-compose logs graphics-service` | - |
| NLP Service | `docker-compose logs nlp-service` | - |
| Database | `docker exec aio-postgres cat /var/log/postgresql/postgresql-15.log` | /var/log/postgresql/ |
| Redis | `docker-compose logs redis` | - |
| Nginx | `tail -f /var/log/nginx/error.log` | /var/log/nginx/ |
| Frontend | `docker-compose logs frontend` | - |

## Common Issues

### Issue 1: Services Won't Start

**Symptoms:**
- Docker containers exit immediately
- `docker-compose ps` shows services as "Exited"
- Service health checks fail

**Diagnosis:**
```bash
# Check container status
docker-compose ps

# Check logs for errors
docker-compose logs service_name

# Check port conflicts
netstat -tulpn | grep :3000
```

**Solutions:**

1. **Port Conflict**
```bash
# Find process using port
lsof -i :3000

# Kill process or change port in docker-compose.yml
# Edit ports:
# - "3001:3000"  # Use external port 3001
```

2. **Environment Variables Missing**
```bash
# Check if .env file exists
ls -la .env

# Copy from template
cp .env.example .env

# Edit with correct values
nano .env
```

3. **Database Connection Failed**
```bash
# Start database first
docker-compose up -d postgres redis

# Wait for database to be ready
sleep 10

# Test connection
docker exec -it aio-postgres pg_isready -U aio
```

4. **Image Not Found**
```bash
# Rebuild images
docker-compose build --no-cache

# Pull latest images
docker-compose pull
```

### Issue 2: High CPU/Memory Usage

**Symptoms:**
- Services respond slowly
- System becomes unresponsive
- `docker stats` shows high usage

**Diagnosis:**
```bash
# Check resource usage
docker stats

# Check top processes
docker exec aio-backend top

# Check memory usage
docker exec aio-backend free -h
```

**Solutions:**

1. **Memory Leak**
```bash
# Restart affected service
docker-compose restart service_name

# Check for memory leaks in logs
docker-compose logs service_name | grep -i "memory\|leak"

# Update service configuration
# Add memory limits in docker-compose.yml:
# mem_limit: 512m
```

2. **Infinite Loop**
```bash
# Check logs for repeated errors
docker-compose logs service_name | tail -50

# Look for stack traces
docker-compose logs service_name | grep -A 5 "Error:\|Exception"

# Restart service
docker-compose restart service_name
```

3. **Database Queries**
```bash
# Check slow queries
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  SELECT query, mean_time, calls
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"
```

### Issue 3: Authentication Failures

**Symptoms:**
- Users cannot log in
- 401 Unauthorized errors
- JWT token errors

**Diagnosis:**
```bash
# Check authentication logs
docker-compose logs backend | grep -i "auth\|login\|jwt"

# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Check JWT configuration
grep -i "jwt" .env
```

**Solutions:**

1. **Invalid JWT Keys**
```bash
# Generate new JWT keys
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Update .env file
echo "JWT_PRIVATE_KEY=$(cat jwt-private.pem | tr '\n' '\\n')" >> .env
echo "JWT_PUBLIC_KEY=$(cat jwt-public.pem | tr '\n' '\\n')" >> .env

# Restart backend
docker-compose restart backend
```

2. **Password Hash Issues**
```bash
# Check user exists
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  SELECT id, email, created_at FROM users WHERE email='test@example.com';
"

# Reset password
docker exec aio-backend node -e "
  const bcrypt = require('bcrypt');
  console.log(bcrypt.hashSync('newpassword', 12));
"
```

3. **OAuth Configuration**
```bash
# Check Google OAuth settings
# Verify redirect URI matches in Google Console
# Check client ID and secret
grep -i "google" .env
```

### Issue 4: Database Connection Errors

**Symptoms:**
- "Connection refused" errors
- "Database does not exist" errors
- Slow query performance

**Diagnosis:**
```bash
# Check database status
docker-compose ps postgres

# Test database connection
docker exec -it aio-postgres pg_isready -U aio

# Check database logs
docker exec aio-postgres cat /var/log/postgresql/postgresql-15.log

# List databases
docker exec -it aio-postgres psql -U aio -c "\l"
```

**Solutions:**

1. **Database Not Running**
```bash
# Start database
docker-compose up -d postgres

# Wait for it to be ready
sleep 10

# Verify
docker exec -it aio-postgres pg_isready -U aio
```

2. **Database Doesn't Exist**
```bash
# Create database
docker exec -it aio-postgres psql -U postgres -c "
  CREATE DATABASE aio_creative_hub;
"

# Run migrations
cd apps/backend
npm run migrate
```

3. **Too Many Connections**
```bash
# Check active connections
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  SELECT count(*) FROM pg_stat_activity;
"

# Restart backend to release connections
docker-compose restart backend
```

### Issue 5: Slow API Response Times

**Symptoms:**
- API calls take >5 seconds
- Timeouts on requests
- Users report slowness

**Diagnosis:**
```bash
# Check response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/tools

# Check for slow endpoints
docker-compose logs backend | grep -i "slow\|timeout"

# Check database queries
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  SELECT query, mean_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 5;
"
```

**Solutions:**

1. **Database Performance**
```bash
# Add indexes
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  CREATE INDEX CONCURRENTLY idx_messages_session_id
  ON messages(session_id);
"

# Update table statistics
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  ANALYZE;
"
```

2. **Redis Cache**
```bash
# Check Redis stats
docker exec -it aio-redis redis-cli info stats

# Clear cache
docker exec -it aio-redis redis-cli FLUSHALL

# Restart Redis
docker-compose restart redis
```

3. **Service Overload**
```bash
# Scale services
docker-compose up -d --scale backend=3

# Check resource usage
docker stats
```

## Service-Specific Issues

### Backend API Issues

#### Error: "Module not found"
```bash
# Rebuild backend
cd apps/backend
npm install
docker-compose build backend

# Clear node_modules
rm -rf node_modules package-lock.json
npm install
```

#### Error: "Cannot read property of undefined"
```bash
# Check for null/undefined in logs
docker-compose logs backend | grep -A 5 "undefined\|null"

# Restart backend
docker-compose restart backend
```

#### WebSocket Connection Failed
```bash
# Check WebSocket logs
docker-compose logs backend | grep -i "websocket\|ws"

# Check Nginx WebSocket configuration
# Ensure upgrade headers are set
```

### Graphics Service Issues

#### Error: "Canvas is not defined"
```bash
# Check graphics service logs
docker-compose logs graphics-service | grep -i "canvas\|error"

# Restart service
docker-compose restart graphics-service
```

#### Export Fails
```bash
# Check disk space
docker exec aio-graphics-service df -h

# Check file permissions
docker exec aio-graphics-service ls -la /app/storage
```

#### High Memory Usage
```bash
# Monitor memory
docker stats aio-graphics-service

# Restart service
docker-compose restart graphics-service
```

### NLP Service Issues

#### Error: "spaCy model not found"
```bash
# Download spaCy model
docker exec aio-nlp-service python -m spacy download en_core_web_sm

# Rebuild NLP service
docker-compose build nlp-service
```

#### Low Confidence Scores
```bash
# Check NLP service logs
docker-compose logs nlp-service | grep -i "confidence"

# Verify training data
docker exec aio-nlp-service ls -la /app/data
```

#### Timeout Errors
```bash
# Increase timeout
# Edit nlp-service/Dockerfile:
# ENV NLP_TIMEOUT=30

# Restart service
docker-compose restart nlp-service
```

### IDE Service Issues

#### Error: "Docker socket not found"
```bash
# Check Docker socket
ls -la /var/run/docker.sock

# Fix permissions
sudo chmod 666 /var/run/docker.sock

# Restart IDE service
docker-compose restart ide-service
```

#### Code Execution Failed
```bash
# Check sandbox logs
docker-compose logs ide-service | grep -A 10 "execution"

# Increase resource limits
# Edit docker-compose.yml:
# ide-service:
#   mem_limit: 1g
#   cpu_limit: "1.0"
```

#### Security Violations
```bash
# Check security logs
docker-compose logs ide-service | grep -i "security\|violation"

# Review security rules
cat services/ide-service/src/security.ts
```

### CAD Service Issues

#### Error: "Three.js not loaded"
```bash
# Check dependencies
docker exec aio-cad-service cat package.json

# Rebuild service
docker-compose build cad-service
```

#### 3D Model Export Failed
```bash
# Check disk space
docker exec aio-cad-service df -h

# Check file permissions
docker exec aio-cad-service ls -la /app/storage/models
```

### Video Service Issues

#### Error: "FFmpeg not found"
```bash
# Check FFmpeg installation
docker exec aio-video-service ffmpeg -version

# Rebuild video service
docker-compose build video-service
```

#### Render Jobs Stuck
```bash
# Check render queue
docker exec aio-video-service ls -la /app/render-queue

# Clear stuck jobs
docker exec aio-video-service rm -rf /app/render-queue/*

# Restart service
docker-compose restart video-service
```

## Database Issues

### PostgreSQL Issues

#### Connection Refused
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker logs aio-postgres

# Restart PostgreSQL
docker-compose restart postgres
```

#### Disk Space Full
```bash
# Check disk usage
docker exec aio-postgres df -h

# Clean old WAL files
docker exec aio-postgres pg_archivecleanup /var/lib/postgresql/data/pg_wal 000000010000000000000010

# Vacuum database
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "VACUUM FULL;"
```

#### Corrupted Data
```bash
# Check database integrity
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  SELECT schemaname, tablename, attname, n_distinct, correlation
  FROM pg_stats;
"

# Restore from backup
gunzip -c /backups/latest.sql.gz | docker exec -i aio-postgres psql -U aio -d aio_creative_hub
```

### Redis Issues

#### Connection Failed
```bash
# Check Redis status
docker-compose ps redis

# Test connection
docker exec -it aio-redis redis-cli ping

# Restart Redis
docker-compose restart redis
```

#### Out of Memory
```bash
# Check Redis memory usage
docker exec -it aio-redis redis-cli info memory

# Clear all data
docker exec -it aio-redis redis-cli FLUSHALL

# Restart Redis
docker-compose restart redis
```

## Authentication Issues

### JWT Token Issues

#### Token Expiration
```bash
# Check token expiration time
# Tokens expire after 24 hours

# User needs to re-login
# Frontend should handle token refresh
```

#### Invalid Signature
```bash
# JWT keys may be incorrect
# Regenerate keys
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Update .env
# Restart backend
```

### Google OAuth Issues

#### Redirect URI Mismatch
```bash
# Verify redirect URI in Google Cloud Console
# Should match: https://api.aio-creative-hub.com/api/auth/google/callback

# Check environment variables
grep -i "google" .env
```

#### Access Denied
```bash
# Check OAuth client configuration
# Verify client ID and secret
# Check authorized domains
```

## Performance Issues

### High Response Times

**Diagnosis:**
```bash
# Measure response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health

# Check for slow endpoints
docker-compose logs backend | grep -E "duration|time"
```

**Solutions:**

1. **Enable Caching**
```bash
# Check Redis is running
docker-compose ps redis

# Verify cache configuration
grep -i "redis\|cache" apps/backend/src/config/database.ts
```

2. **Database Optimization**
```bash
# Check slow queries
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  SELECT query, mean_time, calls
  FROM pg_stat_statements
  WHERE mean_time > 1000
  ORDER BY mean_time DESC;
"

# Add indexes
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
"
```

3. **Scale Services**
```bash
# Scale backend
docker-compose up -d --scale backend=3

# Check load balancing
curl http://localhost:3000/health
```

### Memory Leaks

**Diagnosis:**
```bash
# Monitor memory usage
watch docker stats

# Check for memory errors
docker-compose logs service_name | grep -i "memory\|heap"
```

**Solutions:**

1. **Restart Service**
```bash
docker-compose restart service_name
```

2. **Limit Memory**
```bash
# Add to docker-compose.yml:
# mem_limit: 512m
```

3. **Fix Code**
```bash
# Look for memory leaks in logs
# Common causes:
# - Event listeners not removed
# - Timers not cleared
# - Large objects not garbage collected
```

## Creative Tool Issues

### Graphics Tool Not Loading

**Symptoms:**
- Canvas not displayed
- 404 errors for tool assets
- Tool interface frozen

**Solutions:**
```bash
# Check graphics service
curl http://localhost:3001/health

# Check logs
docker-compose logs graphics-service

# Restart service
docker-compose restart graphics-service

# Check browser console
# Open browser dev tools (F12)
# Look for JavaScript errors
```

### Web Designer Code Generation Fails

**Symptoms:**
- Empty code output
- Timeout errors
- Validation errors

**Solutions:**
```bash
# Check web designer service
curl http://localhost:3002/health

# Check logs
docker-compose logs web-designer-service

# Verify GrapesJS is loaded
curl http://localhost:3002/ | grep -i grapesjs
```

### IDE Code Execution Timeout

**Symptoms:**
- Code runs indefinitely
- Timeout errors
- No output

**Solutions:**
```bash
# Check IDE service
curl http://localhost:3003/health

# Check Docker daemon
docker ps

# Increase timeout
# Edit docker-compose.yml
# environment:
#   - EXECUTION_TIMEOUT=30
```

### CAD 3D Model Won't Render

**Symptoms:**
- Blank 3D viewport
- JavaScript errors
- Model not visible

**Solutions:**
```bash
# Check CAD service
curl http://localhost:3004/health

# Check Three.js loading
curl http://localhost:3004/ | grep -i three

# Clear browser cache
# Ctrl+Shift+R (hard refresh)
```

### Video Processing Fails

**Symptoms:**
- Render stuck at 0%
- FFmpeg errors
- Video not loading

**Solutions:**
```bash
# Check video service
curl http://localhost:3005/health

# Check FFmpeg
docker exec aio-video-service ffmpeg -version

# Check disk space
docker exec aio-video-service df -h

# Clear render queue
docker exec aio-video-service rm -rf /app/render-queue/*
```

## Monitoring & Debugging

### Using Grafana

**Access:** http://localhost:3001

**Common Dashboards:**
- System Overview
- Service Health
- Database Performance
- API Metrics

**Useful Queries:**
```promql
# CPU Usage
rate(container_cpu_usage_seconds_total[5m])

# Memory Usage
container_memory_usage_bytes

# Request Rate
rate(http_requests_total[5m])

# Error Rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Using Jaeger

**Access:** http://localhost:16686

**Search Traces:**
1. Select service
2. Enter operation name
3. Set time range
4. Click "Find Traces"

**Common Searches:**
- HTTP requests
- Database queries
- Tool operations
- Error traces

### Using Kibana

**Access:** http://localhost:5601

**Search Logs:**
1. Go to "Discover"
2. Select index pattern
3. Use KQL to search
4. Add filters

**Useful Searches:**
```kql
# Error logs
level: ERROR

# Security events
message: "Security Event"

# User activity
userId: "12345"

# Specific timeframe
@timestamp: [now-1h TO now]
```

### Debug Mode

**Enable Debug Logging:**
```bash
# Edit .env
LOG_LEVEL=debug

# Restart services
docker-compose restart backend
```

**Check Debug Logs:**
```bash
docker-compose logs backend | grep -i debug
```

### Performance Profiling

**Backend Profiling:**
```bash
# Use Node.js profiler
docker exec aio-backend node --prof server.js

# Analyze profile
docker exec aio-backend node --prof-process isolate-*.log > profile.txt
```

**Database Profiling:**
```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Emergency Procedures

### Service Outage

**Immediate Actions:**
```bash
# 1. Check all services
docker-compose ps

# 2. Check logs
docker-compose logs --tail=50

# 3. Restart all services
docker-compose restart

# 4. Verify health
curl -f http://localhost:3000/health
```

### Database Failure

**Immediate Actions:**
```bash
# 1. Check database
docker-compose ps postgres

# 2. Restart database
docker-compose restart postgres

# 3. Wait for recovery
sleep 30

# 4. Test connection
docker exec -it aio-postgres pg_isready -U aio

# 5. If failed, restore from backup
gunzip -c /backups/latest.sql.gz | docker exec -i aio-postgres psql -U aio -d aio_creative_hub
```

### High Traffic Surge

**Immediate Actions:**
```bash
# 1. Scale services
docker-compose up -d --scale backend=5

# 2. Check load balancer
nginx -t
systemctl reload nginx

# 3. Monitor resources
watch docker stats
```

### Security Incident

**Immediate Actions:**
```bash
# 1. Block suspicious IPs
ufw deny from <suspicious-ip>

# 2. Disable user accounts
docker exec aio-postgres psql -U aio -d aio_creative_hub -c "
  UPDATE users SET active=false WHERE id=<user-id>;
"

# 3. Review logs
docker-compose logs backend | grep -i "security\|attack"

# 4. Change credentials
# - Update JWT keys
# - Update database passwords
# - Update API keys
```

### Data Breach

**Immediate Actions:**
```bash
# 1. Isolate affected systems
docker-compose down

# 2. Preserve evidence
# - Take database snapshot
# - Save logs
# - Document timeline

# 3. Notify stakeholders
# - Management
# - Legal team
# - Affected users

# 4. Conduct forensic analysis
# - Review access logs
# - Check for data exfiltration
# - Identify breach vector

# 5. Implement fixes
# - Patch vulnerabilities
# - Update security policies
# - Improve monitoring
```

## Getting Help

### Internal Resources
- **Documentation**: `/docs` directory
- **API Docs**: http://localhost:3000/docs
- **Architecture**: `/docs/ARCHITECTURE.md`

### External Resources
- **Docker Docs**: https://docs.docker.com/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Redis Docs**: https://redis.io/documentation
- **Nginx Docs**: https://nginx.org/en/docs/

### Support Contacts
- **DevOps Team**: devops@aio-creative-hub.com
- **On-Call**: +1-555-0100
- **Database Admin**: dba@aio-creative-hub.com

### Reporting Issues

**Template:**
```
Issue: [Brief description]
Service: [Affected service]
Severity: [Critical/High/Medium/Low]
Steps to Reproduce:
1. ...
2. ...
3. ...

Expected Behavior:
...

Actual Behavior:
...

Logs:
...

Environment:
- Local/Staging/Production
- Docker version
- OS version
```

## Prevention Best Practices

1. **Regular Monitoring**
   - Check dashboards daily
   - Review alerts promptly
   - Monitor resource usage

2. **Keep Updated**
   - Apply security patches
   - Update dependencies
   - Review configurations

3. **Backup Strategy**
   - Daily database backups
   - Weekly full backups
   - Test restore procedures

4. **Documentation**
   - Document all changes
   - Keep runbooks updated
   - Share knowledge

5. **Testing**
   - Run tests before deploy
   - Test in staging first
   - Use blue-green deployment

6. **Security**
   - Regular security audits
   - Update credentials
   - Monitor for threats

## Conclusion

This troubleshooting guide covers the most common issues you may encounter. Keep this guide handy and refer to it when diagnosing problems. For issues not covered here, contact the DevOps team or refer to the documentation.
