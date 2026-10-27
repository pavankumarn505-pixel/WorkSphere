from datetime import time
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


# Supported shift names in WorkSphere HRMS.
ShiftName = Literal["Morning", "Evening", "Night"]


class ShiftCreate(BaseModel):
    """Validates data when creating a work shift."""

    name: ShiftName

    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_shift_times(self):
        # Start and end times cannot be identical.
        # For example, 09:00 to 09:00 is not allowed.
        if self.start_time == self.end_time:
            raise ValueError(
                "Shift start time and end time must be different."
            )

        return self


class ShiftResponse(BaseModel):
    """Response returned when displaying shift information."""

    id: int
    name: str
    start_time: time
    end_time: time

    model_config = ConfigDict(from_attributes=True)


class ShiftAssignmentCreate(BaseModel):
    """Validates a shift assignment request."""

    employee_id: int = Field(gt=0)
    shift_id: int = Field(gt=0)


class ShiftAssignmentResponse(BaseModel):
    """Response returned when displaying an employee's shift."""

    id: int
    employee_id: int
    shift_id: int
    employee_name: str
    shift_name: str
    start_time: time
    end_time: time

    model_config = ConfigDict(from_attributes=True)
