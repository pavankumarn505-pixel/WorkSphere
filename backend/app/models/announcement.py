
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(
        String(50),
        nullable=False,
        default="GENERAL",
    )

    created_by = Column(Integer, nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    publish_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(
        Integer,
        nullable=False,
        default=1,
    )
