import uuid
from typing import Any, Generic, Type, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Generic async repository with mandatory company_id filtering.
    Subclasses must set `model` class variable.
    """

    model: Type[ModelType]

    def __init__(self, db: AsyncSession, company_id: uuid.UUID | None = None):
        self.db = db
        self.company_id = company_id

    def _base_query(self):
        """Returns select with company_id filter applied if set."""
        q = select(self.model)
        # Apply company_id filter ONLY if it's explicitly provided.
        # This allows Superadmin (where company_id is None) to bypass filtering.
        if self.company_id is not None and hasattr(self.model, "company_id"):
            q = q.where(self.model.company_id == self.company_id)
        return q

    async def get_by_id(self, record_id: uuid.UUID) -> ModelType | None:
        q = self._base_query().where(self.model.id == record_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def list_all(
        self,
        offset: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[ModelType], int]:
        q = self._base_query()
        for field, value in filters.items():
            if value is not None and hasattr(self.model, field):
                q = q.where(getattr(self.model, field) == value)

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        q = q.offset(offset).limit(limit)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def create(self, **kwargs: Any) -> ModelType:
        if self.company_id is not None and hasattr(self.model, "company_id"):
            kwargs.setdefault("company_id", self.company_id)
        obj = self.model(**kwargs)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: ModelType, **kwargs: Any) -> ModelType:
        for key, value in kwargs.items():
            if value is not None and hasattr(obj, key):
                setattr(obj, key, value)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: ModelType) -> None:
        await self.db.delete(obj)
        await self.db.flush()
