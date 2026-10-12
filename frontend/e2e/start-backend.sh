#!/usr/bin/env bash
# Backend isolé pour les tests e2e : base et fichiers jetables, superutilisateur créé depuis E2E_PASSWORD.
set -euo pipefail
cd "$(dirname "$0")/../../backend"
PYTHON="${PYTHON:-$( [ -x .venv/bin/python ] && echo .venv/bin/python || echo python )}"
WORK="${E2E_WORKDIR:-$(mktemp -d)}"
export DJANGO_DEBUG=1 DJANGO_MEDIA_ROOT="$WORK/media"
export DATABASE_URL="${E2E_DATABASE_URL:-sqlite:///$WORK/e2e.sqlite3}"
"$PYTHON" manage.py migrate --noinput >/dev/null
DJANGO_SUPERUSER_PASSWORD="$E2E_PASSWORD" "$PYTHON" manage.py createsuperuser --noinput --username e2e.root --email e2e.root@example.test >/dev/null 2>&1 || true
exec "$PYTHON" manage.py runserver "127.0.0.1:${API_PORT:-8100}" --noreload
