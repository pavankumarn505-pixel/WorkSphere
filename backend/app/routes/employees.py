
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.employee import Employee
from app.models.user import User
from app.models.attendance import Attendance
from app.models.performance import PerformanceReview
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password, verify_password

from app.schemas import (
    ProfileUpdate,
    UserResponse,
    PasswordChange,
)
from app.schemas_employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeSelfProfileResponse,
)


router = APIRouter(
    prefix="/employees",
    tags=["Employee Management"],
)


# 1. CREATE EMPLOYEE
@router.post(
    "/",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    if data.user_id is not None:
        linked_user = (
            db.query(User)
            .filter(User.id == data.user_id)
            .first()
        )

        if linked_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Linked user account not found",
            )

        existing_employee = (
            db.query(Employee)
            .filter(Employee.user_id == data.user_id)
            .first()
        )

        if existing_employee:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This user already has an employee record",
            )

    employee = Employee(**data.model_dump())

    db.add(employee)
    db.commit()
    db.refresh(employee)

    return employee


# 2. LIST EMPLOYEES
@router.get(
    "/",
    response_model=list[EmployeeResponse],
)
def list_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    return db.query(Employee).order_by(Employee.id).all()


# 3. ADVANCED EMPLOYEE SEARCH AND FILTERS
# Keep this route before /{employee_id}.
@router.get(
    "/search",
    response_model=list[EmployeeResponse],
)
def search_employees(
    name: str | None = None,
    department: str | None = None,
    designation: str | None = None,
    role: str | None = None,
    employee_status: str | None = None,
    attendance_status: str | None = None,
    performance_rating: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    query = db.query(Employee)

    # Search by employee name.
    if name and name.strip():
        query = query.filter(
            Employee.full_name.ilike(f"%{name.strip()}%")
        )

    # Filter by department.
    if department and department.strip():
        query = query.filter(
            Employee.department.ilike(f"%{department.strip()}%")
        )

    # Filter by designation.
    if designation and designation.strip():
        query = query.filter(
            Employee.designation.ilike(f"%{designation.strip()}%")
        )

    # Filter by linked account role.
    if role and role.strip():
        normalized_role = role.strip().upper()

        if normalized_role not in {"EMPLOYEE", "HR", "ADMIN"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="role must be EMPLOYEE, HR, or ADMIN",
            )

        query = query.join(
            User,
            Employee.user_id == User.id,
        ).filter(
            func.upper(User.role) == normalized_role
        )

    # Filter by employment status.
    if employee_status and employee_status.strip():
        normalized_status = employee_status.strip().upper()

        if normalized_status not in {"ACTIVE", "INACTIVE"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="employee_status must be ACTIVE or INACTIVE",
            )

        query = query.filter(
            func.upper(Employee.status) == normalized_status
        )

    # Filter by the latest attendance status.
    if attendance_status and attendance_status.strip():
        normalized_attendance = attendance_status.strip().upper()

        if normalized_attendance not in {
            "PRESENT",
            "ABSENT",
            "HALF_DAY",
        }:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "attendance_status must be PRESENT, ABSENT, "
                    "or HALF_DAY"
                ),
            )

        latest_dates = (
            db.query(
                Attendance.employee_id.label("employee_id"),
                func.max(Attendance.date).label("latest_date"),
            )
            .group_by(Attendance.employee_id)
            .subquery()
        )

        latest_ids = (
            db.query(
                Attendance.employee_id.label("employee_id"),
                func.max(Attendance.id).label("attendance_id"),
            )
            .join(
                latest_dates,
                (Attendance.employee_id == latest_dates.c.employee_id)
                & (Attendance.date == latest_dates.c.latest_date),
            )
            .group_by(Attendance.employee_id)
            .subquery()
        )

        matching_attendance_employee_ids = (
            db.query(Attendance.employee_id)
            .join(
                latest_ids,
                Attendance.id == latest_ids.c.attendance_id,
            )
            .filter(
                func.upper(Attendance.status) == normalized_attendance
            )
        )

        query = query.filter(
            Employee.id.in_(matching_attendance_employee_ids)
        )

    # Filter by performance rating.
    if performance_rating is not None:
        if not 1 <= performance_rating <= 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="performance_rating must be between 1 and 5",
            )

        matching_performance_employee_ids = (
            db.query(PerformanceReview.employee_id)
            .filter(
                PerformanceReview.rating == performance_rating
            )
            .distinct()
        )

        query = query.filter(
            Employee.id.in_(matching_performance_employee_ids)
        )

    return query.order_by(Employee.id).all()


# 4. VIEW MY EMPLOYEE PROFILE
@router.get(
    "/me/profile",
    response_model=EmployeeSelfProfileResponse,
)
def get_my_employee_profile(
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
            detail="No employee record is linked to your account.",
        )

    return {
        "user_id": current_user.id,
        "employee_id": employee.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "designation": employee.designation,
        "department": employee.department,
        "joining_date": employee.joining_date,
        "status": employee.status,
    }


# 5. UPDATE MY PROFILE
@router.put(
    "/me/profile",
    response_model=UserResponse,
)
def update_my_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    try:
        current_user.full_name = data.full_name

        # Keep the linked employee record consistent.
        if employee is not None:
            employee.full_name = data.full_name

        db.commit()
        db.refresh(current_user)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update your profile. Please try again.",
        )

    return current_user


# 6. CHANGE MY PASSWORD
@router.put(
    "/me/change-password",
    status_code=status.HTTP_200_OK,
)
def change_my_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the existing password.
    if not verify_password(
        data.current_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # Reject reuse of the existing password.
    if verify_password(
        data.new_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    try:
        # Store only the hashed password.
        current_user.hashed_password = hash_password(
            data.new_password
        )

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to change password. Please try again.",
        )

    return {"message": "Password changed successfully."}


# 7. GET EMPLOYEE BY ID
@router.get(
    "/{employee_id}",
    response_model=EmployeeResponse,
)
def get_employee(
    employee_id: int,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    return employee


# 8. UPDATE EMPLOYEE RECORD
@router.put(
    "/{employee_id}",
    response_model=EmployeeResponse,
)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    updates = data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if value is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field} cannot be null",
            )

    for field, value in updates.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)

    return employee
