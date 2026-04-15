import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.entity_record import EntityRecord


class FieldType(str, enum.Enum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    SELECT = "select"
    EMAIL = "email"
    PHONE = "phone"


class Entity(Base, TimestampMixin):
    __tablename__ = "entities"
    __table_args__ = (
        UniqueConstraint("company_id", "slug", name="uq_entity_company_slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(50))   # lucide icon name
    color: Mapped[str | None] = mapped_column(String(7))   # hex color e.g. #3B82F6

    company: Mapped["Company"] = relationship("Company", back_populates="entities")
    fields: Mapped[list["EntityField"]] = relationship(
        "EntityField",
        back_populates="entity",
        cascade="all, delete-orphan",
        order_by="EntityField.position",
        lazy="selectin",
    )
    records: Mapped[list["EntityRecord"]] = relationship(
        "EntityRecord",
        back_populates="entity",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Entity id={self.id} name={self.name!r}>"


class EntityField(Base):
    __tablename__ = "entity_fields"
    __table_args__ = (
        UniqueConstraint("entity_id", "slug", name="uq_entity_field_slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[FieldType] = mapped_column(Enum(FieldType), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_searchable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # For SELECT: {"options": [{"value": "x", "label": "X"}, ...]}
    # For NUMBER: {"min": 0, "max": 9999}
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    entity: Mapped["Entity"] = relationship("Entity", back_populates="fields")

    def __repr__(self) -> str:
        return f"<EntityField id={self.id} slug={self.slug!r} type={self.field_type}>"
