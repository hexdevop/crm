import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.access_expiration import AccessExpiration
from app.models.user import User
from app.repositories.base import BaseRepository


class AccessExpirationRepository(BaseRepository[AccessExpiration]):
    model = AccessExpiration

    async def get_by_user(self, user_id: uuid.UUID) -> AccessExpiration | None:
        q = select(AccessExpiration).where(AccessExpiration.user_id == user_id)
        if self.company_id:
            q = q.where(AccessExpiration.company_id == self.company_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def get_expired_active_users(self) -> list[AccessExpiration]:
        """All expirations that have passed and user is still active."""
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(AccessExpiration)
            .options(selectinload(AccessExpiration.user))
            .join(User, User.id == AccessExpiration.user_id)
            .where(
                AccessExpiration.expires_at <= now,
                User.is_active == True,
                AccessExpiration.was_auto_blocked == False,
            )
        )
        return list(result.scalars().all())

    async def get_expiring_soon(self, hours: int = 24) -> list[AccessExpiration]:
        """Expirations within the next N hours, not yet notified."""
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        soon = now + timedelta(hours=hours)
        result = await self.db.execute(
            select(AccessExpiration)
            .options(selectinload(AccessExpiration.user))
            .where(
                AccessExpiration.expires_at > now,
                AccessExpiration.expires_at <= soon,
                AccessExpiration.is_notified == False,
            )
        )
        return list(result.scalars().all())
