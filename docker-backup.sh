#!/bin/sh
# =============================================================================
# docker-backup.sh — Backup automatico do banco de dados SPO
# Executado diariamente as 17h50 pelo servico spo-backup (Docker cron)
# =============================================================================
#
# QA-075: o banco roda em modo WAL (lib/prisma.ts). Um `cp` cru do .db NAO
# inclui as transacoes que ainda estao no arquivo -wal (vendas recentes ainda
# nao consolidadas no .db) — o backup saia defasado e PERDIA vendas em silencio.
# Reproduzido: 80 vendas no sistema, backup por `cp` restaurava apenas 50.
#
# Solucao: Online Backup API do SQLite (`.backup`), que produz um snapshot
# transacionalmente consistente INCLUINDO o WAL e e seguro mesmo com a
# aplicacao escrevendo. Requer acesso de escrita ao diretorio do banco (para
# ler um banco WAL o SQLite precisa do arquivo -shm) — por isso o volume e
# montado rw no docker-compose; a Backup API NAO altera os dados de origem.
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

# QA-075: snapshot consistente via Online Backup API (inclui o WAL).
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"
  RESULT=$?
else
  # Fallback DEGRADADO (sqlite3 ausente): cp cru — pode perder o WAL.
  # Nao deveria ocorrer: o servico spo-backup instala o sqlite (docker-compose).
  echo "[$(date)] AVISO: sqlite3 indisponivel — fallback para cp (pode perder o WAL)"
  cp "$DB_FILE" "$BACKUP_FILE"
  RESULT=$?
fi

if [ "$RESULT" -eq 0 ]; then
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
