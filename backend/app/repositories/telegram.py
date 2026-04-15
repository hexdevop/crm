import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram import TelegramSettings
from app.repositories.base import BaseRepository


class TelegramRepository(BaseRepository[TelegramSettings]):
    model = TelegramSettings

    async def get_by_company(self, company_id: uuid.UUID) -> TelegramSettings | None:
        result = await self.db.execute(
            select(TelegramSettings).where(TelegramSettings.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, company_id: uuid.UUID) -> TelegramSettings:
        settings = await self.get_by_company(company_id)
        if not settings:
            settings = TelegramSettings(company_id=company_id)
            self.db.add(settings)
            await self.db.flush()
            await self.db.refresh(settings)
        return settings
