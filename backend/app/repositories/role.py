import uuid
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Permission, Role, RolePermission, UserRole
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository[Role]):
    model = Role

    async def get_all_permissions(self) -> list[Permission]:
        result = await self.db.execute(select(Permission).order_by(Permission.code))
        return list(result.scalars().all())

    async def get_permission_by_code(self, code: str) -> Permission | None:
        result = await self.db.execute(
            select(Permission).where(Permission.code == code)
        )
        return result.scalar_one_or_none()

    async def get_permissions_by_ids(
        self, permission_ids: list[uuid.UUID]
    ) -> list[Permission]:
        result = await self.db.execute(
            select(Permission).where(Permission.id.in_(permission_ids))
        )
        return list(result.scalars().all())

    async def get_by_id_with_permissions(self, role_id: uuid.UUID) -> Role | None:
        q = (
            select(Role)
            .options(
                selectinload(Role.role_permissions).selectinload(RolePermission.permission)
            )
            .where(Role.id == role_id)
        )
        # Apply company_id filter only if it's explicitly set (not for superadmins)
        if self.company_id is not None:
            q = q.where(Role.company_id == self.company_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def list_with_permissions(self) -> list[Role]:
        q = (
            select(Role)
            .options(
                selectinload(Role.role_permissions).selectinload(RolePermission.permission)
            )
        )
        # Apply company_id filter only if it's explicitly set (not for superadmins)
        if self.company_id is not None:
            q = q.where(Role.company_id == self.company_id)
        result = await self.db.execute(q.order_by(Role.name))
        return list(result.scalars().all())

    async def replace_permissions(
        self, role: Role, permissions: list[Permission]
    ) -> None:
        await self.db.execute(
            delete(RolePermission).where(RolePermission.role_id == role.id)
        )
        for perm in permissions:
            rp = RolePermission(role_id=role.id, permission_id=perm.id)
            self.db.add(rp)
        await self.db.flush()

    async def get_system_role(self, company_id: uuid.UUID, system_type: str) -> Role | None:
        result = await self.db.execute(
            select(Role).where(
                Role.company_id == company_id,
                Role.system_type == system_type,
                Role.is_system == True,
            )
        )
        return result.scalar_one_or_none()

    async def assign_role_to_user(
        self, user_id: uuid.UUID, role_id: uuid.UUID, assigned_by: uuid.UUID | None
    ) -> UserRole:
        ur = UserRole(user_id=user_id, role_id=role_id, assigned_by=assigned_by)
        self.db.add(ur)
        await self.db.flush()
        return ur

    async def remove_role_from_user(
        self, user_id: uuid.UUID, role_id: uuid.UUID
    ) -> bool:
        result = await self.db.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
            )
        )
        ur = result.scalar_one_or_none()
        if not ur:
            return False
        await self.db.delete(ur)
        await self.db.flush()
        return True
