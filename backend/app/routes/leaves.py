
from datetime import date

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    require_roles,
)
from app.database import get_db
from app.models.employee import Employee
from app.models.leave import Leave
from app.models.leave_balance import LeaveBalance
from app.models.user import User
from app.schemas_leave import (
    LeaveCreate,
    LeaveDecision,
    LeaveResponse,
)


router = APIRouter(
    prefix="/leaves",
    tags=["Leave Management"],
)


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
# 1. APPLY FOR LEAVE
# POST /leaves/
# --------------------------------------------------
@router.post(
    "/",
    response_model=LeaveResponse,
    status_code=status.HTTP_201_CREATED,
)
def apply_for_leave(
    data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user)

    if data.start_date > data.end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date.",
        )

    # Prevent overlapping pending or approved leave
    # for the same employee.
    overlapping_leave = (
        db.query(Leave)
        .filter(
            Leave.employee_id == employee.id,
            Leave.status.in_(["PENDING", "APPROVED"]),
            Leave.start_date <= data.end_date,
            Leave.end_date >= data.start_date,
        )
        .first()
    )

    if overlapping_leave is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "These dates overlap an existing pending "
                "or approved leave request."
            ),
        )

    leave = Leave(
        employee_id=employee.id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason.strip(),
        status="PENDING",
    )

    db.add(leave)
    db.commit()
    db.refresh(leave)

    return leave


# --------------------------------------------------
# 2. VIEW MY LEAVE HISTORY
# GET /leaves/me
# --------------------------------------------------
@router.get(
    "/me",
    response_model=list[LeaveResponse],
)
def get_my_leave_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user)

    return (
        db.query(Leave)
        .filter(Leave.employee_id == employee.id)
        .order_by(Leave.start_date.desc(), Leave.id.desc())
        .all()
    )


# --------------------------------------------------
# 3. HR/ADMIN VIEW ALL LEAVE REQUESTS
# GET /leaves/?employee_id=1&leave_status=PENDING
# --------------------------------------------------
@router.get(
    "/",
    response_model=list[LeaveResponse],
)
def get_all_leave_requests(
    employee_id: int | None = Query(default=None, gt=0),
    leave_status: str | None = Query(
        default=None,
        pattern="^(PENDING|APPROVED|REJECTED)$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(Leave)

    if employee_id is not None:
        query = query.filter(
            Leave.employee_id == employee_id
        )

    if leave_status is not None:
        query = query.filter(
            Leave.status == leave_status
        )

    return (
        query
        .order_by(Leave.start_date.desc(), Leave.id.desc())
        .all()
    )


# --------------------------------------------------
# 4. MODULE 15: TEAM LEAVE CALENDAR
# GET /leaves/calendar?start_date=2026-10-01
#                       &end_date=2026-10-31
#
# All authenticated users can view approved team leave.
# Only HR/Admin can include pending requests.
# --------------------------------------------------
@router.get("/calendar")
def get_leave_calendar(
    start_date: date,
    end_date: date,
    include_pending: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date.",
        )

    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=400,
            detail="Please request a calendar range of 367 days or less.",
        )

    # Employees can see approved leave only.
    # Pending leave details are restricted to HR/Admin.
    allowed_statuses = ["APPROVED"]

    if include_pending:
        if current_user.role not in ("HR", "ADMIN"):
            raise HTTPException(
                status_code=403,
                detail="Only HR/Admin can view pending team leave.",
            )
        allowed_statuses.append("PENDING")

    records = (
        db.query(Leave, Employee)
        .join(Employee, Leave.employee_id == Employee.id)
        .filter(
            Employee.status == "ACTIVE",
            Leave.status.in_(allowed_statuses),
            Leave.start_date <= end_date,
            Leave.end_date >= start_date,
        )
        .order_by(Leave.start_date.asc(), Employee.full_name.asc())
        .all()
    )

    calendar_entries = []

    for leave, employee in records:
        calendar_entries.append({
            "leave_id": leave.id,
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "department": employee.department,
            "leave_type": leave.leave_type,
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "status": leave.status,
        })

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_entries": len(calendar_entries),
        "leaves": calendar_entries,
    }


