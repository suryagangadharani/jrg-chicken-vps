# 🚀 JRG Chicken — Production VPS & GitHub Deployment Guide

This guide details how to push your cleaned **JRG Chicken** codebase to GitHub and deploy it on your VPS server with PostgreSQL, WebSockets, Web Audio notification engine, and SSL.

---

## 1. Clean Architecture & First-Time Admin Account

All dummy/default admin accounts have been removed from source code for maximum security.

### How Admin Setup Works:
- **First Registered User:** The **very first account** created on a fresh installation (via `/auth` Sign Up or "Continue with Google") is **automatically assigned the `admin` role**.
- **Delivery Boy Creation:** Once logged in as Admin, navigate to **Admin Dashboard ➔ Delivery Boys** (`/admin/delivery-boys`) to add delivery personnel.

---

## 2. Pushing Code to GitHub

Open your terminal in the project directory:

```bash
# 1. Initialize git repository (if not already initialized)
git init

# 2. Add all clean production files
git add .

# 3. Commit changes
git commit -m "Production release: Clean VPS Express + Postgres backend, real-time WebSockets, delivery dashboard, and notification center"

# 4. Rename branch to main
git branch -M main

# 5. Connect your GitHub remote repository (Replace with your actual GitHub repository URL)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/chicken-hub-online.git

# 6. Push code to GitHub
git push -u origin main
```

---

## 3. VPS Deployment Options

### Option A: Docker Deployment (Recommended)

The project includes a multi-stage production `Dockerfile` and `docker-compose.yml`.

1. **Clone repository on your VPS:**
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/chicken-hub-online.git /var/www/jrg-chicken
   cd /var/www/jrg-chicken
   ```

2. **Create production `.env` file:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Fill in your production passwords and secrets.

3. **Build and launch with Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

---

### Option B: PM2 + Node.js Deployment (Native VPS)

1. **Install Node.js 20+ & PM2 on VPS:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

2. **Clone and build project:**
   ```bash
   cd /var/www/jrg-chicken
   npm install
   npm run build
   ```

3. **Start backend API & server with PM2:**
   ```bash
   pm2 start "npx tsx server/index.ts" --name "jrg-chicken-backend"
   pm2 save
   pm2 startup
   ```

---

## 4. Reverse Proxy & Free SSL Setup (Nginx + Certbot)

1. **Install Nginx & Certbot:**
   ```bash
   sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Create Nginx Configuration (`/etc/nginx/sites-available/jrgchicken.in`):**
   ```nginx
   server {
       server_name jrgchicken.in www.jrgchicken.in;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /ws {
           proxy_pass http://127.0.0.1:3000/ws;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

3. **Enable site & request Let's Encrypt SSL certificate:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/jrgchicken.in /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d jrgchicken.in -d www.jrgchicken.in
   ```

---

## 5. Verification Checklist

- [x] Web storefront loads cleanly on domain (`https://jrgchicken.in`).
- [x] First user registration grants Admin privileges automatically.
- [x] Real-time WebSockets connected (`/ws`).
- [x] Delivery Boy Dashboard accessible at `/delivery`.
- [x] Web Audio chime sound alerts and Notification Center history active.
