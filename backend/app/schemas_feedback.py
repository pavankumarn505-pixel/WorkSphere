
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class FeedbackCreate(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000
    )

    rating: int = Field(
        ...,
        ge=1,
        le=5
    )


class FeedbackResponse(BaseModel):
    id: int
    employee_id: int
    message: str
    rating: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
