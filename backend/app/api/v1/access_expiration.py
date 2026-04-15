import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.access_expiration import (
    AccessExpirationCreate,
    AccessExpirationResponse,
    AccessExpirationUpdate,
)
from app.schemas.common import MessageResponse
from app.services.access_expiration import AccessExpirationService

router = APIRouter(prefix="/access-expiration", tags=["Access Expiration"])


@router.get("", response_model=list[AccessExpirationResponse])
async def list_expirations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = AccessExpirationService(db, current_user.company_id)
    items, _ = await service.list_expirations()
    return items


@router.post("", response_model=AccessExpirationResponse, status_code=201)
async def set_expiration(
    data: AccessExpirationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = AccessExpirationService(db, current_user.company_id)
    return await service.set_expiration(data)


@router.get("/{user_id}", response_model=AccessExpirationResponse)
async def get_expiration(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = AccessExpirationService(db, current_user.company_id)
    return await service.get_expiration(user_id)


@router.patch("/{user_id}", response_model=AccessExpirationResponse)
async def update_expiration(
    user_id: uuid.UUID,
    data: AccessExpirationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = AccessExpirationService(db, current_user.company_id)
    return await service.update_expiration(user_id, data)


@router.delete("/{user_id}", status_code=204)
async def delete_expiration(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = AccessExpirationService(db, current_user.company_id)
    await service.delete_expiration(user_id)
