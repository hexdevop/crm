import uuid
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.core.pagination import PageParams
from app.models.entity import EntityField, FieldType
from app.repositories.entity import EntityRepository
from app.repositories.entity_record import EntityRecordRepository
from app.schemas.entity_record import EntityRecordCreate, EntityRecordUpdate


class EntityRecordService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.repo = EntityRecordRepository(db, company_id)
        self.entity_repo = EntityRepository(db, company_id)

    async def list_records(
        self,
        entity_id: uuid.UUID,
        params: PageParams,
        search: str | None = None,
        filters: dict[str, Any] | None = None,
        sort_field: str | None = None,
        sort_order: str = "desc",
    ):
        entity = await self.entity_repo.get_by_id(entity_id)
        if not entity:
            raise NotFoundException("Entity")

        records, total = await self.repo.list_records(
            entity_id=entity_id,
            offset=params.offset,
            limit=params.size,
            search=search,
            filters=filters,
            sort_field=sort_field,
            sort_order=sort_order,
        )
        return records, total

    async def get_record(self, entity_id: uuid.UUID, record_id: uuid.UUID):
        record = await self.repo.get_record(entity_id, record_id)
        if not record:
            raise NotFoundException("Record")
        return record

    async def create_record(
        self,
        entity_id: uuid.UUID,
        data: EntityRecordCreate,
        created_by: uuid.UUID,
        redis=None,
    ):
        entity = await self.entity_repo.get_by_id(entity_id)
        if not entity:
            raise NotFoundException("Entity")

        validated_data = self._validate_record_data(data.data, entity.fields)

        record = await self.repo.create(
            entity_id=entity_id,
            company_id=self.company_id,
            created_by=created_by,
            data=validated_data,
        )
        await self.db.commit()

        # Publish notification
        if redis:
            await self._publish_notification(redis, "record_created", {
                "entity_name": entity.name,
                "record_id": str(record.id),
                "company_id": str(self.company_id),
            })

        return record

    async def update_record(
        self,
        entity_id: uuid.UUID,
        record_id: uuid.UUID,
        data: EntityRecordUpdate,
        redis=None,
    ):
        entity = await self.entity_repo.get_by_id(entity_id)
        if not entity:
            raise NotFoundException("Entity")

        record = await self.get_record(entity_id, record_id)
        validated_data = self._validate_record_data(data.data, entity.fields, partial=True)

        # Merge with existing data
        merged = {**record.data, **validated_data}
        record.data = merged
        await self.db.commit()

        if redis:
            await self._publish_notification(redis, "record_updated", {
                "entity_name": entity.name,
                "record_id": str(record.id),
                "company_id": str(self.company_id),
            })

        return record

    async def delete_record(self, entity_id: uuid.UUID, record_id: uuid.UUID) -> None:
        record = await self.get_record(entity_id, record_id)
        await self.repo.delete(record)
        await self.db.commit()

    def _validate_record_data(
        self,
        data: dict[str, Any],
        fields: list[EntityField],
        partial: bool = False,
    ) -> dict[str, Any]:
        field_map = {f.slug: f for f in fields}
        validated: dict[str, Any] = {}

        for field in fields:
            value = data.get(field.slug)

            if field.is_required and not partial and value is None:
                raise ValidationException(f"Field '{field.name}' is required")

            if value is None:
                continue

            validated[field.slug] = self._coerce_value(field, value)

        # Warn about unknown fields (silently strip them)
        for key in data:
            if key not in field_map:
                pass  # Unknown field, ignored

        return validated

    def _coerce_value(self, field: EntityField, value: Any) -> Any:
        ft = field.field_type

        if ft == FieldType.TEXT or ft == FieldType.PHONE:
            if not isinstance(value, str):
                raise ValidationException(f"Field '{field.name}' must be text")
            return str(value)

        if ft == FieldType.EMAIL:
            import re
            if not isinstance(value, str) or not re.match(
                r"^[^\s@]+@[^\s@]+\.[^\s@]+$", value
            ):
                raise ValidationException(f"Field '{field.name}' must be a valid email")
            return value.lower()

        if ft == FieldType.NUMBER:
            try:
                num = float(value)
            except (TypeError, ValueError):
                raise ValidationException(f"Field '{field.name}' must be a number")
            config = field.config or {}
            if "min" in config and num < config["min"]:
                raise ValidationException(
                    f"Field '{field.name}' must be >= {config['min']}"
                )
            if "max" in config and num > config["max"]:
                raise ValidationException(
                    f"Field '{field.name}' must be <= {config['max']}"
                )
            return num

        if ft == FieldType.BOOLEAN:
            if not isinstance(value, bool):
                if isinstance(value, str):
                    return value.lower() in ("true", "1", "yes")
                raise ValidationException(f"Field '{field.name}' must be boolean")
            return value

        if ft == FieldType.DATE:
            if isinstance(value, str):
                try:
                    date.fromisoformat(value)
                    return value
                except ValueError:
                    raise ValidationException(
                        f"Field '{field.name}' must be date (YYYY-MM-DD)"
                    )
            return str(value)

        if ft == FieldType.SELECT:
            config = field.config or {}
            options = [opt["value"] for opt in config.get("options", [])]
            if value not in options:
                raise ValidationException(
                    f"Field '{field.name}' must be one of: {', '.join(options)}"
                )
            return value

        return value

    async def _publish_notification(
        self, redis, event_type: str, payload: dict
    ) -> None:
        import json
        channel = f"notifications:{payload['company_id']}"
        message = json.dumps({"event": event_type, **payload})
        await redis.publish(channel, message)
