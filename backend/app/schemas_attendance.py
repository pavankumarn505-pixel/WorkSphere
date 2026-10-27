
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# Allowed attendance statuses
AttendanceStatus = Literal[
    "PRESENT",
    "ABSENT",
    "HALF_DAY",
]


class AttendanceResponse(BaseModel):
    # Basic attendance information
    id: int
    employee_id: int

    # Check-in and check-out timestamps
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None

    # Date associated with the attendance record
    date: date

    # Attendance status
    status: AttendanceStatus

    # Total working hours
    working_hours: Optional[float] = None

    # Late-entry tracking
    is_late: bool = False
    late_by_minutes: int = Field(default=0, ge=0)

    # Early-checkout tracking
    is_early_checkout: bool = False
    early_by_minutes: int = Field(default=0, ge=0)

    # Read values from SQLAlchemy model objects
    model_config = ConfigDict(from_attributes=True)


class AttendanceAbsentRequest(BaseModel):
    # Date for which HR/Admin wants to mark an employee absent
    date: date
