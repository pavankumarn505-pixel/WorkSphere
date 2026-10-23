
from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict


# Create employee
class EmployeeCreate(BaseModel):
    user_id: Optional[int] = Field(default=None, gt=0)
    full_name: str = Field(min_length=2, max_length=100)
    designation: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)
    joining_date: date
    salary: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"


# Update employee
class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
    )
    designation: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
    )
    department: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
    )
    joining_date: Optional[date] = None
    salary: Optional[Decimal] = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    status: Optional[Literal["ACTIVE", "INACTIVE"]] = None


# Employee response for HR/Admin operations
class EmployeeResponse(BaseModel):
    id: int
    user_id: Optional[int]
    full_name: str
    designation: str
    department: str
    joining_date: date
    salary: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)


# Self-service profile response
# Used by GET /employees/me/profile
class EmployeeSelfProfileResponse(BaseModel):
    user_id: int
    employee_id: int
    full_name: str
    email: str
    role: Literal["EMPLOYEE", "HR", "ADMIN"]
    is_active: bool
    designation: str
    department: str
    joining_date: date
    status: Literal["ACTIVE", "INACTIVE"]

    model_config = ConfigDict(from_attributes=True)
