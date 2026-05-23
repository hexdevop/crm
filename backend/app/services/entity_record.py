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

        enriched = await self._assign_autoincrement_values(data.data, entity.fields)
        validated_data = self._validate_record_data(enriched, entity.fields)
        validated_data = self._compute_formula_fields(validated_data, entity.fields)

        record = await self.repo.create(
            entity_id=entity_id,
            company_id=self.company_id,
            created_by=created_by,
            data=validated_data,
        )
        await self.db.commit()

        if redis:
            await self._publish_notification(redis, "record_created", {
                "entity_name": entity.name,
                "record_id": str(record.id),
                "company_id": str(self.company_id),
                "fields_data": self._format_fields_for_notification(record.data, entity.fields),
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
        old_data = dict(record.data)
        validated_data = self._validate_record_data(data.data, entity.fields, partial=True)
        validated_data = self._compute_formula_fields({**record.data, **validated_data}, entity.fields)

        changes = self._compute_changes(old_data, validated_data, entity.fields)

        merged = {**record.data, **validated_data}
        record.data = merged
        await self.db.commit()
        await self.db.refresh(record)

        if redis:
            await self._publish_notification(redis, "record_updated", {
                "entity_name": entity.name,
                "record_id": str(record.id),
                "company_id": str(self.company_id),
                "changes": changes,
            })

        return record

    async def delete_record(self, entity_id: uuid.UUID, record_id: uuid.UUID, redis=None) -> None:
        entity = await self.entity_repo.get_by_id(entity_id)
        record = await self.get_record(entity_id, record_id)
        fields_data = self._format_fields_for_notification(record.data, entity.fields if entity else [])
        await self.repo.delete(record)
        await self.db.commit()

        if redis and entity:
            await self._publish_notification(redis, "record_deleted", {
                "entity_name": entity.name,
                "record_id": str(record.id),
                "company_id": str(self.company_id),
                "fields_data": fields_data,
            })

    async def _assign_autoincrement_values(
        self,
        data: dict[str, Any],
        fields: list[EntityField],
    ) -> dict[str, Any]:
        from sqlalchemy import update as sa_update
        from app.models.entity import EntityField as EF

        result = dict(data)
        for field in fields:
            if field.field_type != FieldType.autoincrement:
                continue
            config = field.config or {}
            prefix = str(config.get("prefix", ""))
            next_val = int(config.get("next_value", 1))
            padding = int(config.get("padding", 6))
            result[field.slug] = f"{prefix}{str(next_val).zfill(padding)}"
            new_config = {**config, "next_value": next_val + 1}
            await self.db.execute(
                sa_update(EF).where(EF.id == field.id).values(config=new_config)
            )
        return result

    def _compute_formula_fields(
        self,
        data: dict[str, Any],
        fields: list[EntityField],
    ) -> dict[str, Any]:
        result = dict(data)
        for field in fields:
            if field.field_type != FieldType.formula:
                continue
            config = field.config or {}
            expr = str(config.get("formula", "")).strip()
            if expr:
                try:
                    val = self._eval_formula(expr, result)
                    if val is None:
                        result[field.slug] = None
                    else:
                        prefix = str(config.get("prefix", ""))
                        suffix = str(config.get("suffix", ""))
                        if prefix or suffix:
                            # Format: remove trailing zeros (e.g. 1.0 → "1", 1.5 → "1.5")
                            formatted = f"{val:g}"
                            result[field.slug] = f"{prefix}{formatted}{suffix}"
                        else:
                            result[field.slug] = val
                except Exception:
                    result[field.slug] = None
        return result

    def _eval_formula(self, expr: str, data: dict[str, Any]) -> float | None:
        import re
        # Build numeric context from data
        ctx: dict[str, float] = {}
        for slug, value in data.items():
            if isinstance(value, (int, float)):
                ctx[slug] = float(value)
            elif isinstance(value, dict) and "value" in value:
                try:
                    ctx[slug] = float(value["value"])
                except (TypeError, ValueError):
                    ctx[slug] = 0.0
            elif isinstance(value, str):
                try:
                    ctx[slug] = float(value)
                except (TypeError, ValueError):
                    ctx[slug] = 0.0
            else:
                ctx[slug] = 0.0

        # Allow only safe characters
        if re.search(r"[^0-9a-zа-яё_\s\+\-\*\/\.\(\)]", expr, re.IGNORECASE):
            return None
        try:
            val = eval(expr, {"__builtins__": {}}, ctx)  # noqa: S307
            return round(float(val), 10)
        except Exception:
            return None

    def _validate_record_data(
        self,
        data: dict[str, Any],
        fields: list[EntityField],
        partial: bool = False,
    ) -> dict[str, Any]:
        field_map = {f.slug: f for f in fields}
        validated: dict[str, Any] = {}

        for field in fields:
            # Server-generated fields: pass through as-is
            if field.field_type in (FieldType.autoincrement, FieldType.formula):
                if field.slug in data:
                    validated[field.slug] = data[field.slug]
                continue

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

        if ft == FieldType.text or ft == FieldType.phone:
            if not isinstance(value, str):
                raise ValidationException(f"Field '{field.name}' must be text")
            return str(value)

        if ft == FieldType.email:
            import re
            if not isinstance(value, str) or not re.match(
                r"^[^\s@]+@[^\s@]+\.[^\s@]+$", value
            ):
                raise ValidationException(f"Field '{field.name}' must be a valid email")
            return value.lower()

        if ft == FieldType.number:
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

        if ft == FieldType.boolean:
            if not isinstance(value, bool):
                if isinstance(value, str):
                    return value.lower() in ("true", "1", "yes")
                raise ValidationException(f"Field '{field.name}' must be boolean")
            return value

        if ft == FieldType.date:
            if isinstance(value, str):
                try:
                    date.fromisoformat(value)
                    return value
                except ValueError:
                    raise ValidationException(
                        f"Field '{field.name}' must be date (YYYY-MM-DD)"
                    )
            return str(value)

        if ft == FieldType.select:
            config = field.config or {}
            options = [opt["value"] for opt in config.get("options", [])]
            if value not in options:
                raise ValidationException(
                    f"Field '{field.name}' must be one of: {', '.join(options)}"
                )
            return value

        if ft == FieldType.status:
            config = field.config or {}
            options = [opt["value"] for opt in config.get("options", [])]
            if options and value not in options:
                raise ValidationException(
                    f"Field '{field.name}' must be one of: {', '.join(options)}"
                )
            return str(value)

        if ft == FieldType.price:
            try:
                return round(float(value), 2)
            except (TypeError, ValueError):
                raise ValidationException(f"Field '{field.name}' must be a number")

        if ft == FieldType.warehouse_location:
            return str(value)

        if ft in (FieldType.image, FieldType.file):
            if not isinstance(value, str):
                raise ValidationException(f"Field '{field.name}' must be a URL string")
            return value

        return value

    def _format_value_for_notification(self, field: EntityField, value: Any) -> str:
        if value is None:
            return "—"
        ft = field.field_type
        if ft in (FieldType.image, FieldType.file):
            return "📎"
        if ft == FieldType.boolean:
            return "Да" if value else "Нет"
        if ft == FieldType.quantity_unit:
            if isinstance(value, dict):
                return f"{value.get('value', '')} {value.get('unit', '')}".strip()
            return str(value)
        if ft in (FieldType.select, FieldType.status):
            config = field.config or {}
            opts = {o["value"]: o["label"] for o in config.get("options", [])}
            return opts.get(str(value), str(value))
        if ft == FieldType.price:
            try:
                config = field.config or {}
                symbol = config.get("symbol", "")
                decimals = int(config.get("decimals", 2))
                return f"{float(value):,.{decimals}f} {symbol}".strip()
            except (TypeError, ValueError):
                return str(value)
        if ft == FieldType.number:
            try:
                return f"{float(value):g}"
            except (TypeError, ValueError):
                return str(value)
        if ft == FieldType.relation:
            return f"🔗 {str(value)[:8]}…"
        return str(value)

    def _format_fields_for_notification(
        self, data: dict[str, Any], fields: list[EntityField]
    ) -> dict[str, str]:
        skip = {FieldType.image, FieldType.file}
        result: dict[str, str] = {}
        for field in fields:
            if field.field_type in skip:
                continue
            value = data.get(field.slug)
            if value is None or value == "":
                continue
            result[field.name] = self._format_value_for_notification(field, value)
        return result

    def _compute_changes(
        self, old_data: dict[str, Any], new_data: dict[str, Any], fields: list[EntityField]
    ) -> dict[str, dict[str, str]]:
        field_map = {f.slug: f for f in fields}
        changes: dict[str, dict[str, str]] = {}
        for slug, new_val in new_data.items():
            old_val = old_data.get(slug)
            if old_val == new_val or slug not in field_map:
                continue
            field = field_map[slug]
            old_str = self._format_value_for_notification(field, old_val)
            new_str = self._format_value_for_notification(field, new_val)
            if old_str != new_str:
                changes[field.name] = {"old": old_str, "new": new_str}
        return changes

    async def _publish_notification(
        self, redis, event_type: str, payload: dict
    ) -> None:
        import json
        from app.repositories.telegram import TelegramRepository
        tg = await TelegramRepository(self.db).get_by_company(self.company_id)
        if tg:
            if not tg.is_enabled:
                return
            if not tg.notification_events.get(event_type, True):
                return
        channel = f"notifications:{payload['company_id']}"
        message = json.dumps({"event": event_type, **payload})
        await redis.publish(channel, message)
