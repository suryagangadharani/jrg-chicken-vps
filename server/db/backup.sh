#!/bin/bash
# Automated PostgreSQL Backup Script for JRG Chicken VPS Migration
# Set cron job: 0 3 * * * /app/server/db/backup.sh (Runs daily at 3:00 AM)

BACKUP_DIR="${BACKUP_DIR:-/var/backups/jrg_chicken}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/jrg_chicken_db_${TIMESTAMP}.sql.gz"
DB_NAME="${POSTGRES_DB:-jrg_chicken}"
DB_USER="${POSTGRES_USER:-postgres}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL database backup for ${DB_NAME}..."

# Export compressed pg_dump
pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"
  # Retain last 30 days of backups, delete older
  find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +30 -delete
else
  echo "[$(date)] ERROR: Database backup failed!" >&2
  exit 1
fi
