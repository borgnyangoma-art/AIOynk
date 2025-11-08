#!/bin/bash

# Database Backup Script
# Usage: ./backup-db.sh [output-dir]

set -e

BACKUP_DIR=${1:-./backups}
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aio-backup-$DATE.sql.gz"
CONTAINER_NAME="aio-postgres"
DB_NAME="${DB_NAME:-aio_creative_hub}"
DB_USER="${DB_USER:-aio}"
DB_PASSWORD="${DB_PASSWORD:-aio_password}"

# Create backup directory
mkdir -p $BACKUP_DIR

echo "Creating database backup..."
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Output: $BACKUP_FILE"

# Create backup using pg_dump
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo "✓ Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Keep only last 7 daily backups
find $BACKUP_DIR -name "aio-backup-*.sql.gz" -type f -mtime +7 -delete
echo "✓ Old backups cleaned up (kept last 7 days)"

# Optional: Upload to cloud storage
# Uncomment and configure for your cloud provider
# if [ "$UPLOAD_TO_CLOUD" = "true" ]; then
#     echo "Uploading to cloud storage..."
#     aws s3 cp $BACKUP_FILE s3://your-backup-bucket/database/
#     echo "✓ Backup uploaded to cloud"
# fi

echo "Backup process completed!"
