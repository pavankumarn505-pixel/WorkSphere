
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Integer,
    String,
)

from app.database import Base


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    __table_args__ = (
        CheckConstraint(
            "annual_days >= 0",
            name="ck_leave_policy_annual_days",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    # SICK, CASUAL, or PAID.
    leave_type = Column(
        String(20),
        nullable=False,
        unique=True,
        index=True,
    )

    # HR/Admin configures this allowance.
    annual_days = Column(
        Integer,
        nullable=False,
        default=0,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )
