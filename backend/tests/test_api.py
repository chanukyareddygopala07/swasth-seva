import asyncio
import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:////tmp/swasth_test_pytest.db"
os.environ["AI_MODEL_DIR"] = "/tmp/swasth_models_pytest"

pytestmark = pytest.mark.asyncio


@pytest.fixture(scope="session", autouse=True)
def prepare_db():
    from app.database import Base, engine
    from app import models  # noqa: F401

    if os.path.exists("/tmp/swasth_test_pytest.db"):
        os.remove("/tmp/swasth_test_pytest.db")
    async def _prepare():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from app.seed import seed

        await seed()

    asyncio.run(_prepare())
    yield


@pytest.fixture(scope="session")
def client():
    from app.main import app

    async def _make():
        transport = ASGITransport(app=app)
        return AsyncClient(transport=transport, base_url="http://test")

    return asyncio.run(_make())


async def _login(client, email: str, password: str) -> dict:
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}


async def test_health(client):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_auth_flow(client):
    r = await client.post(
        "/api/v1/auth/register/patient",
        json={"full_name": "Test Patient", "email": "pytest@demo.com", "password": "Pytest@123"},
    )
    assert r.status_code == 201
    r = await client.post("/api/v1/auth/login", json={"email": "pytest@demo.com", "password": "Pytest@123"})
    assert r.status_code == 200
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": r.json()["tokens"]["refresh_token"]})
    assert r.status_code == 200


async def test_ai_triage(client):
    r = await client.post("/api/v1/ai/triage", json={"symptoms": ["chest pain", "breathing difficulty"], "age": 60})
    assert r.status_code == 200
    assert r.json()["level"] in ("red", "orange", "yellow", "green")
    assert r.json()["level"] in ("red", "orange")


async def test_ai_wait_prediction(client):
    r = await client.post(
        "/api/v1/ai/wait-prediction",
        json={"queue_size": 10, "avg_consultation_minutes": 12, "hour": 10, "day_of_week": 1},
    )
    assert r.status_code == 200
    assert r.json()["predicted_wait_minutes"] > 0


async def test_ai_sentiment(client):
    r = await client.post("/api/v1/ai/sentiment", json={"text": "Excellent caring staff, highly recommend"})
    assert r.status_code == 200
    assert r.json()["sentiment"] == "positive"


async def test_hospitals_and_departments(client):
    r = await client.get("/api/v1/hospitals", params={"city": "Hyderabad"})
    assert r.status_code == 200
    assert len(r.json()) >= 1
    hid = r.json()[0]["id"]
    r = await client.get(f"/api/v1/hospitals/{hid}/departments")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_queue_flow(client):
    patient = await _login(client, "patient@demo.com", "Patient@123")
    admin = await _login(client, "admin@demo.com", "Admin@123")
    hid = (await client.get("/api/v1/hospitals", params={"city": "Hyderabad"})).json()[0]["id"]
    dept_id = (await client.get(f"/api/v1/hospitals/{hid}/departments")).json()[0]["id"]
    r = await client.post(
        "/api/v1/tokens",
        headers=patient,
        json={"hospital_id": hid, "department_id": dept_id, "symptoms": ["fever"]},
    )
    assert r.status_code == 201
    token = r.json()
    assert token["priority"] in ("green", "yellow", "orange", "red")
    assert token["predicted_wait_minutes"] is not None
    r = await client.get("/api/v1/tokens/mine/latest", headers=patient)
    assert r.status_code == 200
    r = await client.post(f"/api/v1/tokens/{token['id']}/cancel", headers=patient)
    assert r.status_code == 200


async def test_role_guard(client):
    patient = await _login(client, "patient@demo.com", "Patient@123")
    r = await client.get("/api/v1/superadmin/users", headers=patient)
    assert r.status_code == 403


async def test_feedback_sentiment(client):
    patient = await _login(client, "patient@demo.com", "Patient@123")
    hid = (await client.get("/api/v1/hospitals", params={"city": "Hyderabad"})).json()[0]["id"]
    r = await client.post(
        "/api/v1/feedback",
        headers=patient,
        json={"hospital_id": hid, "rating": 5, "comment": "Excellent care, very caring staff"},
    )
    assert r.status_code == 201
    assert r.json()["sentiment"] == "positive"


async def test_search(client):
    r = await client.get("/api/v1/search", params={"q": "Apollo"})
    assert r.status_code == 200
    assert len(r.json()["hospitals"]) >= 1
