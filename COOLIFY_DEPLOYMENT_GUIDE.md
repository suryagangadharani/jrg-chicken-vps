# Coolify Deployment Guide — JRG Chicken / Chicken Hub Online

This guide explains how to deploy **JRG Chicken / Chicken Hub Online** (Full-stack Express + React App + PostgreSQL Database) in **Coolify**.

---

## 1. Database Recommendation

### **Best Database for this Project: PostgreSQL 16**

**Why PostgreSQL is the best choice:**
1. **Direct Native Compatibility:** The application's backend (`server/db/index.ts`) is built specifically using Node.js `pg` driver and PostgreSQL SQL standard dialect.
2. **Schema Features:** Uses PostgreSQL features like `UUID` generation (`uuid-ossp` extension), `JSONB` for order items, array columns (`price_presets`, `images`), and `ENUM` types.
3. **Auto-Migration & Auto-Seeding:** When the container starts up, `server/db/index.ts` automatically executes `server/db/schema.sql`, creating all tables (`profiles`, `user_roles`, `categories`, `products`, `orders`, `promo_codes`, `banners`, `reviews`, etc.) and seeding the default admin user.
4. **Coolify Native Support:** Coolify natively supports 1-click managed PostgreSQL or containerized Docker Compose PostgreSQL.

---

## 2. Deployment Methods in Coolify

You have **two main methods** to deploy this application in Coolify. **Method 1 (Docker Compose)** is recommended because it deploys the Web Application and PostgreSQL Database together in 1 click.

---

### Method 1: Docker Compose (Recommended - App + Database in 1 Click)

1. Open your **Coolify Dashboard**.
2. Go to **Projects** -> Select your Project & Environment.
3. Click **+ Add New Resource** -> Select **Docker Compose**.
4. Choose your deployment source:
   - **GitHub Repository**: Connect your Git repository containing this code.
   - **Docker Compose Raw**: Paste the contents of `docker-compose.yml`.
5. Coolify will automatically read `docker-compose.yml`.
6. Configure the Environment Variables in Coolify (under the **Environment Variables** tab):

```env
PORT=3000
NODE_ENV=production
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_postgres_password_here
POSTGRES_DB=jrg_chicken
DATABASE_URL=postgresql://postgres:your_secure_postgres_password_here@postgres:5432/jrg_chicken
JWT_SECRET=your_random_secure_jwt_secret_key_here
```

7. Set your domain name in Coolify under the **`app` service domain configuration**:
   - e.g., `https://jrgchicken.in` or `https://app.yourdomain.com`
8. Click **Deploy**.

---

### Method 2: Coolify Managed PostgreSQL + Dockerfile App

If you prefer to host PostgreSQL as a separate managed service inside Coolify:

#### Step A: Create PostgreSQL Database in Coolify
1. Click **+ Add New Resource** -> Select **PostgreSQL**.
2. Set Database Name: `jrg_chicken`
3. Click **Deploy**.
4. Copy the internal database connection string provided by Coolify (e.g. `postgresql://postgres:password@postgresql-xxx:5432/jrg_chicken`).

#### Step B: Deploy Application via Dockerfile
1. Click **+ Add New Resource** -> Select **Public/Private Repository** (or Dockerfile).
2. Select your Git Repository.
3. Build Pack: Select **Dockerfile**.
4. Add Environment Variables:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `DATABASE_URL` = *(pasted from Step A)*
   - `JWT_SECRET` = *(your custom secret key)*
5. Map Persistent Volume for Uploads:
   - Volume Destination: `/app/uploads`
6. Set your domain name and exposed port (`3000`).
7. Click **Deploy**.

---

## 3. Persistent Volumes

This application relies on two persistent volumes:
- **`postgres_data` (`/var/lib/postgresql/data`)**: Stores all database tables, user records, and orders permanently.
- **`uploads_data` (`/app/uploads`)**: Stores image uploads (product images, banners, category icons).

Both volumes are pre-configured in `docker-compose.yml` and will be managed automatically by Coolify.

---

## 4. Initial Login Credentials

Once deployed, the database automatically initializes with default seed data and an admin account:

- **Admin Login Email:** `admin@jrgchicken.in`
- **Admin Login Password:** `adminpassword`

> **Note:** Log into the Admin Dashboard after deployment to change the default admin password!

---

## 5. Health Check Endpoint

- **URL:** `https://your-domain.com/api/health`
- **Expected Output:**
  ```json
  {
    "status": "ok",
    "service": "JRG Chicken API Server",
    "timestamp": "2026-08-17T..."
  }
  ```
