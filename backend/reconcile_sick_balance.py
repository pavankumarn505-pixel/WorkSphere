from datetime import date
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.leave import Leave
from app.models.leave_balance import LeaveBalance
from app.models.leave_policy import LeavePolicy

db: Session = SessionLocal()

try:
    employee_id = 1
    year = 2026
    leave_type = "SICK"

    policy = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.leave_type == leave_type)
        .with_for_update()
        .first()
    )

    balance = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type == leave_type,
            LeaveBalance.year == year,
        )
        .with_for_update()
        .first()
    )

    if policy is None or not policy.is_active:
        raise ValueError("Active SICK leave policy not found.")

    if balance is None:
        raise ValueError("2026 SICK balance for employee 1 not found.")

    if policy.annual_days != 10:
        raise ValueError(
            f"Expected SICK policy of 10 days, got {policy.annual_days}."
        )

    approved = (
        db.query(Leave)
        .filter(
            Leave.employee_id == employee_id,
            Leave.leave_type == leave_type,
            Leave.status == "APPROVED",
            Leave.start_date >= date(year, 1, 1),
            Leave.end_date <= date(year, 12, 31),
        )
        .order_by(Leave.id)
        .all()
    )

    expected = {
        1: (date(2026, 10, 21), date(2026, 10, 23)),
        2: (date(2026, 10, 27), date(2026, 10, 30)),
    }

    actual = {
        leave.id: (leave.start_date, leave.end_date)
        for leave in approved
    }

    if actual != expected:
        raise ValueError(
            f"Approved leave records differ from expected test data: {actual}"
        )

    used_days = sum(
        (leave.end_date - leave.start_date).days + 1
        for leave in approved
    )

    if used_days > policy.annual_days:
        raise ValueError("Approved leave exceeds the annual SICK policy.")

    balance.allocated_days = policy.annual_days
    balance.used_days = used_days

    db.flush()

    print("Verified approved SICK leave records:")
    for leave in approved:
        days = (leave.end_date - leave.start_date).days + 1
        print(
            f"  ID {leave.id}: {leave.start_date} to "
            f"{leave.end_date} ({days} days), {leave.status}"
        )

    print(f"Policy allocation: {policy.annual_days}")
    print(f"Calculated used days: {used_days}")
    print(f"Calculated remaining days: {balance.allocated_days - balance.used_days}")

    db.commit()
    print("SUCCESS: SICK balance reconciled.")

except Exception as exc:
    db.rollback()
    print(f"FAILED - changes rolled back: {exc}")
    raise

finally:
    db.close()

