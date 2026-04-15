import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.role import Role
    from app.models.entity import Entity
    from app.models.telegram import TelegramSettings
    from app.models.access_expiration import AccessExpiration


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User", back_populates="company", lazy="select"
    )
    roles: Mapped[list["Role"]] = relationship(
        "Role", back_populates="company", lazy="select"
    )
    entities: Mapped[list["Entity"]] = relationship(
        "Entity", back_populates="company", lazy="select"
    )
    telegram_settings: Mapped["TelegramSettings | None"] = relationship(
        "TelegramSettings", back_populates="company", uselist=False, lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Company id={self.id} name={self.name!r}>"
