#!/bin/bash

# Check if backups directory exists
if [ ! -d .env-backups ]; then
    echo "❌ No backups directory found"
    exit 1
fi

# List available backups
echo "Available backups:"
ls -t .env-backups/.env.local.backup_* 2>/dev/null | nl || { echo "No backups found"; exit 1; }

# Get the most recent backup
LATEST_BACKUP=$(ls -t .env-backups/.env.local.backup_* 2>/dev/null | head -n1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup files found"
    exit 1
fi

# Restore the latest backup
echo "Restoring from latest backup: $LATEST_BACKUP"
cp "$LATEST_BACKUP" .env.local
echo "✅ Environment restored from backup" 