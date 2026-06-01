#!/bin/sh
# =============================================================================
# docker-backup.sh — Backup automatico do banco de dados SPO
# Executado diariamente as 17h50 pelo servico spo-backup (Docker cron)
# =============================================================================

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/spo_backup_${TIMESTAMP}.db"
DB_FILE="/data/spo.db"
KEEP_LAST=30

# Verificar se o banco existe
if [ ! -f "$DB_FILE" ]; then
  echo "[$(date)] AVISO: banco de dados nao encontrado em $DB_FILE"
  exit 1
fi

# Copiar o banco com timestamp
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup criado: spo_backup_${TIMESTAMP}.db"
else
  echo "[$(date)] ERRO: falha ao criar backup"
  exit 1
fi

# Manter apenas os ultimos 30 backups
COUNT=$(ls -t /backups/spo_backup_*.db 2>/dev/null | wc -l)
if [ "$COUNT" -gt "$KEEP_LAST" ]; then
  ls -t /backups/spo_backup_*.db | tail -n +$((KEEP_LAST + 1)) | xargs rm -f
  echo "[$(date)] Backups antigos removidos. Total mantido: $KEEP_LAST"
fi
