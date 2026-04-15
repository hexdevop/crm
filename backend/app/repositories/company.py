import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.repositories.base import BaseRepository


class CompanyRepository(BaseRepository[Company]):
    model = Company

    def __init__(self, db: AsyncSession):
        super().__init__(db, company_id=None)  # No tenant filter for companies

    async def get_by_slug(self, slug: str) -> Company | None:
        result = await self.db.execute(
            select(Company).where(Company.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_by_id_active(self, company_id: uuid.UUID) -> Company | None:
        result = await self.db.execute(
            select(Company).where(
                Company.id == company_id,
                Company.is_active == True,
            )
        )
        return result.scalar_one_or_none()
