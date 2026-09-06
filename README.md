# DevCollab — Real-Time Collaborative Code Review & Project Management

DevCollab is a full-stack MERN platform that combines GitHub-style code review with Notion-style project boards, built for distributed teams who need to review code and manage work in real time.

## Why this project exists

Most portfolio projects are CRUD clones. DevCollab was built to demonstrate production-level engineering decisions: real-time synchronization across clients, token-based authentication with rotation, rate limiting under load, and a deployment pipeline that mirrors how small engineering teams actually ship software.

## Architecture

```
┌─────────────────┐      REST + WebSocket      ┌──────────────────┐
│   Next.js 14     │ ◄────────────────────────► │  Express API     │
│   (App Router)    │                            │  + Socket.io     │
│   Redux Toolkit    │                            └─────────┬────────┘
└─────────────────┘                                       │
                                                  ┌─────────┴────────┐
                                                  │                  │
                                          ┌───────▼──────┐   ┌──────▼──────┐
                                          │  MongoDB Atlas │   │ Redis (Upstash)│
                                          │  (data layer)  │   │ (cache/rate-limit)│
                                          └────────────────┘   └─────────────┘
```

## Core features

- **Authentication** — JWT access/refresh token rotation, httpOnly cookies, email OTP verification, bcrypt password hashing.
- **Real-time code review** — Inline, line-level comments on code submissions with live updates via Socket.io. Reviewers see new comments appear without refreshing.
- **Kanban project boards** — Drag-and-drop task management (`@dnd-kit`) with optimistic UI updates and real-time sync across collaborators.
- **File uploads** — Avatar and attachment uploads via Cloudinary with automatic image optimization.
- **Notifications** — In-app real-time notifications plus email digests for key events (comments, approvals, task assignments).
- **Project & team management** — Role-based membership (admin/contributor/viewer), invite-by-email flow.

## Tech stack

**Frontend:** Next.js 14 (App Router), TypeScript, Redux Toolkit, React Query, Tailwind CSS, React Hook Form + Zod, Socket.io client, dnd-kit

**Backend:** Node.js, Express, MongoDB + Mongoose, Redis, Socket.io, JWT, Joi validation, Winston logging, Multer + Cloudinary, Nodemailer

**DevOps:** Docker + docker-compose, GitHub Actions CI/CD, Railway (backend), Vercel (frontend)

**Testing:** Jest + Supertest (backend integration tests), Jest + React Testing Library (frontend unit tests)

## Getting started locally

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (recommended) or local MongoDB + Redis

### Quick start with Docker

```bash
git clone <your-repo-url>
cd devcollab

# Copy and fill in environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start everything
docker-compose up --build
```

The app will be available at `http://localhost:3000`, the API at `http://localhost:5000`.

### Manual setup (without Docker)

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in MongoDB URI, JWT secrets, Cloudinary, SMTP
npm run dev

# Frontend (in a new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Running tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list. You'll need free-tier accounts for:
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) — database
- [Upstash Redis](https://upstash.com) — caching and rate limiting
- [Cloudinary](https://cloudinary.com) — file/image storage
- An SMTP provider (Gmail app password works for development)

## Deployment

The CI/CD pipeline (`.github/workflows/`) automatically:
1. Runs lint and the full test suite on every push
2. Builds Docker images
3. Deploys the backend to Railway and frontend to Vercel on merge to `main`

To set this up yourself, add `RAILWAY_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub repository secrets.

## Project structure

```
devcollab/
├── backend/
│   ├── src/
│   │   ├── config/        # DB, Cloudinary, env validation
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, error handling, validation
│   │   ├── models/        # Mongoose schemas
│   │   ├── routes/        # Express routers
│   │   ├── services/      # Email service
│   │   ├── socket/        # Socket.io event handlers
│   │   ├── utils/         # JWT, logger, error classes
│   │   └── validators/    # Joi schemas
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # UI, board, reviews, layout components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # API client, socket client, utils
│   │   └── store/          # Redux Toolkit slices
│   └── __tests__/
└── .github/workflows/      # CI/CD pipelines
```

## License

MIT
