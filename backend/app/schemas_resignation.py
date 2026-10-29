
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ResignationCreate(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)
    resignation_date: date
    last_working_date: date

    @model_validator(mode="after")
    def validate_dates(self):
        if self.last_working_date < self.resignation_date:
            raise ValueError(
                "Last working date cannot be before the resignation date."
            )
        return self


class ResignationDecision(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    hr_comments: Optional[str] = Field(default=None, max_length=2000)


class ResignationResponse(BaseModel):
    id: int
    employee_id: int
    reason: str
    resignation_date: date
    last_working_date: date
    status: str
    hr_comments: Optional[str] = None

    # created_at is a datetime, not a date.
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
