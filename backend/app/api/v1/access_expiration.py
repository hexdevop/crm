import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_superadmin
from app.database import get_db
from app.schemas.access_expiration import (
    AccessExpirationCreate,
    AccessExpirationResponse,
    AccessExpirationUpdate,
)
from app.services.access_expiration import AccessExpirationService

router = APIRouter(prefix="/access-expiration", tags=["Access Expiration"])

# All endpoints here are superadmin-only.
# The service is initialized with company_id=None which means "global scope" —
# the repository will skip the tenant filter (same pattern as superadmin entity access).


@router.get("", response_model=list[AccessExpirationResponse])
async def list_expirations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_superadmin()),
):
    service = AccessExpirationService(db, None)
    items, _ = await service.list_expirations()
    return items


@router.post("", response_model=AccessExpirationResponse, status_code=201)
async def set_expiration(
    data: AccessExpirationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_superadmin()),
):
    # company_id is resolved from the target user inside the service
    service = AccessExpirationService(db, None)
    return await service.set_expiration(data)


@router.get("/{user_id}", response_model=AccessExpirationResponse)
async def get_expiration(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_superadmin()),
):
    service = AccessExpirationService(db, None)
    return await service.get_expiration(user_id)


@router.patch("/{user_id}", response_model=AccessExpirationResponse)
async def update_expiration(
    user_id: uuid.UUID,
    data: AccessExpirationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_superadmin()),
):
    service = AccessExpirationService(db, None)
    return await service.update_expiration(user_id, data)


@router.delete("/{user_id}", status_code=204)
async def delete_expiration(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_superadmin()),
):
    service = AccessExpirationService(db, None)
    await service.delete_expiration(user_id)
