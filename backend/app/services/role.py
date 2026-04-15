import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.repositories.role import RoleRepository
from app.schemas.role import RoleCreate, RoleUpdate, RolePermissionsUpdate


class RoleService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.repo = RoleRepository(db, company_id)

    async def list_roles(self):
        return await self.repo.list_with_permissions()

    async def get_role(self, role_id: uuid.UUID):
        role = await self.repo.get_by_id_with_permissions(role_id)
        if not role:
            raise NotFoundException("Role")
        return role

    async def create_role(self, data: RoleCreate):
        from app.models.role import Role
        from sqlalchemy import select

        # Check name uniqueness in company
        existing = await self.db.execute(
            __import__("sqlalchemy", fromlist=["select"]).select(Role).where(
                Role.company_id == self.company_id,
                Role.name == data.name,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictException(f"Role '{data.name}' already exists")

        role = await self.repo.create(
            company_id=self.company_id,
            name=data.name,
            description=data.description,
        )
        await self.db.commit()
        return await self.repo.get_by_id_with_permissions(role.id)

    async def update_role(self, role_id: uuid.UUID, data: RoleUpdate):
        role = await self.get_role(role_id)

        if data.name and data.name != role.name:
            from app.models.role import Role
            existing = await self.db.execute(
                __import__("sqlalchemy", fromlist=["select"]).select(Role).where(
                    Role.company_id == self.company_id,
                    Role.name == data.name,
                    Role.id != role_id,
                )
            )
            if existing.scalar_one_or_none():
                raise ConflictException(f"Role '{data.name}' already exists")

        for k, v in data.model_dump(exclude_none=True).items():
            setattr(role, k, v)

        await self.db.commit()
        return await self.repo.get_by_id_with_permissions(role_id)

    async def delete_role(self, role_id: uuid.UUID) -> None:
        role = await self.get_role(role_id)
        if role.is_system:
            raise ForbiddenException("Cannot delete system roles")
        await self.repo.delete(role)
        await self.db.commit()

    async def update_permissions(self, role_id: uuid.UUID, data: RolePermissionsUpdate, redis):
        role = await self.get_role(role_id)

        permissions = await self.repo.get_permissions_by_ids(data.permission_ids)
        if len(permissions) != len(data.permission_ids):
            raise NotFoundException("One or more permissions not found")

        await self.repo.replace_permissions(role, permissions)
        await self.db.commit()

        # Invalidate permission cache for all users with this role
        from app.models.role import UserRole
        from sqlalchemy import select
        result = await self.db.execute(
            select(UserRole.user_id).where(UserRole.role_id == role_id)
        )
        user_ids = result.scalars().all()
        for uid in user_ids:
            await redis.delete(f"perms:{uid}")

        return await self.repo.get_by_id_with_permissions(role_id)

    async def get_all_permissions(self):
        return await self.repo.get_all_permissions()
