import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.movement import MovementType
from app.repositories.movement import MovementRepository
from app.schemas.movement import MovementCreate, MovementBalance


class MovementService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.repo = MovementRepository(db, company_id)

    async def create_movement(
        self,
        entity_id: uuid.UUID,
        record_id: uuid.UUID,
        data: MovementCreate,
        performed_by: uuid.UUID | None,
    ):
        movement = await self.repo.create(
            entity_id=entity_id,
            record_id=record_id,
            movement_type=MovementType(data.movement_type),
            quantity=data.quantity,
            unit=data.unit,
            notes=data.notes,
            reference_number=data.reference_number,
            performed_by=performed_by,
            performed_at=data.performed_at,
        )
        await self.db.commit()
        return movement

    async def list_by_record(self, record_id: uuid.UUID, limit: int = 100, offset: int = 0):
        return await self.repo.list_by_record(record_id, limit=limit, offset=offset)

    async def list_by_entity(self, entity_id: uuid.UUID, page: int = 1, size: int = 50):
        offset = (page - 1) * size
        return await self.repo.list_by_entity(entity_id, limit=size, offset=offset)

    async def get_balance(self, record_id: uuid.UUID) -> MovementBalance:
        data = await self.repo.get_balance(record_id)
        return MovementBalance(**data)

    async def delete_movement(self, movement_id: uuid.UUID, current_user_id: uuid.UUID) -> None:
        movement = await self.repo.get_by_id(movement_id)
        if not movement:
            raise NotFoundException("Movement")
        # Only the creator or manage_users can delete
        if movement.performed_by and movement.performed_by != current_user_id:
            raise ForbiddenException("Cannot delete another user's movement")
        await self.repo.delete(movement)
        await self.db.commit()
