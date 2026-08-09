.PHONY: up down logs ps build migrate seed backend frontend train test lint

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

build:
	docker compose build

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.seed

train:
	docker compose exec backend python -m app.ai.train

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && pytest
	cd frontend && npm run test

lint:
	cd backend && ruff check app
	cd frontend && npm run lint
