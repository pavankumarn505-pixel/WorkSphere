from datetime import date

from pydantic import BaseModel, Field, ConfigDict
from typing import Literal


LeaveType = Literal["SICK", "CASUAL", "PAID"]


class LeavePolicyCreate(BaseModel):
    leave_type: LeaveType
    annual_days: int = Field(ge=0)
    is_active: bool = True


class LeavePolicyUpdate(BaseModel):
    annual_days: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class LeavePolicyResponse(BaseModel):
    id: int
    leave_type: str
    annual_days: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceAssign(BaseModel):
    employee_id: int = Field(gt=0)
    leave_type: LeaveType
    year: int = Field(ge=2000, le=2100)
    allocated_days: int = Field(ge=0)


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    leave_type: str
    year: int
    allocated_days: int
    used_days: int
    remaining_days: int

    model_config = ConfigDict(from_attributes=True)
