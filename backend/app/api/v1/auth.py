from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import MeResponse, CompanyShort
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    service = AuthService(db, redis)
    user = await service.register(data)
    access_token, refresh_token = await service.login(data.email, data.password)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # True in production
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    service = AuthService(db, redis)
    access_token, refresh_token = await service.login(data.email, data.password)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
    refresh_token: str | None = Cookie(default=None),
):
    from app.core.exceptions import UnauthorizedException
    if not refresh_token:
        raise UnauthorizedException("No refresh token")

    service = AuthService(db, redis)
    access_token, new_refresh = await service.refresh(refresh_token)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout(
    response: Response,
    redis=Depends(get_redis),
    refresh_token: str | None = Cookie(default=None),
):
    if refresh_token:
        service = AuthService(None, redis)
        await service.logout(refresh_token)
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user=Depends(get_current_user),
    redis=Depends(get_redis),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    # Get permissions
    perms: set[str] = set()
    if current_user.is_superadmin:
        perms = {"*"}
    else:
        cache_key = f"perms:{current_user.id}"
        cached = await redis.smembers(cache_key)
        if cached:
            perms = cached
        else:
            for user_role in current_user.user_roles:
                if user_role.role:
                    for rp in user_role.role.role_permissions:
                        if rp.permission:
                            perms.add(rp.permission.code)
            if perms:
                await redis.sadd(cache_key, *perms)
                await redis.expire(cache_key, 900)

    # Get company
    from sqlalchemy import select
    from app.models.company import Company
    company = None
    if current_user.company_id:
        result = await db.execute(
            select(Company).where(Company.id == current_user.company_id)
        )
        comp = result.scalar_one_or_none()
        if comp:
            company = CompanyShort.model_validate(comp)

    from app.schemas.user import RoleShortResponse
    roles = [
        RoleShortResponse.model_validate(ur.role)
        for ur in current_user.user_roles
        if ur.role
    ]

    return MeResponse(
        id=current_user.id,
        company_id=current_user.company_id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_superadmin=current_user.is_superadmin,
        telegram_chat_id=current_user.telegram_chat_id,
        telegram_username=current_user.telegram_username,
        roles=roles,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        permissions=list(perms),
        company=company,
    )
