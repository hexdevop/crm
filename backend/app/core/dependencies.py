import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    AccountDisabledException,
    AccessExpiredException,
    ForbiddenException,
    UnauthorizedException,
)
from app.core.security import decode_access_token
from app.database import get_db
from app.redis_client import get_redis

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Extract and validate JWT, return User ORM object."""
    from app.models.user import User
    from app.models.role import UserRole
    from app.models.access_expiration import AccessExpiration

    if not credentials:
        raise UnauthorizedException()

    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise UnauthorizedException()
    except JWTError:
        raise UnauthorizedException("Invalid or expired token")

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role)
        )
        .where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedException("User not found")
    if not user.is_active:
        raise AccountDisabledException()

    # Check access expiration
    exp_result = await db.execute(
        select(AccessExpiration).where(AccessExpiration.user_id == user.id)
    )
    expiration = exp_result.scalar_one_or_none()
    if expiration and expiration.expires_at < datetime.now(timezone.utc):
        if user.is_active:
            user.is_active = False
            await db.commit()
        raise AccessExpiredException()

    return user


async def get_current_active_user(
    current_user=Depends(get_current_user),
):
    return current_user


async def get_permissions(
    current_user=Depends(get_current_user),
    redis=Depends(get_redis),
) -> set[str]:
    """Return cached permission set for user."""
    cache_key = f"perms:{current_user.id}"
    cached = await redis.smembers(cache_key)
    if cached:
        return cached

    # Compute from DB
    perms: set[str] = set()
    if current_user.is_superadmin:
        perms = {"*"}
    else:
        from app.models.role import UserRole, Role, RolePermission, Permission
        from sqlalchemy.orm import joinedload

        result = await current_user.awaitable_attrs.user_roles if hasattr(
            current_user, "awaitable_attrs"
        ) else current_user.user_roles

        for user_role in result:
            role = user_role.role
            if role:
                for rp in role.role_permissions:
                    if rp.permission:
                        perms.add(rp.permission.code)

    if perms:
        await redis.sadd(cache_key, *perms)
        await redis.expire(cache_key, 900)  # 15 min TTL

    return perms


def require_permission(permission_code: str):
    """Dependency factory: raises 403 if user lacks the permission."""

    async def _check(
        current_user=Depends(get_current_user),
        redis=Depends(get_redis),
    ):
        if current_user.is_superadmin:
            return current_user

        cache_key = f"perms:{current_user.id}"
        is_member = await redis.sismember(cache_key, permission_code)
        if is_member:
            return current_user

        # Fallback: check if wildcard or specific perm exists
        cached = await redis.smembers(cache_key)
        if not cached:
            # Need to rebuild cache - re-run get_permissions logic
            from app.models.role import UserRole, RolePermission, Permission

            perms: set[str] = set()
            for user_role in current_user.user_roles:
                if user_role.role:
                    for rp in user_role.role.role_permissions:
                        if rp.permission:
                            perms.add(rp.permission.code)

            if perms:
                await redis.sadd(cache_key, *perms)
                await redis.expire(cache_key, 900)
            cached = perms

        if "*" in cached or permission_code in cached:
            return current_user

        raise ForbiddenException(
            f"Permission '{permission_code}' required"
        )

    return _check


def require_superadmin():
    """Dependency: raises 403 unless the current user is a superadmin."""
    async def _check(current_user=Depends(get_current_user)):
        if not current_user.is_superadmin:
            raise ForbiddenException("Superadmin access required")
        return current_user
    return _check


async def invalidate_user_permissions_cache(user_id: uuid.UUID, redis) -> None:
    """Call after role assignment changes."""
    await redis.delete(f"perms:{user_id}")
