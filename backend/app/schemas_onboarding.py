
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class OnboardingCreate(BaseModel):
    employee_id: int = Field(gt=0)
    task_name: str = Field(min_length=2, max_length=200)
    due_date: Optional[date] = None


class OnboardingStatusUpdate(BaseModel):
    status: Literal["PENDING", "COMPLETED"]


class OnboardingResponse(BaseModel):
    id: int
    employee_id: int
    task_name: str
    status: str
    due_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class OnboardingProgress(BaseModel):
    employee_id: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    progress_percentage: float
