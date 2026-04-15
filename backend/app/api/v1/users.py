import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.core.pagination import PageParams, PaginatedResponse
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.common import MessageResponse
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserPasswordChange
from app.schemas.role import UserRoleAssign
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
):
    params = PageParams(page=page, size=size)
    service = UserService(db, current_user.company_id)
    users, total = await service.list_users(
        offset=params.offset,
        limit=params.size,
        search=search,
        is_active=is_active,
    )
    items = [UserResponse.from_orm_with_roles(u) for u in users]
    return PaginatedResponse.create(items, total, params)


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = UserService(db, current_user.company_id)
    user = await service.create_user(data)
    return UserResponse.from_orm_with_roles(user)


@router.get("/me", response_model=UserResponse)
async def get_own_profile(
    current_user=Depends(get_current_user),
):
    return UserResponse.from_orm_with_roles(current_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    # Own profile or manage_users
    if current_user.id != user_id:
        await require_permission("manage_users")(current_user)
    service = UserService(db, current_user.company_id)
    user = await service.get_user(user_id)
    return UserResponse.from_orm_with_roles(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    service = UserService(db, current_user.company_id)
    user = await service.update_user(user_id, data, current_user.id)
    return UserResponse.from_orm_with_roles(user)


@router.post("/{user_id}/change-password", response_model=MessageResponse)
async def change_password(
    user_id: uuid.UUID,
    data: UserPasswordChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    from app.core.exceptions import ForbiddenException
    if current_user.id != user_id:
        raise ForbiddenException("Can only change your own password")
    service = UserService(db, current_user.company_id)
    await service.change_password(user_id, data, current_user.id)
    return MessageResponse(message="Password changed successfully")


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = UserService(db, current_user.company_id)
    await service.delete_user(user_id, current_user.id)


@router.post("/{user_id}/activate", response_model=MessageResponse)
async def activate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = UserService(db, current_user.company_id)
    await service.activate_user(user_id)
    return MessageResponse(message="User activated")


@router.post("/{user_id}/deactivate", response_model=MessageResponse)
async def deactivate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    service = UserService(db, current_user.company_id)
    await service.deactivate_user(user_id, current_user.id)
    return MessageResponse(message="User deactivated")


@router.post("/{user_id}/roles", response_model=MessageResponse)
async def assign_role(
    user_id: uuid.UUID,
    data: UserRoleAssign,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
    current_user=Depends(require_permission("manage_roles")),
):
    service = UserService(db, current_user.company_id)
    await service.assign_role(user_id, data.role_id, current_user.id, redis)
    return MessageResponse(message="Role assigned")


@router.delete("/{user_id}/roles/{role_id}", response_model=MessageResponse)
async def remove_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
    current_user=Depends(require_permission("manage_roles")),
):
    service = UserService(db, current_user.company_id)
    await service.remove_role(user_id, role_id, redis)
    return MessageResponse(message="Role removed")
