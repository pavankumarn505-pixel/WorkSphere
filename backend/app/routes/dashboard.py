
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import Attendance
from app.models.leave import Leave
from app.models.payroll import Payroll


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard & Analytics"],
)


def get_last_six_months():
    """Return the current month and previous five months."""
    today = date.today()
    months = []

    for offset in range(5, -1, -1):
        month_number = today.month - offset
        year = today.year

        while month_number <= 0:
            month_number += 12
            year -= 1

        months.append(f"{year:04d}-{month_number:02d}")

    return months


@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    """Return dashboard KPIs for HR and Admin."""

    today = date.today()
    current_month = today.strftime("%Y-%m")

    # Employee statistics
    total_employees = db.query(Employee).count()

    active_employees = (
        db.query(Employee)
        .filter(func.upper(Employee.status) == "ACTIVE")
        .count()
    )

    inactive_employees = (
        db.query(Employee)
        .filter(func.upper(Employee.status) == "INACTIVE")
        .count()
    )

    # Attendance statistics for today
    attendance_rows = (
        db.query(
            func.upper(Attendance.status),
            func.count(Attendance.id),
        )
        .filter(Attendance.date == today)
        .group_by(func.upper(Attendance.status))
        .all()
    )

    attendance_counts = {
        status: count
        for status, count in attendance_rows
    }

    attendance_summary = {
        "date": today.isoformat(),
        "total_records": sum(attendance_counts.values()),
        "present": attendance_counts.get("PRESENT", 0),
        "absent": attendance_counts.get("ABSENT", 0),
        "half_day": attendance_counts.get("HALF_DAY", 0),
    }

    # Leave statistics by status
    leave_rows = (
        db.query(
            func.upper(Leave.status),
            func.count(Leave.id),
        )
        .group_by(func.upper(Leave.status))
        .all()
    )

    leave_counts = {
        status: count
        for status, count in leave_rows
    }

    leave_summary = {
        "total_requests": sum(leave_counts.values()),
        "pending": leave_counts.get("PENDING", 0),
        "approved": leave_counts.get("APPROVED", 0),
        "rejected": leave_counts.get("REJECTED", 0),
    }

    # Payroll for the current month
    payroll_result = (
        db.query(
            func.count(Payroll.id),
            func.coalesce(func.sum(Payroll.net_salary), 0),
        )
        .filter(Payroll.month == current_month)
        .first()
    )

    payroll_count = payroll_result[0] or 0
    payroll_total = float(payroll_result[1] or 0)

    # Payroll trend for the last six months
    months = get_last_six_months()

    payroll_rows = (
        db.query(
            Payroll.month,
            func.count(Payroll.id),
            func.coalesce(func.sum(Payroll.net_salary), 0),
        )
        .filter(Payroll.month.in_(months))
        .group_by(Payroll.month)
        .all()
    )

    payroll_by_month = {
        month: {
            "record_count": count,
            "total_net_salary": float(total or 0),
        }
        for month, count, total in payroll_rows
    }

    monthly_trend = [
        {
            "month": month,
            "record_count": payroll_by_month.get(
                month, {}
            ).get("record_count", 0),
            "total_net_salary": payroll_by_month.get(
                month, {}
            ).get("total_net_salary", 0.0),
        }
        for month in months
    ]

    return {
        "generated_for": today.isoformat(),
        "employees": {
            "total": total_employees,
            "active": active_employees,
            "inactive": inactive_employees,
        },
        "attendance": attendance_summary,
        "leaves": leave_summary,
        "payroll": {
            "month": current_month,
            "record_count": payroll_count,
            "total_net_salary": payroll_total,
            "monthly_trend": monthly_trend,
        },
    }
