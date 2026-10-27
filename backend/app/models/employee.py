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
    """
    Stores employee information for WorkSphere HRMS.
    """

    __tablename__ = "employees"

    # Primary key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Connect the employee record to a login account.
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=True,
    )

    # Employee details
    full_name = Column(
        String(100),
        nullable=False,
        index=True,
    )

    designation = Column(
        String(100),
        nullable=False,
    )

    department = Column(
        String(100),
        nullable=False,
        index=True,
    )

    joining_date = Column(
        Date,
        nullable=False,
    )

    salary = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
    )

    # Relationship with the login account.
    user = relationship("User")

    # Relationship with the employee's current shift assignment.
    # An employee can have zero or one current shift assignment.
    shift_assignment = relationship(
        "EmployeeShift",
        back_populates="employee",
        uselist=False,
    )
