# CRM System — Setup Guide

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker + Docker Compose (optional)

---

## Option 1: Docker Compose (Recommended)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env: set SECRET_KEY, BOT_TOKEN etc.

# 2. Start everything
docker-compose up --build

# 3. Run migrations (first time only)
docker-compose exec backend alembic upgrade head

# Access:
# Frontend: http://localhost:3000
# API Docs:  http://localhost:8000/api/docs
```

---

## Option 2: Manual Setup

### 1. PostgreSQL

```sql
CREATE USER crm WITH PASSWORD 'crm_secret';
CREATE DATABASE crm_db OWNER crm;
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure
cp ../.env.example ../.env
# Edit .env: set DATABASE_URL, REDIS_URL, SECRET_KEY

# Run migrations
alembic upgrade head

# Start
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### 4. Telegram Bot (optional)

```bash
cd bot
pip install -r requirements.txt
# Set BOT_TOKEN in .env
python -m bot.main
```

---

## First Login

After starting, go to `http://localhost:5173/register` and create your company + Owner account.

Default superadmin (if using seeded data):
- Email: `admin@crm.local`
- Password: `Admin123!`

---

## API Documentation

Swagger UI: `http://localhost:8000/api/docs`
ReDoc: `http://localhost:8000/api/redoc`

---

## Architecture

```
E:/crm/
├── backend/          # FastAPI + SQLAlchemy + PostgreSQL + Redis
│   ├── app/
│   │   ├── api/      # REST endpoints
│   │   ├── core/     # Auth, RBAC, dependencies
│   │   ├── models/   # SQLAlchemy ORM
│   │   ├── schemas/  # Pydantic I/O
│   │   ├── services/ # Business logic
│   │   ├── repositories/ # Data access (tenant-scoped)
│   │   └── tasks/    # APScheduler jobs
│   └── alembic/      # DB migrations
├── frontend/         # React + TypeScript + Tailwind CSS
│   └── src/
│       ├── api/      # Typed API calls
│       ├── pages/    # All application pages
│       ├── components/ # UI design system
│       ├── hooks/    # React Query hooks
│       └── store/    # Zustand state
└── bot/              # aiogram Telegram bot
    └── bot/
        ├── handlers/ # /start, /connect commands
        └── notifications/ # Redis pub/sub listener
```
