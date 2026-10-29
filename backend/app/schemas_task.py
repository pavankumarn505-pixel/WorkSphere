
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    assigned_to: int = Field(gt=0)
    priority: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    due_date: date


class TaskStatusUpdate(BaseModel):
    status: Literal["TODO", "IN_PROGRESS", "COMPLETED"]


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    assigned_to: int
    assigned_by: int
    priority: str
    status: str
    due_date: date
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