# --------------------------------------------------
# 5. MODULE 15: TEAM AVAILABILITY DASHBOARD
# GET /leaves/team-availability?target_date=2026-10-26
#
# HR/Admin can see team availability and pending counts.
# --------------------------------------------------
@router.get("/team-availability")
def get_team_availability(
    target_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    selected_date = target_date or date.today()

    employees = (
        db.query(Employee)
        .filter(Employee.status == "ACTIVE")
        .order_by(Employee.department.asc(), Employee.full_name.asc())
        .all()
    )

    approved_leaves = (
        db.query(Leave, Employee)
        .join(Employee, Leave.employee_id == Employee.id)
        .filter(
            Employee.status == "ACTIVE",
            Leave.status == "APPROVED",
            Leave.start_date <= selected_date,
            Leave.end_date >= selected_date,
        )
        .all()
    )

    pending_leaves = (
        db.query(Leave)
        .filter(
            Leave.status == "PENDING",
            Leave.start_date <= selected_date,
            Leave.end_date >= selected_date,
        )
        .count()
    )

    leave_by_employee = {
        employee.id: leave
        for leave, employee in approved_leaves
    }

    team = []

    for employee in employees:
        leave = leave_by_employee.get(employee.id)

        team.append({
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "department": employee.department,
            "availability": (
                "ON_LEAVE" if leave else "AVAILABLE"
            ),
            "leave_type": leave.leave_type if leave else None,
            "leave_start_date": (
                leave.start_date.isoformat() if leave else None
            ),
            "leave_end_date": (
                leave.end_date.isoformat() if leave else None
            ),
        })

    on_leave_count = sum(
        1 for member in team
        if member["availability"] == "ON_LEAVE"
    )

    available_count = len(team) - on_leave_count

    return {
        "date": selected_date.isoformat(),
        "total_active_employees": len(team),
        "available_count": available_count,
        "on_leave_count": on_leave_count,
        "pending_requests_covering_date": pending_leaves,
        "team": team,
    }


# --------------------------------------------------
# 6. MODULE 15: TEAM LEAVE CONFLICT WARNINGS
# GET /leaves/conflicts?start_date=2026-10-01
#                       &end_date=2026-10-31
#
# Warn when two or more employees have approved leave
# on the same date. This is a coverage warning, not
# an automatic rejection.
# --------------------------------------------------
@router.get("/conflicts")
def get_team_leave_conflicts(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date.",
        )

    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=400,
            detail="Please request a date range of 367 days or less.",
        )

    records = (
        db.query(Leave, Employee)
        .join(Employee, Leave.employee_id == Employee.id)
        .filter(
            Employee.status == "ACTIVE",
            Leave.status == "APPROVED",
            Leave.start_date <= end_date,
            Leave.end_date >= start_date,
        )
        .all()
    )

    # Build a list of employees on approved leave for each day.
    leave_by_date = {}

    for leave, employee in records:
        first_day = max(leave.start_date, start_date)
        last_day = min(leave.end_date, end_date)

        current_day = first_day

        while current_day <= last_day:
            day_key = current_day.isoformat()

            leave_by_date.setdefault(day_key, []).append({
                "employee_id": employee.id,
                "employee_name": employee.full_name,
                "department": employee.department,
                "leave_type": leave.leave_type,
            })

            current_day = date.fromordinal(
                current_day.toordinal() + 1
            )

    conflicts = []

    for day_key, members in sorted(leave_by_date.items()):
        if len(members) >= 2:
            conflicts.append({
                "date": day_key,
                "employees_on_leave": len(members),
                "message": (
                    f"{len(members)} employees have approved leave "
                    f"on {day_key}. Check team coverage."
                ),
                "employees": members,
            })

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "conflict_days": len(conflicts),
        "conflicts": conflicts,
    }


# --------------------------------------------------
# 7. APPROVE OR REJECT A LEAVE REQUEST
# PATCH /leaves/{leave_id}/decision
# --------------------------------------------------
@router.patch(
    "/{leave_id}/decision",
    response_model=LeaveResponse,
)
def decide_leave_request(
    leave_id: int,
    data: LeaveDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    leave = (
        db.query(Leave)
        .filter(Leave.id == leave_id)
        .first()
    )

    if leave is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    if leave.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending leave requests can be decided.",
        )

    if data.status == "APPROVED":
        if leave.start_date.year != leave.end_date.year:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Leave requests spanning calendar years "
                    "cannot be approved yet. Split the request "
                    "into separate yearly requests."
                ),
            )

        conflicting_leave = (
            db.query(Leave)
            .filter(
                Leave.employee_id == leave.employee_id,
                Leave.id != leave.id,
                Leave.status == "APPROVED",
                Leave.start_date <= leave.end_date,
                Leave.end_date >= leave.start_date,
            )
            .first()
        )

        if conflicting_leave is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Cannot approve this request because "
                    "it overlaps an approved leave."
                ),
            )

        requested_days = (
            leave.end_date - leave.start_date
        ).days + 1

        balance = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == leave.employee_id,
                LeaveBalance.leave_type == leave.leave_type,
                LeaveBalance.year == leave.start_date.year,
            )
            .first()
        )

        if balance is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "No leave balance has been assigned for "
                    f"{leave.leave_type} in {leave.start_date.year}. "
                    "Please ask HR to assign a balance first."
                ),
            )

        remaining_days = (
            balance.allocated_days - balance.used_days
        )

        if requested_days > remaining_days:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Insufficient {leave.leave_type} leave balance. "
                    f"Requested: {requested_days} days; "
                    f"remaining: {remaining_days} days."
                ),
            )

        balance.used_days += requested_days
        leave.status = "APPROVED"

    else:
        leave.status = data.status

    try:
        db.commit()
        db.refresh(leave)
    except Exception:
        db.rollback()
        raise

    return leave
