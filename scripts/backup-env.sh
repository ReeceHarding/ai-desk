#!/bin/bash

# Create backups directory if it doesn't exist
mkdir -p .env-backups

# Get current timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Backup .env.local if it exists
if [ -f .env.local ]; then
    echo "Backing up .env.local..."
    cp .env.local ".env-backups/.env.local.backup_${TIMESTAMP}"
    echo "✅ Backup created at .env-backups/.env.local.backup_${TIMESTAMP}"
else
    echo "⚠️ No .env.local file found to backup"
fi

# Keep only the last 5 backups
echo "Cleaning up old backups..."
ls -t .env-backups/.env.local.backup_* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null 