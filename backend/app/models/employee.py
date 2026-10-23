
from sqlalchemy import (
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)

    # Link an employee record to a login account.
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=True,
    )

    full_name = Column(String(100), nullable=False, index=True)
    designation = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False, index=True)
    joining_date = Column(Date, nullable=False)
    salary = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="ACTIVE")

    user = relationship("User")
