from sqlalchemy import (
    Column,
    Integer,
    String,
    Time,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Shift(Base):
    """
    Stores available work shifts.

    Examples:
    Morning: 09:00 to 17:00
    Evening: 14:00 to 22:00
    Night:   22:00 to 06:00
    """

    __tablename__ = "shifts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(30),
        unique=True,
        nullable=False,
        index=True,
    )

    start_time = Column(
        Time,
        nullable=False,
    )

    end_time = Column(
        Time,
        nullable=False,
    )

    # Employees currently assigned to this shift.
    employee_assignments = relationship(
        "EmployeeShift",
        back_populates="shift",
    )


class EmployeeShift(Base):
    """
    Stores the current shift assigned to each employee.

    Each employee can have only one current shift assignment.
    """

    __tablename__ = "employee_shifts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    shift_id = Column(
        Integer,
        ForeignKey("shifts.id"),
        nullable=False,
        index=True,
    )

    # Prevent multiple current shift assignments for one employee.
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            name="uq_employee_current_shift",
        ),
    )

    # Link the assignment to its employee.
    employee = relationship(
        "Employee",
        back_populates="shift_assignment",
    )

    # Link the assignment to its shift.
    shift = relationship(
        "Shift",
        back_populates="employee_assignments",
    )
