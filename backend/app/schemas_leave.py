
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


LeaveType = Literal["SICK", "CASUAL", "PAID"]
LeaveStatus = Literal["PENDING", "APPROVED", "REJECTED"]


class LeaveCreate(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str = Field(min_length=5, max_length=1000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError(
                "End date must be on or after start date."
            )
        return self

    @model_validator(mode="after")
    def validate_reason(self):
        if not self.reason.strip():
            raise ValueError("Reason cannot be empty.")
        return self


class LeaveDecision(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


class LeaveResponse(BaseModel):
    id: int
    employee_id: int
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str
    status: LeaveStatus

    model_config = ConfigDict(from_attributes=True)
