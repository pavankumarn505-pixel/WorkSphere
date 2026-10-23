
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.attendance import Attendance
from app.models.employee import Employee
from app.models.user import User
from app.schemas_attendance import (
    AttendanceAbsentRequest,
    AttendanceResponse,
)
from app.core.dependencies import (
    get_current_user,
    require_roles,
)


router = APIRouter(
    prefix="/attendance",
    tags=["Attendance Management"],
)


# Find the employee record linked to the logged-in user.
def get_employee_for_user(
    db: Session,
    current_user: User,
) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee record is linked to this user.",
        )

    return employee


# --------------------------------------------------
# 1. CHECK-IN
# POST /attendance/check-in
# --------------------------------------------------
@router.post(
    "/check-in",
    response_model=AttendanceResponse,
)
def check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user)
    today = date.today()

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == today,
        )
        .first()
    )

    if attendance is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance has already been recorded for today.",
        )

    attendance = Attendance(
        employee_id=employee.id,
        check_in=datetime.now(),
        check_out=None,
        date=today,
        status="PRESENT",
    )

    db.add(attendance)
    db.commit()
    db.refresh(attendance)

    return attendance


# --------------------------------------------------
# 2. CHECK-OUT
# POST /attendance/check-out
# --------------------------------------------------
@router.post(
    "/check-out",
    response_model=AttendanceResponse,
)
def check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user)
    today = date.today()

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == today,
        )
        .first()
    )

    if attendance is None or attendance.check_in is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please check in before checking out.",
        )

    if attendance.check_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already checked out today.",
        )

    now = datetime.now()

    if now < attendance.check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-out time cannot be before check-in.",
        )

    attendance.check_out = now
    working_hours = (
        now - attendance.check_in
    ).total_seconds() / 3600

    attendance.status = (
        "HALF_DAY" if working_hours < 4 else "PRESENT"
    )

    db.commit()
    db.refresh(attendance)

    return attendance


# --------------------------------------------------
# 3. EMPLOYEE ATTENDANCE HISTORY
# GET /attendance/me
# --------------------------------------------------
@router.get(
    "/me",
    response_model=list[AttendanceResponse],
)
def my_attendance_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user)

    return (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id)
        .order_by(Attendance.date.desc())
        .all()
    )


# --------------------------------------------------
# 4. HR/ADMIN VIEW ATTENDANCE
# GET /attendance
# --------------------------------------------------
@router.get(
    "",
    response_model=list[AttendanceResponse],
)
def get_all_attendance(
    employee_id: Optional[int] = Query(default=None, gt=0),
    attendance_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(Attendance)

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    if attendance_date is not None:
        query = query.filter(
            Attendance.date == attendance_date
        )

    return query.order_by(Attendance.date.desc()).all()


# --------------------------------------------------
# 5. HR/ADMIN MARK EMPLOYEE ABSENT
# POST /attendance/absent/{employee_id}
# --------------------------------------------------
@router.post(
    "/absent/{employee_id}",
    response_model=AttendanceResponse,
)
def mark_absent(
    employee_id: int,
    request: AttendanceAbsentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    if request.date > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot mark a future date as absent.",
        )

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            Attendance.date == request.date,
        )
        .first()
    )

    if attendance is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance already exists for this employee and date.",
        )

    attendance = Attendance(
        employee_id=employee_id,
        date=request.date,
        check_in=None,
        check_out=None,
        status="ABSENT",
    )

    db.add(attendance)
    db.commit()
    db.refresh(attendance)

    return attendance




# --------------------------------------------------
# 6. MONTHLY ATTENDANCE ANALYTICS
# GET /attendance/analytics/monthly?year=2026&month=10
# HR/ADMIN ONLY
# --------------------------------------------------

import calendar


@router.get("/analytics/monthly")
def get_monthly_attendance_analytics(
    year: int = Query(
        default=date.today().year,
        ge=2000,
        le=2100,
    ),
    month: int = Query(
        default=date.today().month,
        ge=1,
        le=12,
    ),
    employee_id: Optional[int] = Query(
        default=None,
        gt=0,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    """Return monthly attendance statistics and daily chart data."""

    # Find the first and last dates of the selected month.
    last_day = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    # Fetch attendance records for this month.
    query = db.query(Attendance).filter(
        Attendance.date >= start_date,
        Attendance.date <= end_date,
    )

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    records = query.order_by(Attendance.date.asc()).all()

    # Initialize monthly totals.
    present = 0
    absent = 0
    half_day = 0

    # Prepare a daily breakdown for charting.
    daily_data = {}

    for day in range(1, last_day + 1):
        current_date = date(year, month, day)

        daily_data[current_date.isoformat()] = {
            "date": current_date.isoformat(),
            "present": 0,
            "absent": 0,
            "half_day": 0,
            "total_records": 0,
        }

    for record in records:
        record_status = (record.status or "").upper()

        if record_status == "PRESENT":
            present += 1
            daily_data[record.date.isoformat()]["present"] += 1

        elif record_status == "ABSENT":
            absent += 1
            daily_data[record.date.isoformat()]["absent"] += 1

        elif record_status == "HALF_DAY":
            half_day += 1
            daily_data[record.date.isoformat()]["half_day"] += 1

        daily_data[record.date.isoformat()]["total_records"] += 1

    total_records = len(records)

    # A half-day contributes half credit to the attendance rate.
    attendance_percentage = (
        round(
            ((present + (half_day * 0.5)) / total_records) * 100,
            2,
        )
        if total_records > 0
        else 0.0
    )

    return {
        "year": year,
        "month": month,
        "month_name": calendar.month_name[month],
        "employee_id": employee_id,
        "total_records": total_records,
        "present": present,
        "absent": absent,
        "half_day": half_day,
        "attendance_percentage": attendance_percentage,
        "daily_breakdown": list(daily_data.values()),
    }
