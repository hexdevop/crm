import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.schemas.entity import (
    EntityCreate,
    EntityFieldCreate,
    EntityFieldReorder,
    EntityFieldResponse,
    EntityFieldUpdate,
    EntityResponse,
    EntityUpdate,
)
from app.services.entity import EntityService

router = APIRouter(prefix="/entities", tags=["Entities"])


@router.get("", response_model=list[EntityResponse])
async def list_entities(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = EntityService(db, current_user.company_id)
    entities = await service.list_entities()
    result = []
    for e in entities:
        er = EntityResponse.model_validate(e)
        er.record_count = getattr(e, "_record_count", 0)
        result.append(er)
    return result


@router.post("", response_model=EntityResponse, status_code=201)
async def create_entity(
    data: EntityCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_entities")),
):
    service = EntityService(db, current_user.company_id)
    entity = await service.create_entity(data)
    return EntityResponse.model_validate(entity)


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(
    entity_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = EntityService(db, current_user.company_id)
    entity = await service.get_entity(entity_id)
    return EntityResponse.model_validate(entity)


@router.patch("/{entity_id}", response_model=EntityResponse)
async def update_entity(
    entity_id: uuid.UUID,
    data: EntityUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_entities")),
):
    service = EntityService(db, current_user.company_id)
    entity = await service.update_entity(entity_id, data)
    return EntityResponse.model_validate(entity)


@router.delete("/{entity_id}", status_code=204)
async def delete_entity(
    entity_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_entities")),
):
    service = EntityService(db, current_user.company_id)
    await service.delete_entity(entity_id)


# --- Field endpoints ---

@router.get("/{entity_id}/fields", response_model=list[EntityFieldResponse])
async def list_fields(
    entity_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = EntityService(db, current_user.company_id)
    entity = await service.get_entity(entity_id)
    return entity.fields


@router.post("/{entity_id}/fields", response_model=EntityFieldResponse, status_code=201)
async def add_field(
    entity_id: uuid.UUID,
    data: EntityFieldCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_entities")),
):
    service = EntityService(db, current_user.company_id)
    field = await service.add_field(entity_id, data)
    return EntityFieldResponse.model_validate(field)


@router.patch("/{entity_id}/fields/{field_id}", response_model=EntityFieldResponse)
async def update_field(
    entity_id: uuid.UUID,
    field_id: uuid.UUID,
    data: EntityFieldUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_entities")),
):
    service = EntityService(db, current_user.company_id)
    field = await service.update_field(entity_id, field_id, data)
    return EntityFieldResponse.model_validate(field)


@router.delete("/{entity_id}/fields/{field_id}", status_code=204)
async def delete_field(
    entity_id: uuid.UUID,
    field_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_entities")),
):
    service = EntityService(db, current_user.company_id)
    await service.delete_field(entity_id, field_id)


@router.put("/{entity_id}/fields/order", status_code=204)
async def reorder_fields(
    entity_id: uuid.UUID,
    data: EntityFieldReorder,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_entities")),
):
    service = EntityService(db, current_user.company_id)
    await service.reorder_fields(entity_id, data)
