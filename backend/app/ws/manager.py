import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.queue_rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self.user_rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self.admin_rooms: set[WebSocket] = set()

    async def connect_queue(self, queue_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.queue_rooms[queue_id].add(ws)

    async def connect_user(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.user_rooms[user_id].add(ws)

    async def connect_admin(self, ws: WebSocket) -> None:
        await ws.accept()
        self.admin_rooms.add(ws)

    def disconnect_queue(self, queue_id: str, ws: WebSocket) -> None:
        self.queue_rooms[queue_id].discard(ws)

    def disconnect_user(self, user_id: str, ws: WebSocket) -> None:
        self.user_rooms[user_id].discard(ws)

    def disconnect_admin(self, ws: WebSocket) -> None:
        self.admin_rooms.discard(ws)

    async def _send(self, ws: WebSocket, event: str, payload: Any) -> None:
        try:
            await ws.send_text(json.dumps({"event": event, "data": payload}, default=str))
        except Exception:
            pass

    async def broadcast_queue(self, queue_id: str, event: str, payload: Any) -> None:
        for ws in list(self.queue_rooms.get(queue_id, ())):
            await self._send(ws, event, payload)

    async def broadcast_user(self, user_id: str, event: str, payload: Any) -> None:
        for ws in list(self.user_rooms.get(user_id, ())):
            await self._send(ws, event, payload)

    async def broadcast_admin(self, event: str, payload: Any) -> None:
        for ws in list(self.admin_rooms):
            await self._send(ws, event, payload)

    async def broadcast_token_update(self, queue_id: str, token: Any, event: str = "queue_update") -> None:
        from app.services.queue_engine import serialize_token

        payload = serialize_token(token)
        await self.broadcast_queue(queue_id, event, payload)
        await self.broadcast_admin("token_update", payload)
        if token.patient_id:
            await self.broadcast_user(token.patient_id, "your_token", payload)


manager = ConnectionManager()
