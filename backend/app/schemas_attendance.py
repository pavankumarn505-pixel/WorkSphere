
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


AttendanceStatus = Literal[
    "PRESENT",
    "ABSENT",
    "HALF_DAY",
]


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    date: date
    status: AttendanceStatus
    working_hours: Optional[float] = None

    # Module 10: Late-entry tracking
    is_late: bool = False
    late_by_minutes: int = 0

    model_config = ConfigDict(from_attributes=True)


class AttendanceAbsentRequest(BaseModel):
    date: date
