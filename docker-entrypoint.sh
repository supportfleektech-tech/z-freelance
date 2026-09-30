#!/bin/sh
#
# Container startup:
#   1. Apply database migrations (idempotent — safe on every restart).
#   2. Hand off to the real server as PID 1 so signals propagate.
#
set -eu

echo "[entrypoint] running database migrations"
node scripts/migrate.mjs

echo "[entrypoint] starting z-freelance"
exec "$@"
