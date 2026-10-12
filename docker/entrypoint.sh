#!/bin/sh
# Rendered into the SPA at container start so the API URL can be set at deploy time
# without rebuilding the image. Dropped into /docker-entrypoint.d/, which the official
# nginx image executes before starting nginx.
set -eu

: "${VITE_API_URL:=http://localhost:8080/api/v1}"
# Kill-switch for the flag-centric navigation (S-1.11). ON by default; set FLAG_CENTRIC_NAV=false
# (or anything but "true") to fall back to the old behaviour.
: "${FLAG_CENTRIC_NAV:=true}"

# envsubst only sees exported variables; `:=` above sets plain shell variables.
export VITE_API_URL FLAG_CENTRIC_NAV

envsubst '${VITE_API_URL} ${FLAG_CENTRIC_NAV}' \
  < /usr/share/nginx/env.template.js \
  > /usr/share/nginx/html/env.js

echo "[entrypoint] env.js generated with VITE_API_URL=${VITE_API_URL} FLAG_CENTRIC_NAV=${FLAG_CENTRIC_NAV}"
