from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    # User who receives the notification
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)

    # Examples: LEAVE, ATTENDANCE, PAYROLL, SYSTEM
    notification_type = Column(
        String(50),
        nullable=False,
        default="SYSTEM",
    )

    is_read = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    user = relationship("User")
