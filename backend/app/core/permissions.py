from functools import wraps
from typing import Callable, List

from fastapi import HTTPException, status

from app.models.user import User


def require_roles(*roles: str) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user: User | None = None
            for arg in args:
                if isinstance(arg, User):
                    user = arg
                    break
            if user is None:
                for _, value in kwargs.items():
                    if isinstance(value, User):
                        user = value
                        break
            if user is None or user.role not in roles:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
            return await func(*args, **kwargs)

        return wrapper

    return decorator


ROLE_HIERARCHY = {
    "super_admin": 5,
    "admin": 4,
    "doctor": 3,
    "receptionist": 2,
    "patient": 1,
}


def can(user: User, minimum_role: str) -> bool:
    return ROLE_HIERARCHY.get(user.role, 0) >= ROLE_HIERARCHY.get(minimum_role, 0)


def hospital_scoped(user: User, hospital_id: str | None) -> bool:
    if user.role in ("super_admin",):
        return True
    if user.role == "admin":
        return True
    if user.role == "doctor":
        from app.models.user import Doctor

        return user.doctor is not None and str(user.doctor.hospital_id) == str(hospital_id)
    if user.role == "receptionist":
        return str(user.hospital_id) == str(hospital_id)
    return False
