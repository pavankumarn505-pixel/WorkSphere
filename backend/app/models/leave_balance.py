
from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)

from app.database import Base


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "leave_type",
            "year",
            name="uq_leave_balance_employee_type_year",
        ),
        CheckConstraint(
            "allocated_days >= 0",
            name="ck_leave_balance_allocated_days",
        ),
        CheckConstraint(
            "used_days >= 0",
            name="ck_leave_balance_used_days",
        ),
        CheckConstraint(
            "used_days <= allocated_days",
            name="ck_leave_balance_used_not_over_allocated",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    leave_type = Column(
        String(20),
        nullable=False,
    )

    year = Column(
        Integer,
        nullable=False,
        index=True,
    )

    allocated_days = Column(
        Integer,
        nullable=False,
        default=0,
    )

    used_days = Column(
        Integer,
        nullable=False,
        default=0,
    )

    @property
    def remaining_days(self) -> int:
        return self.allocated_days - self.used_days
