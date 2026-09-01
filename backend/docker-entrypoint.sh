#!/bin/sh
set -e
echo "[emptra] aplicando migrações do banco..."
npx prisma migrate deploy || npx prisma db push --accept-data-loss
echo "[emptra] migrações concluídas."
exec "$@"
