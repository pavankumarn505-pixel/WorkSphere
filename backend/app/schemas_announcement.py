
from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=10000)
    category: Literal[
        "GENERAL",
        "POLICY",
        "HOLIDAY",
        "URGENT",
        "EVENT",
    ] = "GENERAL"
    publish_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.publish_at is not None
            and self.expires_at is not None
            and self.expires_at <= self.publish_at
        ):
            raise ValueError(
                "Expiry date must be later than publication date."
            )
        return self


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    message: Optional[str] = Field(default=None, min_length=5, max_length=10000)
    category: Optional[
        Literal["GENERAL", "POLICY", "HOLIDAY", "URGENT", "EVENT"]
    ] = None
    publish_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    message: str
    category: str
    created_by: int
    created_at: datetime
    publish_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
