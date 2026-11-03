# DevCollab

A real-time collaborative workspace combining line-level code reviews and Kanban project management for engineering teams.

## Architecture Overview

```
┌─────────────────┐      REST + WebSocket      ┌──────────────────┐
│   Next.js 14     │ ◄────────────────────────► │  Express API     │
│   (App Router)    │                            │  + Socket.io     │
│   Redux Toolkit    │                            └─────────┬────────┘
└─────────────────┘                                       │
                                                  ┌─────────┴────────┐
                                                  │                  │
                                          ┌───────▼──────┐   ┌──────▼──────┐
                                          │  MongoDB      │   │ Redis        │
                                          │  (Data Store) │   │ (Rate Limit) │
                                          └──────────────┘   └─────────────┘
```

## Features

- **Authentication & Security** — JWT access/refresh token rotation with httpOnly cookies, OTP email verification, and bcrypt password hashing.
- **Real-Time Code Review** — Syntax-highlighted code submissions with inline, line-by-line comment threads synced over WebSockets.
- **Kanban Board** — Task management with drag-and-drop support (`@dnd-kit`), column customization, and assignee tracking.
- **Media Uploads** — Cloudinary integration for user avatars and file attachments.
- **Real-Time Notifications** — Instant in-app notification dispatch and unread badge counts via Socket.io.
- **Role-Based Access** — Project ownership, member invitations, and granular role permissions.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Redux Toolkit, React Query, Socket.io-client, dnd-kit, Lucide React
- **Backend**: Node.js, Express, MongoDB (Mongoose), Redis (ioredis), Socket.io, Joi, Winston, Multer, Cloudinary, Nodemailer
- **Testing**: Jest, Supertest, React Testing Library

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Environment Setup

1. Configure backend environment:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Fill in your MongoDB URI, Redis URL, JWT secrets, Cloudinary keys, and SMTP credentials.

2. Configure frontend environment:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

### Running Locally

```bash
# Terminal 1 - Backend API
cd backend
npm install
npm run dev

# Terminal 2 - Frontend App
cd frontend
npm install
npm run dev
```

The frontend will be running on `http://localhost:3000` and the backend on `http://localhost:5000`.

### Running with Docker (Live Reload)

To run the entire full-stack application with live code reloading enabled:

```bash
docker compose up --build
```

- Any backend changes saved in `./backend` trigger an automatic reload via `nodemon` with polling.
- Any frontend changes saved in `./frontend` trigger Next.js Fast Refresh automatically.

To run the production-optimized build:

```bash
docker compose -f docker-compose.prod.yml up --build
```

### Running Tests

```bash
# Backend integration tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test
```

## Deployment Guide

### 1. Deploying the Backend on Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. Set the following **Environment Variables** in the Render Dashboard:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render will bind automatically)
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_ACCESS_SECRET`: A secure random string (minimum 32 characters)
   - `JWT_REFRESH_SECRET`: A secure random string (minimum 32 characters)
   - `CLIENT_URL`: Your Vercel frontend URL (e.g. `https://devcollab.vercel.app`)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`: Your email service credentials
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Your Cloudinary keys

> **Note**: Cross-origin cookies and CORS are pre-configured to allow `.vercel.app` domains and use `sameSite: 'none'` with `secure: true` in production.

---

### 2. Deploying the Frontend on Vercel

1. Import your GitHub repository on [Vercel](https://vercel.com).
2. In the project creation screen, set:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select `frontend`
3. Add the following **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: Your Render backend API endpoint (e.g. `https://devcollab-backend.onrender.com/api/v1`)
   - `NEXT_PUBLIC_SOCKET_URL`: Your Render backend base URL (e.g. `https://devcollab-backend.onrender.com`)
4. Click **Deploy**. Vercel will automatically build and publish your Next.js 14 application.

---

## License

MIT
