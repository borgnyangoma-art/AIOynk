#!/bin/bash

# Database Restore Script
# Usage: ./restore-db.sh <backup-file> [--skip-backup]

set -e

BACKUP_FILE=$1
SKIP_BACKUP=$2

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file> [--skip-backup]"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/aio-backup-*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

CONTAINER_NAME="aio-postgres"
DB_NAME="${DB_NAME:-aio_creative_hub}"
DB_USER="${DB_USER:-aio}"
DB_PASSWORD="${DB_PASSWORD:-aio_password}"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create backup of current database before restore (unless skipped)
if [ "$SKIP_BACKUP" != "--skip-backup" ]; then
    echo "Creating backup of current database before restore..."
    ./scripts/backup-db.sh
    echo "✓ Current database backed up"
fi

# Drop and recreate database
echo "Preparing database for restore..."
docker exec $CONTAINER_NAME psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
docker exec $CONTAINER_NAME psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
echo "Restoring from backup: $BACKUP_FILE"
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
else
    cat $BACKUP_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
fi

echo "✓ Database restored successfully!"

# Verify restore
echo "Verifying restore..."
TABLES=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | xargs)
echo "✓ Database contains $TABLES tables"

echo "Restore completed successfully!"
