
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


# 1. USER REGISTRATION
class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value):
        value = value.strip()

        if len(value) < 2:
            raise ValueError(
                "Full name must contain at least 2 characters."
            )

        return value


# 2. USER LOGIN
class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


# 3. UPDATE PROFILE
class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value):
        value = value.strip()

        if len(value) < 2:
            raise ValueError(
                "Full name must contain at least 2 characters."
            )

        return value


# 4. CHANGE PASSWORD
class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# 5. USER RESPONSE
class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: Literal["EMPLOYEE", "HR", "ADMIN"]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# 6. LOGIN TOKEN RESPONSE
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Literal["EMPLOYEE", "HR", "ADMIN"]
    user: UserResponse
