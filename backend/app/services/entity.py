import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.repositories.entity import EntityRepository
from app.repositories.entity_record import EntityRecordRepository
from app.schemas.entity import EntityCreate, EntityUpdate, EntityFieldCreate, EntityFieldUpdate, EntityFieldReorder


class EntityService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.repo = EntityRepository(db, company_id)
        self.record_repo = EntityRecordRepository(db, company_id)

    async def list_entities(self):
        entities = await self.repo.list_entities()
        # Attach record counts
        result = []
        for entity in entities:
            count = await self.record_repo.count_by_entity(entity.id)
            entity_dict = entity
            entity._record_count = count
            result.append(entity)
        return result

    async def get_entity(self, entity_id: uuid.UUID):
        entity = await self.repo.get_by_id(entity_id)
        if not entity:
            raise NotFoundException("Entity")
        return entity

    async def create_entity(self, data: EntityCreate):
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictException(f"Entity with slug '{data.slug}' already exists")

        entity = await self.repo.create(
            company_id=self.company_id,
            name=data.name,
            slug=data.slug,
            description=data.description,
            icon=data.icon,
            color=data.color,
        )

        # Create fields
        for i, field_data in enumerate(data.fields):
            field_data.position = i
            await self._create_field_for_entity(entity.id, field_data)

        await self.db.commit()
        return await self.repo.get_by_id(entity.id)

    async def update_entity(self, entity_id: uuid.UUID, data: EntityUpdate):
        entity = await self.get_entity(entity_id)

        # Update metadata
        update_data = data.model_dump(exclude_none=True)
        fields_data = update_data.pop("fields", None)

        for k, v in update_data.items():
            setattr(entity, k, v)

        # Handle fields if provided
        if fields_data is not None:
            # Simple approach: remove all existing and recreate
            # Better approach: match by ID/slug, but here fields in EntityUpdate might not have IDs
            # Looking at frontend, it sends the full list of fields
            await self.repo.delete_all_fields(entity_id)
            for i, field_data in enumerate(fields_data):
                # Convert dict to EntityFieldCreate if it's a dict
                if isinstance(field_data, dict):
                    field_data = EntityFieldCreate(**field_data)
                field_data.position = i
                await self._create_field_for_entity(entity.id, field_data)

        await self.db.commit()
        return await self.repo.get_by_id(entity_id)

    async def delete_entity(self, entity_id: uuid.UUID) -> None:
        entity = await self.get_entity(entity_id)
        await self.repo.delete(entity)
        await self.db.commit()

    async def add_field(self, entity_id: uuid.UUID, data: EntityFieldCreate):
        entity = await self.get_entity(entity_id)
        field = await self._create_field_for_entity(entity.id, data)
        await self.db.commit()
        return field

    async def update_field(
        self,
        entity_id: uuid.UUID,
        field_id: uuid.UUID,
        data: EntityFieldUpdate,
    ):
        field = await self.repo.get_field(entity_id, field_id)
        if not field:
            raise NotFoundException("EntityField")
        update_data = data.model_dump(exclude_none=True)
        field = await self.repo.update_field(field, **update_data)
        await self.db.commit()
        return field

    async def delete_field(self, entity_id: uuid.UUID, field_id: uuid.UUID) -> None:
        field = await self.repo.get_field(entity_id, field_id)
        if not field:
            raise NotFoundException("EntityField")
        await self.repo.delete_field(field)
        await self.db.commit()

    async def reorder_fields(self, entity_id: uuid.UUID, data: EntityFieldReorder) -> None:
        await self.get_entity(entity_id)
        await self.repo.reorder_fields(entity_id, data.field_ids)
        await self.db.commit()

    async def _create_field_for_entity(self, entity_id: uuid.UUID, data: EntityFieldCreate):
        # Validate SELECT config
        if data.field_type == "select":
            if not data.config or "options" not in data.config:
                raise ValidationException(
                    "SELECT field requires config.options: [{value, label}]"
                )
        return await self.repo.add_field(
            entity_id=entity_id,
            name=data.name,
            slug=data.slug,
            field_type=data.field_type,
            is_required=data.is_required,
            is_searchable=data.is_searchable,
            position=data.position,
            config=data.config,
        )
