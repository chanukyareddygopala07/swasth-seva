# Swasth Seva

AI-powered hospital queue management platform. Patients register, get AI-triage priority, and receive real-time queue notifications; hospitals manage queues, staff, and analytics.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query, Vitest |
| Backend  | FastAPI, SQLAlchemy 2 (async), PostgreSQL 16, Redis, Alembic |
| AI       | scikit-learn / XGBoost triage + wait-time prediction, sentiment analysis (pre-trained) |
| Infra    | Docker Compose, GitHub Actions CI |

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health

`docker compose up` runs migrations, seeds demo data (hospitals, departments, demo users, a small AI model), and starts all services.

### Demo accounts (seeded)

| Role        | Email               | Password      |
|-------------|---------------------|---------------|
| Patient     | patient@demo.com    | Patient@123   |
| Hospital admin | admin@demo.com   | Admin@123     |
| Doctor      | doctor@demo.com     | Doctor@123    |
| Super admin | superadmin@swasthseva.app | SuperAdmin@123 |

## Local development

Backend (needs local PostgreSQL + Redis, or run `docker compose up db redis`):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Testing

```bash
make test       # backend pytest + frontend vitest
make lint       # backend ruff + frontend next lint
```

Backend tests run against a disposable SQLite database (no services required). Frontend tests cover the shared API client and utility functions with mocked `fetch`/`localStorage`.

## CI / deployment

`.github/workflows/ci.yml` runs on every push/PR to `main`:

- **Backend**: `ruff check` + `pytest`
- **Frontend**: `npm ci` → lint → typecheck → vitest → production build

All checks must pass before merge, so the Docker images in `docker-compose.yml` are safe to build and ship.

## Configuration

Copy `.env.example` → `.env` and adjust. All external integrations (SMTP, SMS, WhatsApp, Cloudinary, OSRM/Nominatim) are optional — the app runs without them. In production, change `SECRET_KEY` and all default passwords, and point `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` at your deployed backend.

## Project layout

```
backend/            FastAPI app (app/api routers, services, models, ai/)
frontend/           Next.js app (src/app pages, components, lib)
docs/               Additional documentation
docker-compose.yml  Full-stack deployment
.github/workflows/  CI pipeline
```