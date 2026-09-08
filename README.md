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

### Running Tests

```bash
# Backend integration tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test
```

## License

MIT
