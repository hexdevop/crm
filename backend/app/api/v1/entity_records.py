import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.core.pagination import PageParams, PaginatedResponse
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.entity_record import (
    EntityRecordCreate,
    EntityRecordResponse,
    EntityRecordUpdate,
)
from app.services.entity_record import EntityRecordService

router = APIRouter(prefix="/entities/{entity_id}/records", tags=["Records"])


@router.get("", response_model=PaginatedResponse[EntityRecordResponse])
async def list_records(
    entity_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    sort: str | None = Query(default=None),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    params = PageParams(page=page, size=size)
    service = EntityRecordService(db, current_user.company_id)
    records, total = await service.list_records(
        entity_id=entity_id,
        params=params,
        search=search,
        sort_field=sort,
        sort_order=order,
    )
    return PaginatedResponse.create(
        [EntityRecordResponse.model_validate(r) for r in records],
        total,
        params,
    )


@router.post("", response_model=EntityRecordResponse, status_code=201)
async def create_record(
    entity_id: uuid.UUID,
    data: EntityRecordCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
    current_user=Depends(require_permission("create")),
):
    service = EntityRecordService(db, current_user.company_id)
    record = await service.create_record(entity_id, data, current_user.id, redis)
    return EntityRecordResponse.model_validate(record)


@router.get("/{record_id}", response_model=EntityRecordResponse)
async def get_record(
    entity_id: uuid.UUID,
    record_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = EntityRecordService(db, current_user.company_id)
    record = await service.get_record(entity_id, record_id)
    return EntityRecordResponse.model_validate(record)


@router.patch("/{record_id}", response_model=EntityRecordResponse)
async def update_record(
    entity_id: uuid.UUID,
    record_id: uuid.UUID,
    data: EntityRecordUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
    current_user=Depends(require_permission("update")),
):
    service = EntityRecordService(db, current_user.company_id)
    record = await service.update_record(entity_id, record_id, data, redis)
    return EntityRecordResponse.model_validate(record)


@router.delete("/{record_id}", status_code=204)
async def delete_record(
    entity_id: uuid.UUID,
    record_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("delete")),
):
    service = EntityRecordService(db, current_user.company_id)
    await service.delete_record(entity_id, record_id)
