# DevCollab Production Deployment Guide

This guide details the deployment procedure for **DevCollab** with the frontend hosted on **Vercel** and the backend API & real-time WebSocket service hosted on **Render**.

---

## Architecture Overview

- **Frontend**: Next.js 14 (App Router) deployed to **Vercel**.
- **Backend**: Node.js + Express + Socket.io deployed to **Render** Web Service.
- **Database**: MongoDB Atlas.
- **Cache & PubSub**: Upstash Redis (Serverless).
- **Email Service**: SMTP (SendGrid, Mailgun, or Gmail App Password).
- **Static Assets / Avatars**: Cloudinary.

---

## 1. Backend Deployment on Render

### Step 1.1: Deploy using `render.yaml` Blueprint or Manual Web Service
1. Sign in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint** (or **Web Service**).
3. Connect your DevCollab GitHub repository.
4. Render will automatically detect `render.yaml`. If setting up manually, configure:
   - **Name**: `devcollab-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Health Check Path**: `/health`

### Step 1.2: Configure Backend Environment Variables on Render
Set the following environment variables in Render:

| Variable | Recommended / Example Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations and disables test bypasses |
| `PORT` | `10000` | Port automatically assigned by Render |
| `CLIENT_URL` | `https://your-devcollab.vercel.app` | Your Vercel frontend domain (comma-separated if multiple) |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/devcollab` | MongoDB Atlas connection string |
| `REDIS_URL` | `redis://default:pass@host.upstash.io:6379` | Upstash Redis connection string |
| `JWT_ACCESS_SECRET` | *(64-char random hex string)* | Secret for signing short-lived access tokens |
| `JWT_REFRESH_SECRET` | *(64-char random hex string)* | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifespan |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifespan |
| `PRIMARY_ADMIN_EMAIL` | `admin@devcollab.com` | Primary workspace administrator account |
| `INITIAL_ADMIN_PASSWORD` | `SecureAdminPass2026!` | Initial password for the administrator bootstrap |
| `PRIMARY_ADMIN_NAME` | `Workspace Administrator` | Administrator display name |
| `SMTP_HOST` | `smtp.gmail.com` (or SendGrid host) | Outgoing email server |
| `SMTP_PORT` | `587` | Outgoing SMTP port |
| `SMTP_USER` | `your-email@gmail.com` | SMTP username |
| `SMTP_PASS` | `your-app-password` | SMTP password |
| `EMAIL_FROM` | `DevCollab <noreply@devcollab.com>` | Sender email header |
| `CLOUDINARY_CLOUD_NAME` | `your-cloud-name` | Cloudinary storage identifier |
| `CLOUDINARY_API_KEY` | `your-api-key` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | `your-api-secret` | Cloudinary API secret |

---

## 2. Frontend Deployment on Vercel

### Step 2.1: Import Project to Vercel
1. Sign in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your DevCollab GitHub repository.
4. Set **Root Directory** to `frontend`.
5. Framework Preset: **Next.js** (automatically detected).

### Step 2.2: Configure Frontend Environment Variables on Vercel
In the Vercel project configuration, set:

| Variable | Example Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://devcollab-backend.onrender.com/api/v1` | Your live Render backend API URL |
| `NEXT_PUBLIC_SOCKET_URL` | `https://devcollab-backend.onrender.com` | Your live Render backend root URL (for Socket.io) |

6. Click **Deploy**. Vercel will run `npm run build` and publish your production application.

---

## 3. Post-Deployment Verification

1. **Health Check**:
   Open `https://<your-render-app>.onrender.com/health` in your browser. Verify you receive:
   ```json
   { "status": "ok", "timestamp": "..." }
   ```
2. **Administrator Onboarding**:
   Log in at `https://<your-vercel-app>.vercel.app/login` using your configured administrator credentials (`admin@devcollab.com` / `SecureAdminPass2026!`).
3. **Real-time Live Chat & Pair Programming**:
   Create a project, invite a teammate, and test the real-time collaborative coding studio with synchronized chat.
