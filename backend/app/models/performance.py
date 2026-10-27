
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.database import Base


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    # Unique ID for each performance review.
    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Employee whose performance is being reviewed.
    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    # Example: "Q1 2026" or "Annual 2026".
    review_period = Column(
        String(50),
        nullable=False,
    )

    # Employee rating on a scale from 1 to 5.
    rating = Column(
        Integer,
        nullable=False,
    )

    # Written performance feedback.
    feedback = Column(
        Text,
        nullable=False,
    )

    # Automatically records when the review is created.
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
