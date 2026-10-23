
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)

from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    # Only one attendance record per employee per date.
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "date",
            name="uq_attendance_employee_date",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    date = Column(Date, nullable=False, index=True)

    # PRESENT, ABSENT, or HALF_DAY.
    status = Column(
        String(20),
        nullable=False,
        default="PRESENT",
    )

    # Module 10: Official start time and grace period.
    OFFICIAL_START_TIME = time(9, 30)
    GRACE_PERIOD_MINUTES = 10

    @property
    def late_by_minutes(self) -> int:
        """Calculate minutes late beyond the 9:40 AM cutoff."""

        if self.check_in is None:
            return 0

        cutoff_time = time(
            self.OFFICIAL_START_TIME.hour,
            self.OFFICIAL_START_TIME.minute
            + self.GRACE_PERIOD_MINUTES,
        )

        cutoff_datetime = datetime.combine(
            self.date,
            cutoff_time,
        )

        difference_seconds = (
            self.check_in - cutoff_datetime
        ).total_seconds()

        if difference_seconds <= 0:
            return 0

        # Round up partial minutes.
        return int((difference_seconds + 59) // 60)

    @property
    def is_late(self) -> bool:
        """Return True if check-in is after the grace period."""

        return self.late_by_minutes > 0

    @property
    def working_hours(self) -> Optional[float]:
        """Calculate working hours after check-out."""

        if self.check_in is None or self.check_out is None:
            return None

        seconds = (
            self.check_out - self.check_in
        ).total_seconds()

        return round(seconds / 3600, 2)
