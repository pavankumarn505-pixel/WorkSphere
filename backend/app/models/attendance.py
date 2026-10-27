
from datetime import date, datetime, time, timedelta
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

    # Prevent duplicate attendance records for one employee and date.
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

    # Allowed values: PRESENT, ABSENT, HALF_DAY.
    status = Column(
        String(20),
        nullable=False,
        default="PRESENT",
    )

    # Fallback policy for records without shift-specific calculation.
    OFFICIAL_START_TIME = time(9, 30)
    GRACE_PERIOD_MINUTES = 10

    @property
    def late_by_minutes(self) -> int:
        """
        Calculate lateness using the default 9:30 AM policy.

        Shift-specific lateness must be calculated in the
        attendance route using the assigned shift.
        """
        if self.check_in is None:
            return 0

        cutoff_datetime = (
            datetime.combine(
                self.date,
                self.OFFICIAL_START_TIME,
            )
            + timedelta(minutes=self.GRACE_PERIOD_MINUTES)
        )

        difference_seconds = (
            self.check_in - cutoff_datetime
        ).total_seconds()

        if difference_seconds <= 0:
            return 0

        # Round up any partial minute.
        return int((difference_seconds + 59) // 60)

    @property
    def is_late(self) -> bool:
        """Check lateness using the default policy."""
        return self.late_by_minutes > 0

    @property
    def working_hours(self) -> Optional[float]:
        """Calculate hours worked, including overnight shifts."""
        if self.check_in is None or self.check_out is None:
            return None

        seconds = (
            self.check_out - self.check_in
        ).total_seconds()

        # Handle a checkout time that falls on the following day.
        if seconds < 0:
            seconds += 24 * 60 * 60

        return round(seconds / 3600, 2)
