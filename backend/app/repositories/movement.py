import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movement import Movement, MovementType


class MovementRepository:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id

    async def create(
        self,
        entity_id: uuid.UUID,
        record_id: uuid.UUID,
        movement_type: MovementType,
        quantity: float,
        unit: str | None,
        notes: str | None,
        reference_number: str | None,
        performed_by: uuid.UUID | None,
        performed_at: datetime | None,
    ) -> Movement:
        m = Movement(
            company_id=self.company_id,
            entity_id=entity_id,
            record_id=record_id,
            movement_type=movement_type,
            quantity=float(quantity),
            unit=unit,
            notes=notes,
            reference_number=reference_number,
            performed_by=performed_by,
            performed_at=performed_at or datetime.now(timezone.utc),
        )
        self.db.add(m)
        await self.db.flush()
        return m

    async def list_by_record(
        self, record_id: uuid.UUID, limit: int = 100, offset: int = 0
    ) -> list[Movement]:
        result = await self.db.execute(
            select(Movement)
            .where(
                Movement.company_id == self.company_id,
                Movement.record_id == record_id,
            )
            .order_by(Movement.performed_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def list_by_entity(
        self, entity_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> tuple[list[Movement], int]:
        q = select(Movement).where(
            Movement.company_id == self.company_id,
            Movement.entity_id == entity_id,
        )
        total_result = await self.db.execute(
            select(func.count()).select_from(q.subquery())
        )
        total = total_result.scalar_one()
        result = await self.db.execute(
            q.order_by(Movement.performed_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total

    async def get_balance(self, record_id: uuid.UUID) -> dict[str, Any]:
        result = await self.db.execute(
            select(
                Movement.movement_type,
                func.coalesce(func.sum(Movement.quantity), 0).label("total"),
                Movement.unit,
            )
            .where(
                Movement.company_id == self.company_id,
                Movement.record_id == record_id,
            )
            .group_by(Movement.movement_type, Movement.unit)
        )
        rows = result.all()

        totals: dict[str, float] = {"receipt": 0.0, "expenditure": 0.0, "write_off": 0.0}
        unit = None
        for row in rows:
            totals[row.movement_type] = float(row.total)
            if unit is None:
                unit = row.unit

        return {
            "receipt": totals["receipt"],
            "expenditure": totals["expenditure"],
            "write_off": totals["write_off"],
            "balance": totals["receipt"] - totals["expenditure"] - totals["write_off"],
            "unit": unit,
        }

    async def get_by_id(self, movement_id: uuid.UUID) -> Movement | None:
        result = await self.db.execute(
            select(Movement).where(
                Movement.id == movement_id,
                Movement.company_id == self.company_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete(self, movement: Movement) -> None:
        await self.db.delete(movement)
        await self.db.flush()
