
import calendar
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.attendance import Attendance
from app.models.employee import Employee
from app.models.leave import Leave
from app.models.user import User
from app.models.shift import Shift, EmployeeShift
from app.schemas_attendance import (
    AttendanceAbsentRequest,
    AttendanceResponse,
)
from app.services.attendance_automation import run_absence_check


router = APIRouter(
    prefix="/attendance",
    tags=["Attendance Management"],
)

GRACE_PERIOD_MINUTES = 10


# --------------------------------------------------
# 1. Find the employee linked to the logged-in user.
# --------------------------------------------------
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
            status_code=404,
            detail="No employee record is linked to this user.",
        )

    return employee


# --------------------------------------------------
# 2. Get the employee's assigned shift.
# --------------------------------------------------
def get_employee_shift(
    db: Session,
    employee_id: int,
) -> Optional[Shift]:
    assignment = (
        db.query(EmployeeShift)
        .filter(EmployeeShift.employee_id == employee_id)
        .first()
    )

    if assignment is None:
        return None

    return (
        db.query(Shift)
        .filter(Shift.id == assignment.shift_id)
        .first()
    )


# --------------------------------------------------
# 3. Determine the shift's attendance date.
# Supports overnight shifts.
# --------------------------------------------------
def get_shift_attendance_date(
    now: datetime,
    shift: Shift,
) -> date:
    is_overnight = shift.end_time <= shift.start_time

    if is_overnight and now.time() <= shift.end_time:
        return now.date() - timedelta(days=1)

    return now.date()


# --------------------------------------------------
# 4. Calculate late check-in minutes.
# The employee gets a 10-minute grace period.
# --------------------------------------------------
def calculate_late_minutes(
    check_in_time: datetime,
    attendance_date: date,
    shift: Shift,
) -> int:
    shift_start = datetime.combine(
        attendance_date,
        shift.start_time,
    )

    cutoff = shift_start + timedelta(
        minutes=GRACE_PERIOD_MINUTES
    )

    difference_seconds = (
        check_in_time - cutoff
    ).total_seconds()

    if difference_seconds <= 0:
        return 0

    # Round up partial minutes.
    return int((difference_seconds + 59) // 60)


# --------------------------------------------------
# 5. Calculate early checkout minutes.
# Supports overnight shifts.
# --------------------------------------------------
def calculate_early_checkout_minutes(
    check_out_time: Optional[datetime],
    attendance_date: date,
    shift: Optional[Shift],
) -> int:
    if check_out_time is None or shift is None:
        return 0

    expected_end = datetime.combine(
        attendance_date,
        shift.end_time,
    )

    # Example: shift starts at 22:00 and ends at 06:00.
    if shift.end_time <= shift.start_time:
        expected_end += timedelta(days=1)

    difference_seconds = (
        expected_end - check_out_time
    ).total_seconds()

    if difference_seconds <= 0:
        return 0

    # Round up partial minutes.
    return int((difference_seconds + 59) // 60)


# --------------------------------------------------
# 6. Check whether approved leave covers a date.
# --------------------------------------------------
def employee_has_approved_leave(
    db: Session,
    employee_id: int,
    leave_date: date,
) -> bool:
    approved_leave = (
        db.query(Leave.id)
        .filter(
            Leave.employee_id == employee_id,
            func.upper(Leave.status) == "APPROVED",
            Leave.start_date <= leave_date,
            Leave.end_date >= leave_date,
        )
        .first()
    )

    return approved_leave is not None


# --------------------------------------------------
# 7. Build the response with attendance calculations.
# --------------------------------------------------
def build_attendance_response(
    db: Session,
    attendance: Attendance,
) -> AttendanceResponse:
    response = AttendanceResponse.model_validate(attendance)

    shift = get_employee_shift(
        db,
        attendance.employee_id,
    )

    # No shift means we cannot calculate shift-based timing.
    if shift is None:
        return response.model_copy(
            update={
                "is_late": False,
                "late_by_minutes": 0,
                "is_early_checkout": False,
                "early_by_minutes": 0,
            }
        )

    late_minutes = 0
    early_minutes = 0

    if attendance.check_in is not None:
        late_minutes = calculate_late_minutes(
            attendance.check_in,
            attendance.date,
            shift,
        )

    if attendance.check_out is not None:
        early_minutes = calculate_early_checkout_minutes(
            attendance.check_out,
            attendance.date,
            shift,
        )

    return response.model_copy(
        update={
            "is_late": late_minutes > 0,
            "late_by_minutes": late_minutes,
            "is_early_checkout": early_minutes > 0,
            "early_by_minutes": early_minutes,
        }
    )


# --------------------------------------------------
# 8. EMPLOYEE CHECK-IN
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

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Inactive employees cannot check in.",
        )

    shift = get_employee_shift(db, employee.id)

    if shift is None:
        raise HTTPException(
            status_code=400,
            detail="Please contact HR to get a shift assigned.",
        )

    now = datetime.now()
    attendance_date = get_shift_attendance_date(now, shift)

    existing = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == attendance_date,
        )
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Attendance already exists for this shift date.",
        )

    attendance = Attendance(
        employee_id=employee.id,
        check_in=now,
        check_out=None,
        date=attendance_date,
        status="PRESENT",
    )

    try:
        db.add(attendance)
        db.commit()
        db.refresh(attendance)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Attendance already exists for this employee and date.",
        )

    return build_attendance_response(db, attendance)


