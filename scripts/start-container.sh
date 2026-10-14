#!/bin/sh
set -eu
node scripts/check-env.js
if ! npx --no-install prisma migrate deploy; then
  echo 'Database migration failed. Read the Prisma error above.' >&2
  echo 'P1000 / missing role: existing DB credentials differ from .env.' >&2
  echo 'To keep old data: restore original credentials.' >&2
  echo 'To start a separate empty DB: docker compose down; node scripts/setup-env.js --fresh-db; docker compose up -d --build' >&2
  exit 1
fi
node prisma/seed.js
exec node src/app.js
