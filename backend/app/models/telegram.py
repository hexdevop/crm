import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class TelegramSettings(Base, TimestampMixin):
    __tablename__ = "telegram_settings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    bot_token: Mapped[str | None] = mapped_column(String(200))
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Which events to notify: {"record_created": true, "record_updated": true, ...}
    notification_events: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=lambda: {
            "record_created": True,
            "record_updated": True,
            "user_assigned": True,
            "system": True,
        },
    )

    company = relationship("Company", back_populates="telegram_settings")

    def __repr__(self) -> str:
        return f"<TelegramSettings company_id={self.company_id}>"
