import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger("swasth.maps")


async def geocode(query: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                settings.NOMINATIM_API_URL,
                params={"q": query, "format": "json", "limit": 1},
                headers={"User-Agent": "swasth-seva/1.0"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data:
                return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"]), "display_name": data[0]["display_name"]}
    except Exception as exc:
        logger.warning("geocode failed: %s", exc)
    return None


async def driving_eta(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"{settings.OSRM_API_URL}/{origin_lng},{origin_lat};{dest_lng},{dest_lat}",
                params={"overview": "false"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok" and data["routes"]:
                route = data["routes"][0]
                return {
                    "distance_km": round(route["distance"] / 1000, 1),
                    "eta_minutes": int(route["duration"] / 60),
                }
    except Exception as exc:
        logger.warning("osrm failed: %s", exc)
    return None
