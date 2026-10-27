from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.attendance import Attendance
from app.models.employee import Employee
from app.models.leave import Leave
from app.models.performance import PerformanceReview
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics & Reports"],
)


def is_hr_or_admin(user: User) -> bool:
    """Check whether the user can view organization-wide reports."""
    return str(user.role).upper() in {"HR", "ADMIN"}


def get_linked_employee(
    db: Session,
    user: User,
) -> Optional[Employee]:
    """Find the employee record linked to the logged-in user."""
    return (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )


def get_date_range(
    start_date: Optional[date],
    end_date: Optional[date],
):
    """Validate the requested reporting period."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date.",
        )


@router.get("/summary")
def get_analytics_summary(
    start_date: Optional[date] = Query(
        default=None,
        description="Start date in YYYY-MM-DD format",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="End date in YYYY-MM-DD format",
    ),
    department: Optional[str] = Query(
        default=None,
        description="Filter by department (HR/Admin only)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return employee, attendance, leave, and performance statistics.

    HR/Admin:
        Organization-wide reports, optionally filtered by department.

    Employee:
        Reports restricted to their own employee record.
    """

    get_date_range(start_date, end_date)

    # Employees cannot request organization-wide or other
    # department reports.
    if not is_hr_or_admin(current_user):
        if department:
            raise HTTPException(
                status_code=403,
                detail="Only HR or Admin can filter reports by department.",
            )

        employee = get_linked_employee(db, current_user)

        if not employee:
            return {
                "scope": "employee",
                "employee": None,
                "employee_count": 0,
                "attendance": {
                    "present": 0,
                    "absent": 0,
                    "half_day": 0,
                    "total_records": 0,
                    "average_working_hours": None,
                },
                "leaves": {
                    "pending": 0,
                    "approved": 0,
                    "rejected": 0,
                    "total_requests": 0,
                },
                "performance": {
                    "review_count": 0,
                    "average_rating": None,
                },
            }

        employee_ids = [employee.id]
        employee_query = db.query(Employee).filter(
            Employee.id == employee.id
        )

    else:
        employee_query = db.query(Employee)

        if department:
            employee_query = employee_query.filter(
                Employee.department.ilike(department.strip())
            )

        employee_ids = [
            item.id for item in employee_query.all()
        ]

    # Restrict every report to the selected employee IDs.
    attendance_query = db.query(Attendance).filter(
        Attendance.employee_id.in_(employee_ids)
    )

    leave_query = db.query(Leave).filter(
        Leave.employee_id.in_(employee_ids)
    )

    performance_query = db.query(PerformanceReview).filter(
        PerformanceReview.employee_id.in_(employee_ids)
    )

    # Apply the date range to attendance records.
    if start_date:
        attendance_query = attendance_query.filter(
            Attendance.date >= start_date
        )

    if end_date:
        attendance_query = attendance_query.filter(
            Attendance.date <= end_date
        )

    # Include leave requests that overlap the selected period.
    if start_date:
        leave_query = leave_query.filter(
            Leave.end_date >= start_date
        )

    if end_date:
        leave_query = leave_query.filter(
            Leave.start_date <= end_date
        )

    # Filter performance reviews by their creation date.
    if start_date:
        performance_query = performance_query.filter(
            PerformanceReview.created_at >= start_date
        )

    if end_date:
        performance_query = performance_query.filter(
            PerformanceReview.created_at < (
                __import__("datetime").datetime.combine(
                    end_date,
                    __import__("datetime").time.min,
                )
                .replace(tzinfo=None)
                .__add__(
                    __import__("datetime").timedelta(days=1)
                )
            )
        )

    # Load matching records.
    attendance_records = attendance_query.all()
    leave_records = leave_query.all()
    performance_records = performance_query.all()

    # Attendance statistics.
    present_count = sum(
        1 for item in attendance_records
        if item.status.upper() == "PRESENT"
    )

    absent_count = sum(
        1 for item in attendance_records
        if item.status.upper() == "ABSENT"
    )

    half_day_count = sum(
        1 for item in attendance_records
        if item.status.upper() == "HALF_DAY"
    )

    working_hours = [
        item.working_hours
        for item in attendance_records
        if item.working_hours is not None
    ]

    average_working_hours = (
        round(sum(working_hours) / len(working_hours), 2)
        if working_hours
        else None
    )

    # Leave statistics.
    pending_leaves = sum(
        1 for item in leave_records
        if item.status.upper() == "PENDING"
    )

    approved_leaves = sum(
        1 for item in leave_records
        if item.status.upper() == "APPROVED"
    )

    rejected_leaves = sum(
        1 for item in leave_records
        if item.status.upper() == "REJECTED"
    )

    # Performance statistics.
    ratings = [
        item.rating for item in performance_records
    ]

    average_rating = (
        round(sum(ratings) / len(ratings), 2)
        if ratings
        else None
    )

    # Return department details for HR/Admin.
    if is_hr_or_admin(current_user):
        employee_count = len(employee_ids)
        scope = "organization"
        employee_details = None
    else:
        employee_count = len(employee_ids)
        scope = "employee"
        employee_details = {
            "id": employee_ids[0],
            "full_name": employee_query.first().full_name,
        }

    return {
        "scope": scope,
        "employee": employee_details,
        "filters": {
            "start_date": start_date,
            "end_date": end_date,
            "department": department,
        },
        "employee_count": employee_count,
        "attendance": {
            "present": present_count,
            "absent": absent_count,
            "half_day": half_day_count,
            "total_records": len(attendance_records),
            "average_working_hours": average_working_hours,
        },
        "leaves": {
            "pending": pending_leaves,
            "approved": approved_leaves,
            "rejected": rejected_leaves,
            "total_requests": len(leave_records),
        },
        "performance": {
            "review_count": len(performance_records),
            "average_rating": average_rating,
        },
    }


@router.get("/departments")
def get_department_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return employee counts by department for HR/Admin."""

    if not is_hr_or_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only HR or Admin can view department reports.",
        )

    employees = db.query(Employee).all()

    department_counts = {}

    for employee in employees:
        department_name = employee.department or "Unassigned"

        if department_name not in department_counts:
            department_counts[department_name] = 0

        department_counts[department_name] += 1

    return {
        "total_employees": len(employees),
        "departments": [
            {
                "department": name,
                "employee_count": count,
            }
            for name, count in sorted(department_counts.items())
        ],
    }