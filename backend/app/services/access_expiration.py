import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException
from app.repositories.access_expiration import AccessExpirationRepository
from app.repositories.user import UserRepository
from app.schemas.access_expiration import AccessExpirationCreate, AccessExpirationUpdate


class AccessExpirationService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.repo = AccessExpirationRepository(db, company_id)
        self.user_repo = UserRepository(db, company_id)

    async def list_expirations(self):
        _, total = await self.repo.list_all()
        items, _ = await self.repo.list_all(limit=1000)
        return items, total

    async def get_expiration(self, user_id: uuid.UUID):
        exp = await self.repo.get_by_user(user_id)
        if not exp:
            raise NotFoundException("AccessExpiration")
        return exp

    async def set_expiration(self, data: AccessExpirationCreate):
        user = await self.user_repo.get_by_id_with_roles(data.user_id)
        if not user:
            raise NotFoundException("User")

        existing = await self.repo.get_by_user(data.user_id)
        if existing:
            raise ConflictException("User already has an expiration set. Use PATCH to update.")

        # Use the target user's company_id, not the caller's (caller may be superadmin with None)
        company_id = user.company_id if user.company_id else self.company_id
        exp = await self.repo.create(
            user_id=data.user_id,
            company_id=company_id,
            expires_at=data.expires_at,
        )
        await self.db.commit()
        return exp

    async def update_expiration(self, user_id: uuid.UUID, data: AccessExpirationUpdate):
        exp = await self.repo.get_by_user(user_id)
        if not exp:
            raise NotFoundException("AccessExpiration")

        exp.expires_at = data.expires_at
        exp.is_notified = False
        exp.was_auto_blocked = False
        await self.db.commit()
        return exp

    async def delete_expiration(self, user_id: uuid.UUID) -> None:
        exp = await self.repo.get_by_user(user_id)
        if not exp:
            raise NotFoundException("AccessExpiration")
        await self.repo.delete(exp)
        await self.db.commit()

    async def run_expiration_check(self, redis) -> int:
        """
        Disable users whose access has expired.
        Returns count of blocked users.
        """
        expired = await self.repo.get_expired_active_users()
        blocked_count = 0

        for exp_record in expired:
            user = exp_record.user
            if user and user.is_active:
                user.is_active = False
                exp_record.was_auto_blocked = True

                # Invalidate permission cache
                await redis.delete(f"perms:{user.id}")

                # Notify via Telegram
                try:
                    from app.services.telegram import TelegramService
                    tg_service = TelegramService(self.db, user.company_id)
                    await tg_service.send_notification(
                        redis,
                        "access_expired",
                        user.company_id,
                        f"Access expired for user {user.full_name} ({user.email})",
                    )
                except Exception:
                    pass

                blocked_count += 1

        if blocked_count > 0:
            await self.db.commit()

        return blocked_count
