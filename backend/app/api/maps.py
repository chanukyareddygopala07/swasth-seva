from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models.user import Hospital, Patient, User
from app.services.maps_service import driving_eta, geocode

router = APIRouter(prefix="/maps", tags=["maps"])


@router.get("/geocode")
async def geocode_address(q: str = Query(..., min_length=2)):
    result = await geocode(q)
    if not result:
        return {"success": False, "message": "Location not found"}
    return {"success": True, **result}


@router.get("/route")
async def route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
):
    result = await driving_eta(origin_lat, origin_lng, dest_lat, dest_lng)
    if not result:
        return {"success": False, "message": "Route unavailable"}
    return {"success": True, **result}


@router.get("/nearby-hospitals")
async def nearby_hospitals(
    db: DbSession,
    lat: float,
    lng: float,
    radius_km: float = Query(25, ge=1, le=200),
):
    from app.services.ai_service import haversine

    hospitals = list((await db.execute(select(Hospital).where(Hospital.is_active.is_(True)))).scalars().all())
    result = []
    for h in hospitals:
        if h.lat is None or h.lng is None:
            continue
        distance = haversine(lat, lng, h.lat, h.lng)
        if distance > radius_km:
            continue
        eta = await driving_eta(lat, lng, h.lat, h.lng)
        result.append(
            {
                "id": h.id,
                "name": h.name,
                "address": h.address,
                "city": h.city,
                "lat": h.lat,
                "lng": h.lng,
                "distance_km": round(distance, 1),
                "eta_minutes": (eta or {}).get("eta_minutes"),
                "rating": h.rating,
                "occupancy_pct": h.occupancy_pct,
            }
        )
    result.sort(key=lambda r: r["distance_km"])
    return result


@router.get("/nearby-pharmacies")
async def nearby_pharmacies(db: DbSession, lat: float, lng: float, radius_km: float = Query(10, ge=1, le=50)):
    from app.models.misc import Pharmacy
    from app.services.ai_service import haversine

    pharmacies = list((await db.execute(select(Pharmacy))).scalars().all())
    result = []
    for p in pharmacies:
        if p.lat is None or p.lng is None:
            continue
        distance = haversine(lat, lng, p.lat, p.lng)
        if distance <= radius_km:
            result.append(
                {
                    "id": p.id,
                    "name": p.name,
                    "address": p.address,
                    "distance_km": round(distance, 1),
                    "is_open_24h": p.is_open_24h,
                    "rating": p.rating,
                    "phone": p.phone,
                }
            )
    result.sort(key=lambda r: r["distance_km"])
    return result
