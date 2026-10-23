from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.database import get_db
from app.models.employee import Employee
from app.models.leave_balance import LeaveBalance
from app.models.leave_policy import LeavePolicy
from app.models.user import User
from app.schemas_leave_balance import (
    LeaveBalanceAssign,
    LeaveBalanceResponse,
    LeavePolicyCreate,
    LeavePolicyResponse,
    LeavePolicyUpdate,
)


router = APIRouter(
    prefix="/leave-policies",
    tags=["Leave Policies & Balances"],
)


# 1. LIST LEAVE POLICIES
# GET /leave-policies/
@router.get(
    "/",
    response_model=list[LeavePolicyResponse],
)
def list_leave_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(LeavePolicy)
        .order_by(LeavePolicy.leave_type)
        .all()
    )


# 2. CREATE A LEAVE POLICY
# POST /leave-policies/
# HR and ADMIN only.
@router.post(
    "/",
    response_model=LeavePolicyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_leave_policy(
    data: LeavePolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    existing = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.leave_type == data.leave_type)
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A policy already exists for this leave type.",
        )

    policy = LeavePolicy(
        leave_type=data.leave_type,
        annual_days=data.annual_days,
        is_active=data.is_active,
    )

    db.add(policy)
    db.commit()
    db.refresh(policy)

    return policy


# 3. UPDATE A LEAVE POLICY
# PATCH /leave-policies/{policy_id}
# HR and ADMIN only.
@router.patch(
    "/{policy_id}",
    response_model=LeavePolicyResponse,
)
def update_leave_policy(
    policy_id: int,
    data: LeavePolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    policy = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.id == policy_id)
        .first()
    )

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave policy not found.",
        )

    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one field to update.",
        )

    if (
        "annual_days" in updates
        and updates["annual_days"] is not None
    ):
        # Do not reduce an allowance below days already used
        # by any employee for the current calendar year.
        current_year = date.today().year

        balances = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.leave_type == policy.leave_type,
                LeaveBalance.year == current_year,
            )
            .all()
        )

        if any(
            balance.used_days > updates["annual_days"]
            for balance in balances
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Annual allowance cannot be lower than "
                    "days already used by an employee."
                ),
            )

        # Update the policy's default allowance for future
        # assignments. Existing employee allocations remain unchanged.

    for field, value in updates.items():
        if value is not None:
            setattr(policy, field, value)

    db.commit()
    db.refresh(policy)

    return policy


# 4. ASSIGN OR UPDATE AN EMPLOYEE'S YEARLY LEAVE BALANCE
# POST /leave-policies/balances
# HR and ADMIN only.
@router.post(
    "/balances",
    response_model=LeaveBalanceResponse,
)
def assign_leave_balance(
    data: LeaveBalanceAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == data.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    policy = (
        db.query(LeavePolicy)
        .filter(
            LeavePolicy.leave_type == data.leave_type,
            LeavePolicy.is_active.is_(True),
        )
        .first()
    )

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No active policy exists for this leave type. "
                "Create or activate the policy first."
            ),
        )

    balance = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == data.employee_id,
            LeaveBalance.leave_type == data.leave_type,
            LeaveBalance.year == data.year,
        )
        .first()
    )

    if balance is not None:
        if data.allocated_days < balance.used_days:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Allocated days cannot be less than "
                    "the employee's days already used."
                ),
            )

        balance.allocated_days = data.allocated_days
    else:
        balance = LeaveBalance(
            employee_id=data.employee_id,
            leave_type=data.leave_type,
            year=data.year,
            allocated_days=data.allocated_days,
            used_days=0,
        )
        db.add(balance)

    db.commit()
    db.refresh(balance)

    return balance


# 5. VIEW MY YEARLY LEAVE BALANCES
# GET /leave-policies/balances/me
@router.get(
    "/balances/me",
    response_model=list[LeaveBalanceResponse],
)
def get_my_leave_balances(
    year: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    selected_year = year if year is not None else date.today().year

    return (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == employee.id,
            LeaveBalance.year == selected_year,
        )
        .order_by(LeaveBalance.leave_type)
        .all()
    )
