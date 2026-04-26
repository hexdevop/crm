#!/bin/bash
# =============================================================
# deploy.sh — Full production deployment for crm.llve.ru
# Run as root or with sudo on the server
# =============================================================
set -e

DOMAIN="crm.llve.ru"
EMAIL="abduraxmonislomov@gmail.com"
COMPOSE="docker compose -f docker-compose.prod.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------- 1. Check .env.prod ----------
if [ ! -f .env.prod ]; then
    error ".env.prod not found. Copy .env.prod.example and fill in all values:\n  cp .env.prod.example .env.prod && nano .env.prod"
fi

# Verify no placeholder values remain
if grep -q "REPLACE_WITH" .env.prod; then
    error ".env.prod still contains placeholder values. Fill them all in before deploying."
fi

info "Environment file OK"

# ---------- 2. Check ports ----------
info "Checking ports 80 and 443..."
for port in 80 443; do
    if ss -tlnp | grep -q ":${port} "; then
        warn "Port ${port} is in use. Checking what process..."
        ss -tlnp | grep ":${port} " || true
        warn "If this is Apache/Nginx on the host — stop it: systemctl stop apache2 nginx && systemctl disable apache2 nginx"
        read -p "Continue anyway? (y/N) " confirm
        [[ "$confirm" =~ ^[Yy]$ ]] || error "Aborted."
    fi
done

# ---------- 3. Build images ----------
info "Building Docker images..."
$COMPOSE --env-file .env.prod build --parallel

# ---------- 4. Start services (HTTP-only nginx for cert challenge) ----------
info "Starting services with HTTP-only nginx for Let's Encrypt challenge..."

# Temporarily swap nginx config to HTTP-only
cp nginx/nginx.prod.conf nginx/nginx.prod.conf.bak
cp nginx/nginx.init.conf nginx/nginx.prod.conf

$COMPOSE --env-file .env.prod up -d postgres redis backend frontend nginx

info "Waiting for backend to be healthy..."
timeout=60
until $COMPOSE --env-file .env.prod exec -T nginx curl -sf http://localhost/api/health > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        warn "Backend health check timed out, continuing with SSL request anyway..."
        break
    fi
done

# ---------- 5. Obtain SSL certificate ----------
info "Requesting SSL certificate from Let's Encrypt for ${DOMAIN}..."

docker run --rm \
    -v crm_letsencrypt:/etc/letsencrypt \
    -v crm_certbot_www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}" \
    --non-interactive

info "SSL certificate obtained successfully!"

# ---------- 6. Switch nginx to HTTPS config ----------
info "Switching nginx to HTTPS configuration..."
cp nginx/nginx.prod.conf.bak nginx/nginx.prod.conf
rm nginx/nginx.prod.conf.bak

$COMPOSE --env-file .env.prod up -d nginx

# ---------- 7. Start certbot and bot ----------
info "Starting certbot auto-renewal and Telegram bot..."
$COMPOSE --env-file .env.prod up -d certbot bot

# ---------- 8. Final status ----------
echo ""
info "=== Deployment complete! ==="
echo ""
echo "  Site:    https://${DOMAIN}"
echo "  API:     https://${DOMAIN}/api/docs"
echo ""
info "Checking container status..."
$COMPOSE --env-file .env.prod ps

echo ""
info "To view logs: docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f"
