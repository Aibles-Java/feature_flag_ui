# ── Stage 1: build the static site ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies (layer cached unless the lockfile changes)
COPY package.json package-lock.json ./
RUN npm ci

# Build (runs `tsc -b && vite build`)
COPY . .
RUN npm run build

# ── Stage 2: serve with nginx ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Patch the base image's OS packages to their latest fixed versions so the
# publish job's Trivy HIGH/CRITICAL gate passes (nginx:alpine lags upstream
# security fixes for openssl/libxml2/libpng/etc.). gettext provides `envsubst`,
# used to inject runtime config.
#
# The explicit openssl floor is load-bearing: CI builds with cache-from/to: gha,
# and BuildKit keys this RUN by its instruction text, so a plain `apk upgrade`
# layer stays cached from an earlier build and never re-pulls a since-published
# fix (libcrypto3/libssl3 3.3.7-r2: CVE-2026-75804, CVE-2026-84782). Naming the
# fixed package forces a cache miss and fails the build loudly on regression.
# Bump the floor when a newer base-package CVE needs the same treatment.
RUN apk upgrade --no-cache && apk add --no-cache gettext "libcrypto3>=3.3.7-r2" "libssl3>=3.3.7-r2"

# Nginx site config (SPA fallback, gzip, health check, caching)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Runtime env injection: template + entrypoint (auto-run by the nginx image
# before the server starts, via /docker-entrypoint.d/*.sh)
COPY docker/env.template.js /usr/share/nginx/env.template.js
COPY docker/entrypoint.sh /docker-entrypoint.d/40-env.sh
RUN chmod +x /docker-entrypoint.d/40-env.sh

# Default backend URL — override at deploy time with `-e VITE_API_URL=...`
ENV VITE_API_URL=http://localhost:8080/api/v1

EXPOSE 80
