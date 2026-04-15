import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException, ForbiddenException
from app.core.security import hash_password, verify_password
from app.repositories.user import UserRepository
from app.repositories.role import RoleRepository
from app.schemas.user import UserCreate, UserUpdate, UserPasswordChange


class UserService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.repo = UserRepository(db, company_id)
        self.role_repo = RoleRepository(db, company_id)

    async def list_users(
        self,
        offset: int = 0,
        limit: int = 25,
        search: str | None = None,
        is_active: bool | None = None,
    ):
        return await self.repo.list_with_roles(
            offset=offset, limit=limit, search=search, is_active=is_active
        )

    async def get_user(self, user_id: uuid.UUID):
        user = await self.repo.get_by_id_with_roles(user_id)
        if not user:
            raise NotFoundException("User")
        return user

    async def create_user(self, data: UserCreate):
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictException("Email already registered")

        user = await self.repo.create(
            company_id=self.company_id,
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
        )
        await self.db.commit()
        return await self.repo.get_by_id_with_roles(user.id)

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate, current_user_id: uuid.UUID):
        user = await self.get_user(user_id)

        update_data = data.model_dump(exclude_none=True)

        if "email" in update_data and update_data["email"] != user.email:
            existing = await self.repo.get_by_email(update_data["email"])
            if existing:
                raise ConflictException("Email already in use")
            update_data["email"] = update_data["email"].lower()

        for k, v in update_data.items():
            setattr(user, k, v)

        await self.db.commit()
        return await self.repo.get_by_id_with_roles(user_id)

    async def change_password(
        self, user_id: uuid.UUID, data: UserPasswordChange, current_user_id: uuid.UUID
    ) -> None:
        user = await self.get_user(user_id)

        if not verify_password(data.current_password, user.hashed_password):
            raise ForbiddenException("Current password is incorrect")

        user.hashed_password = hash_password(data.new_password)
        await self.db.commit()

    async def activate_user(self, user_id: uuid.UUID) -> None:
        user = await self.get_user(user_id)
        user.is_active = True
        await self.db.commit()

    async def deactivate_user(self, user_id: uuid.UUID, current_user_id: uuid.UUID) -> None:
        if user_id == current_user_id:
            raise ForbiddenException("Cannot deactivate your own account")
        user = await self.get_user(user_id)
        user.is_active = False
        await self.db.commit()

    async def delete_user(self, user_id: uuid.UUID, current_user_id: uuid.UUID) -> None:
        if user_id == current_user_id:
            raise ForbiddenException("Cannot delete your own account")
        user = await self.get_user(user_id)
        await self.repo.delete(user)
        await self.db.commit()

    async def assign_role(
        self,
        user_id: uuid.UUID,
        role_id: uuid.UUID,
        assigned_by: uuid.UUID,
        redis,
    ) -> None:
        user = await self.get_user(user_id)

        # Get role without company filter if superadmin is performing the action
        # but the role must still belong to some company or be system-wide
        role = await self.role_repo.get_by_id_with_permissions(role_id)
        if not role:
            raise NotFoundException("Role")

        # Validation: Role must belong to the same company as the user
        # unless it's a superadmin managed situation where user might not have a company
        if user.company_id and str(role.company_id) != str(user.company_id):
            raise ForbiddenException("Role does not belong to the user's company")

        # Check if already assigned
        existing_role_ids = {str(ur.role_id) for ur in user.user_roles}
        if str(role_id) in existing_role_ids:
            raise ConflictException("Role already assigned")

        await self.role_repo.assign_role_to_user(user_id, role_id, assigned_by)
        await self.db.commit()

        # Invalidate permission cache
        from app.core.dependencies import invalidate_user_permissions_cache
        await invalidate_user_permissions_cache(user_id, redis)

    async def remove_role(
        self, user_id: uuid.UUID, role_id: uuid.UUID, redis
    ) -> None:
        removed = await self.role_repo.remove_role_from_user(user_id, role_id)
        if not removed:
            raise NotFoundException("UserRole")
        await self.db.commit()

        from app.core.dependencies import invalidate_user_permissions_cache
        await invalidate_user_permissions_cache(user_id, redis)
