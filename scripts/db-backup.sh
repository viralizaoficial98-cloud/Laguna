#!/usr/bin/env bash
# Cópia de segurança da base de dados MySQL/MariaDB (antes de migrações e importações).
# Lê DATABASE_URL do ambiente ou do ficheiro .env. A palavra-passe é passada ao mysqldump por um
# ficheiro temporário com permissões 600 (não aparece na lista de processos).
#
#   bash scripts/db-backup.sh            → backups/laguna-AAAAmmdd-HHMMSS.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
fi
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL não definida"; exit 1; }
eval "$(node -e '
const u = new URL(process.argv[1]);
const q = (s) => "\x27" + decodeURIComponent(s).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
console.log(`DB_HOST=${q(u.hostname)} DB_PORT=${q(u.port || "3306")} DB_USER=${q(u.username)} DB_PASS=${q(u.password)} DB_NAME=${q(u.pathname.slice(1))}`);
' "$DATABASE_URL")"
mkdir -p backups
CNF=$(mktemp)
chmod 600 "$CNF"
trap 'rm -f "$CNF"' EXIT
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$CNF"
OUT="backups/laguna-$(date +%Y%m%d-%H%M%S).sql.gz"
mysqldump --defaults-extra-file="$CNF" --single-transaction --routines --triggers --no-tablespaces "$DB_NAME" | gzip > "$OUT"
chmod 600 "$OUT"
echo "Cópia de segurança criada: $OUT ($(du -h "$OUT" | cut -f1))"
