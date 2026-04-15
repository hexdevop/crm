import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.role import (
    PermissionResponse,
    RoleCreate,
    RolePermissionsUpdate,
    RoleResponse,
    RoleUpdate,
)
from app.services.role import RoleService

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=list[RoleResponse])
async def list_roles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = RoleService(db, current_user.company_id)
    roles = await service.list_roles()
    return [RoleResponse.from_orm(r) for r in roles]


@router.post("", response_model=RoleResponse, status_code=201)
async def create_role(
    data: RoleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_roles")),
):
    service = RoleService(db, current_user.company_id)
    role = await service.create_role(data)
    return RoleResponse.from_orm(role)


@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = RoleService(db, current_user.company_id)
    return await service.get_all_permissions()


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("read")),
):
    service = RoleService(db, current_user.company_id)
    role = await service.get_role(role_id)
    return RoleResponse.from_orm(role)


@router.patch("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: uuid.UUID,
    data: RoleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_roles")),
):
    service = RoleService(db, current_user.company_id)
    role = await service.update_role(role_id, data)
    return RoleResponse.from_orm(role)


@router.delete("/{role_id}", status_code=204)
async def delete_role(
    role_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_roles")),
):
    service = RoleService(db, current_user.company_id)
    await service.delete_role(role_id)


@router.put("/{role_id}/permissions", response_model=RoleResponse)
async def update_role_permissions(
    role_id: uuid.UUID,
    data: RolePermissionsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
    current_user=Depends(require_permission("manage_roles")),
):
    service = RoleService(db, current_user.company_id)
    role = await service.update_permissions(role_id, data, redis)
    return RoleResponse.from_orm(role)
