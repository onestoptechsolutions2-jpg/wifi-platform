# Deployment Guide — WiFi Marketing Platform

## Prerequisites

- Ubuntu 22.04 VPS (recommended: 4 vCPU / 8 GB RAM — DigitalOcean or Hetzner)
- Domain with DNS A records pointing to the VPS
- Root or sudo access

---

## 1. Server setup

```bash
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx git curl

# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Install Docker + Compose (for Postgres + Redis)
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

---

## 2. Clone the repo

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_ORG/wifi-platform.git
cd wifi-platform
cp .env.example .env
nano .env          # fill in all secrets
```

---

## 3. Start Postgres & Redis

```bash
docker compose up -d postgres redis
```

---

## 4. Build the backend

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed     # creates super admin + demo tenant
npm run build
cd ..
```

---

## 5. Build the frontends

```bash
cd portal    && npm install && npm run build && cd ..
cd dashboard && npm install && npm run build && cd ..
cd admin     && npm install && npm run build && cd ..

# Copy dist folders to web root
mkdir -p /var/www/wifi-platform/{portal,dashboard,admin}/dist
cp -r portal/dist/*    /var/www/wifi-platform/portal/dist/
cp -r dashboard/dist/* /var/www/wifi-platform/dashboard/dist/
cp -r admin/dist/*     /var/www/wifi-platform/admin/dist/
```

---

## 6. SSL certificates

```bash
# Core domains
certbot --nginx -d api.yourdomain.com
certbot --nginx -d app.yourdomain.com
certbot --nginx -d admin.yourdomain.com

# Per-tenant portal (repeat for each client)
certbot --nginx -d wifi.clientbrand.com
```

---

## 7. Nginx

```bash
cp nginx/wifi-platform.conf /etc/nginx/sites-available/wifi-platform
ln -s /etc/nginx/sites-available/wifi-platform /etc/nginx/sites-enabled/
# Edit the file — replace yourdomain.com with your real domain
nginx -t && systemctl reload nginx
```

---

## 8. Start the backend with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup     # follow the printed command to enable on boot
```

---

## 9. Add a new client tenant

1. Log in to `https://admin.yourdomain.com` as super admin
2. Create tenant → fill domain (e.g. `wifi.javacafe.com`)
3. On the VPS: `certbot --nginx -d wifi.javacafe.com`
4. Copy the portal server block in nginx config, set `server_name wifi.javacafe.com`
5. `nginx -t && systemctl reload nginx`
6. In the admin panel → TenantDetail → enter MikroTik credentials → Test Connection

---

## Environment variables (key ones)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | 32+ char random string |
| `ENCRYPTION_KEY` | 32-char hex — encrypts MikroTik passwords |
| `TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM` | SMS OTP |
| `AT_API_KEY / AT_USERNAME / AT_FROM` | Africa's Talking fallback SMS |
| `SENDGRID_API_KEY / SENDGRID_FROM` | Email campaigns |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `FACEBOOK_APP_ID / APP_SECRET` | Facebook OAuth |
| `SUPER_ADMIN_EMAIL / PASSWORD` | Seed script credentials |

---

## Useful commands

```bash
pm2 logs wifi-backend          # live logs
pm2 reload wifi-backend        # zero-downtime reload
docker compose logs -f         # postgres / redis logs
npx prisma migrate dev         # run new migrations (dev only)
certbot renew --dry-run        # test auto-renewal
```
