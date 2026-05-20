import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.core.pagination import PageParams, PaginatedResponse
from app.database import get_db
from app.schemas.common import MessageResponse
from app.schemas.movement import MovementCreate, MovementResponse, MovementBalance
from app.services.movement import MovementService

router = APIRouter(prefix="/movements", tags=["Movements"])


@router.post(
    "/entities/{entity_id}/records/{record_id}",
    response_model=MovementResponse,
    status_code=201,
)
async def create_movement(
    entity_id: uuid.UUID,
    record_id: uuid.UUID,
    data: MovementCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("create")),
):
    service = MovementService(db, current_user.company_id)
    movement = await service.create_movement(entity_id, record_id, data, current_user.id)
    return MovementResponse.model_validate(movement)


@router.get(
    "/entities/{entity_id}/records/{record_id}",
    response_model=list[MovementResponse],
)
async def list_record_movements(
    entity_id: uuid.UUID,
    record_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    service = MovementService(db, current_user.company_id)
    movements = await service.list_by_record(record_id, limit=limit, offset=offset)
    return [MovementResponse.model_validate(m) for m in movements]


@router.get(
    "/entities/{entity_id}/records/{record_id}/balance",
    response_model=MovementBalance,
)
async def get_record_balance(
    entity_id: uuid.UUID,
    record_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = MovementService(db, current_user.company_id)
    return await service.get_balance(record_id)


@router.get(
    "/entities/{entity_id}",
    response_model=PaginatedResponse[MovementResponse],
)
async def list_entity_movements(
    entity_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
):
    params = PageParams(page=page, size=size)
    service = MovementService(db, current_user.company_id)
    movements, total = await service.list_by_entity(entity_id, page=page, size=size)
    items = [MovementResponse.model_validate(m) for m in movements]
    return PaginatedResponse.create(items, total, params)


@router.delete("/{movement_id}", response_model=MessageResponse)
async def delete_movement(
    movement_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("delete")),
):
    service = MovementService(db, current_user.company_id)
    await service.delete_movement(movement_id, current_user.id)
    return MessageResponse(message="Movement deleted")