# --------------------------------------------------
# 9. EMPLOYEE CHECK-OUT
# POST /attendance/check-out
# Supports overnight attendance.
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

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Inactive employees cannot check out.",
        )

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.check_in.isnot(None),
            Attendance.check_out.is_(None),
        )
        .order_by(Attendance.check_in.desc())
        .first()
    )

    if attendance is None:
        raise HTTPException(
            status_code=400,
            detail="No open attendance record found. Please check in first.",
        )

    now = datetime.now()

    if now < attendance.check_in:
        raise HTTPException(
            status_code=400,
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

    return build_attendance_response(db, attendance)


# --------------------------------------------------
# 10. EMPLOYEE ATTENDANCE HISTORY
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

    records = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id)
        .order_by(
            Attendance.date.desc(),
            Attendance.check_in.desc(),
        )
        .all()
    )

    return [
        build_attendance_response(db, record)
        for record in records
    ]


# --------------------------------------------------
# 11. HR/ADMIN VIEW ATTENDANCE
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
    current_user: User = Depends(require_roles("HR", "ADMIN")),
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

    records = (
        query.order_by(
            Attendance.date.desc(),
            Attendance.check_in.desc(),
        )
        .all()
    )

    return [
        build_attendance_response(db, record)
        for record in records
    ]


# --------------------------------------------------
# 12. HR/ADMIN MANUALLY MARK ABSENT
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
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Inactive employees cannot be marked absent.",
        )

    if request.date > date.today():
        raise HTTPException(
            status_code=400,
            detail="Cannot mark a future date as absent.",
        )

    if employee_has_approved_leave(
        db,
        employee_id,
        request.date,
    ):
        raise HTTPException(
            status_code=400,
            detail="Cannot mark absent: approved leave exists for this date.",
        )

    existing = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            Attendance.date == request.date,
        )
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Attendance already exists for this employee and date.",
        )

    attendance = Attendance(
        employee_id=employee_id,
        date=request.date,
        check_in=None,
        check_out=None,
        status="ABSENT",
    )

    try:
        db.add(attendance)
        db.commit()
        db.refresh(attendance)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Attendance already exists for this employee and date.",
        )

    return build_attendance_response(db, attendance)


# --------------------------------------------------
# 13. RUN AUTOMATIC ABSENCE CHECK
# POST /attendance/automation/run
# --------------------------------------------------
@router.post("/automation/run")
def trigger_absence_automation(
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    created_count = run_absence_check()

    return {
        "message": "Automatic attendance check completed.",
        "absence_records_created": created_count,
    }


# --------------------------------------------------
# 14. MONTHLY ATTENDANCE ANALYTICS
# GET /attendance/analytics/monthly
# --------------------------------------------------
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
    employee_id: Optional[int] = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    last_day = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    query = db.query(Attendance).filter(
        Attendance.date >= start_date,
        Attendance.date <= end_date,
    )

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    records = query.order_by(Attendance.date.asc()).all()

    present = 0
    absent = 0
    half_day = 0
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
        day_data = daily_data[record.date.isoformat()]
        record_status = (record.status or "").upper()

        if record_status == "PRESENT":
            present += 1
            day_data["present"] += 1
        elif record_status == "ABSENT":
            absent += 1
            day_data["absent"] += 1
        elif record_status == "HALF_DAY":
            half_day += 1
            day_data["half_day"] += 1

        day_data["total_records"] += 1

    total_records = len(records)

    attendance_percentage = (
        round(
            ((present + half_day * 0.5) / total_records) * 100,
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
