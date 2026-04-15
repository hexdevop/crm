import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.entity import Entity


class EntityRecord(Base, TimestampMixin):
    """
    Dynamic record for any entity type.
    All field values stored as JSONB for GIN-indexed full-text search.
    Shape: {"field_slug": value, ...}
    """
    __tablename__ = "entity_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    entity: Mapped["Entity"] = relationship("Entity", back_populates="records")

    def __repr__(self) -> str:
        return f"<EntityRecord id={self.id} entity_id={self.entity_id}>"
