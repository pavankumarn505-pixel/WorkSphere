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


# 1. APPLY FOR LEAVE
# POST /leaves/
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

    # Prevent overlapping pending or approved leave requests.
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


# 2. VIEW MY LEAVE HISTORY
# GET /leaves/me
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


# 3. HR/ADMIN VIEW ALL LEAVE REQUESTS
# GET /leaves/?employee_id=1&leave_status=PENDING
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


# 4. APPROVE OR REJECT A LEAVE REQUEST
# PATCH /leaves/{leave_id}/decision
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

    # Only pending requests can be decided.
    # This also prevents deducting the same request twice.
    if leave.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending leave requests can be decided.",
        )

    if data.status == "APPROVED":
        # Prevent requests that span two calendar years.
        if leave.start_date.year != leave.end_date.year:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Leave requests spanning calendar years "
                    "cannot be approved yet. Split the request "
                    "into separate yearly requests."
                ),
            )

        # Prevent overlap with another approved request.
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

        # Count calendar days inclusively.
        requested_days = (
            leave.end_date - leave.start_date
        ).days + 1

        # Find the balance for this employee, leave type,
        # and calendar year.
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

        # Update balance and leave status in the same transaction.
        balance.used_days += requested_days
        leave.status = "APPROVED"

    else:
        # Rejection does not affect the leave balance.
        leave.status = data.status

    try:
        db.commit()
        db.refresh(leave)
    except Exception:
        db.rollback()
        raise

    return leave
