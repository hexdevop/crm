import uuid
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity, EntityField
from app.repositories.base import BaseRepository


class EntityRepository(BaseRepository[Entity]):
    model = Entity

    async def get_by_slug(self, slug: str) -> Entity | None:
        q = select(Entity).where(Entity.slug == slug)
        # Apply company_id filter only if it's explicitly set (not for superadmins)
        if self.company_id is not None:
            q = q.where(Entity.company_id == self.company_id)
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def list_entities(self) -> list[Entity]:
        q = select(Entity)
        # Apply company_id filter only if it's explicitly set (not for superadmins)
        if self.company_id is not None:
            q = q.where(Entity.company_id == self.company_id)
        result = await self.db.execute(q.order_by(Entity.name))
        return list(result.scalars().all())

    # --- Field operations ---

    async def add_field(self, entity_id: uuid.UUID, **kwargs) -> EntityField:
        field = EntityField(entity_id=entity_id, **kwargs)
        self.db.add(field)
        await self.db.flush()
        await self.db.refresh(field)
        return field

    async def delete_all_fields(self, entity_id: uuid.UUID) -> None:
        await self.db.execute(
            delete(EntityField).where(EntityField.entity_id == entity_id)
        )
        await self.db.flush()

    async def get_field(
        self, entity_id: uuid.UUID, field_id: uuid.UUID
    ) -> EntityField | None:
        result = await self.db.execute(
            select(EntityField).where(
                EntityField.id == field_id,
                EntityField.entity_id == entity_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_field(self, field: EntityField, **kwargs) -> EntityField:
        for k, v in kwargs.items():
            if v is not None and hasattr(field, k):
                setattr(field, k, v)
        self.db.add(field)
        await self.db.flush()
        await self.db.refresh(field)
        return field

    async def delete_field(self, field: EntityField) -> None:
        await self.db.delete(field)
        await self.db.flush()

    async def reorder_fields(
        self, entity_id: uuid.UUID, ordered_ids: list[uuid.UUID]
    ) -> None:
        for pos, field_id in enumerate(ordered_ids):
            await self.db.execute(
                update(EntityField)
                .where(
                    EntityField.id == field_id,
                    EntityField.entity_id == entity_id,
                )
                .values(position=pos)
            )
        await self.db.flush()
