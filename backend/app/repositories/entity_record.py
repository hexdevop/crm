import uuid
from typing import Any

from sqlalchemy import func, select, cast, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity_record import EntityRecord
from app.repositories.base import BaseRepository


class EntityRecordRepository(BaseRepository[EntityRecord]):
    model = EntityRecord

    async def list_records(
        self,
        entity_id: uuid.UUID,
        offset: int = 0,
        limit: int = 25,
        search: str | None = None,
        filters: dict[str, Any] | None = None,
        sort_field: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[EntityRecord], int]:
        q = select(EntityRecord).where(EntityRecord.entity_id == entity_id)

        if self.company_id:
            q = q.where(EntityRecord.company_id == self.company_id)

        if search:
            # Full-text search on all text values in JSONB
            q = q.where(
                cast(EntityRecord.data, String).ilike(f"%{search}%")
            )

        if filters:
            for field_slug, value in filters.items():
                if value is not None:
                    q = q.where(
                        EntityRecord.data[field_slug].astext == str(value)
                    )

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        if sort_field:
            col = EntityRecord.data[sort_field].astext
            q = q.order_by(col.desc() if sort_order == "desc" else col.asc())
        else:
            order_col = EntityRecord.created_at
            q = q.order_by(
                order_col.desc() if sort_order == "desc" else order_col.asc()
            )

        rows = (await self.db.execute(q.offset(offset).limit(limit))).scalars().all()
        return list(rows), total

    async def get_record(
        self, entity_id: uuid.UUID, record_id: uuid.UUID
    ) -> EntityRecord | None:
        q = select(EntityRecord).where(
            EntityRecord.id == record_id,
            EntityRecord.entity_id == entity_id,
        )
        if self.company_id:
            q = q.where(EntityRecord.company_id == self.company_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def count_by_entity(self, entity_id: uuid.UUID) -> int:
        q = select(func.count()).where(EntityRecord.entity_id == entity_id)
        if self.company_id:
            q = q.where(EntityRecord.company_id == self.company_id)
        return (await self.db.execute(q)).scalar_one()
