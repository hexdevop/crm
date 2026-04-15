import uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.role import UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_by_id_with_roles(self, user_id: uuid.UUID) -> User | None:
        q = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.id == user_id)
        )
        # Apply company_id filter only if it's explicitly set (not for superadmins)
        if self.company_id is not None:
            q = q.where(User.company_id == self.company_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def list_with_roles(
        self,
        offset: int = 0,
        limit: int = 25,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[User], int]:
        from sqlalchemy import func, or_

        q = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
        )
        # Apply company_id filter only if it's explicitly set (not for superadmins)
        if self.company_id is not None:
            q = q.where(User.company_id == self.company_id)
        if search:
            q = q.where(
                or_(
                    User.first_name.ilike(f"%{search}%"),
                    User.last_name.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                )
            )
        if is_active is not None:
            q = q.where(User.is_active == is_active)

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        rows = (await self.db.execute(q.offset(offset).limit(limit))).scalars().all()
        return list(rows), total
