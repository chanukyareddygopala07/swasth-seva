from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.api import (
    admin,
    ai,
    analytics,
    appointments,
    auth,
    emergency,
    feedback,
    health,
    hospitals,
    maps,
    notifications,
    queue,
    search,
    superadmin,
    users,
)
from app.config import settings
from app.core.rate_limit import close_redis
from app.models.user import Doctor, Patient, User
from app.ws.manager import manager

app = FastAPI(
    title="Swasth Seva API",
    description="AI-Powered Smart Hospital Queue & Patient Flow Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    users.router,
    hospitals.router,
    appointments.router,
    queue.router,
    emergency.router,
    notifications.router,
    feedback.router,
    analytics.router,
    admin.router,
    superadmin.router,
    ai.router,
    search.router,
    maps.router,
    health.router,
):
    app.include_router(router, prefix=settings.API_V1_PREFIX)


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_redis()


@app.websocket("/ws/queue/{queue_id}")
async def ws_queue(websocket: WebSocket, queue_id: str):
    await manager.connect_queue(queue_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_queue(queue_id, websocket)


@app.websocket("/ws/user/{user_id}")
async def ws_user(websocket: WebSocket, user_id: str):
    await manager.connect_user(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_user(user_id, websocket)


@app.websocket("/ws/admin")
async def ws_admin(websocket: WebSocket):
    await manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "out"


def _mount_frontend() -> None:
    if not FRONTEND_DIST.is_dir():
        return
    app.mount("/_next", StaticFiles(directory=FRONTEND_DIST / "_next"), name="next-assets")
    dist = FRONTEND_DIST.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path.split("/")[0] in ("api", "ws", "docs", "redoc", "openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        target = (dist / full_path).resolve()
        if target.is_relative_to(dist) and target.is_file():
            return FileResponse(target)
        return FileResponse(dist / "index.html")


_mount_frontend()
