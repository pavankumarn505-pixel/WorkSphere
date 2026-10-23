
from datetime import datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


Money = Annotated = Decimal


class PayrollCreate(BaseModel):
    employee_id: int = Field(gt=0)
    basic_salary: Decimal = Field(
        ge=0, max_digits=12, decimal_places=2
    )
    allowances: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    deductions: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    bonus: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    month: str = Field(
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$"
    )

    @field_validator(
        "basic_salary",
        "allowances",
        "deductions",
        "bonus",
    )
    @classmethod
    def validate_money(cls, value: Decimal) -> Decimal:
        if not value.is_finite():
            raise ValueError("Salary amounts must be finite.")
        return value


class PayrollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    basic_salary: Decimal
    allowances: Decimal
    deductions: Decimal
    bonus: Decimal
    gross_salary: Decimal
    net_salary: Decimal
    month: str
    created_at: datetime


class PayrollEmployeeResponse(PayrollResponse):
    employee_name: str
