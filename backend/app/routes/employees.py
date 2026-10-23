
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.employee import Employee
from app.models.user import User
from app.core.dependencies import get_current_user, require_roles

from app.schemas import ProfileUpdate, UserResponse
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
# Only HR and ADMIN can create employee records.
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
# Only HR and ADMIN can view the employee list.
@router.get("/", response_model=list[EmployeeResponse])
def list_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    return db.query(Employee).order_by(Employee.id).all()


# 3. SEARCH EMPLOYEES
# Keep this route before /{employee_id}.
@router.get("/search", response_model=list[EmployeeResponse])
def search_employees(
    name: str | None = None,
    department: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    query = db.query(Employee)

    if name and name.strip():
        query = query.filter(
            Employee.full_name.ilike(f"%{name.strip()}%")
        )

    if department and department.strip():
        query = query.filter(
            Employee.department.ilike(f"%{department.strip()}%")
        )

    return query.order_by(Employee.id).all()


# 4. VIEW MY PROFILE
# Any authenticated user can view their own linked employee profile.
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


# 5. EDIT MY PROFILE
# A logged-in user can update only their own full name.
@router.put(
    "/me/profile",
    response_model=UserResponse,
)
def update_my_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.full_name = data.full_name

    db.commit()
    db.refresh(current_user)

    return current_user


# 6. GET EMPLOYEE BY ID
# Only HR and ADMIN can access this endpoint.
@router.get("/{employee_id}", response_model=EmployeeResponse)
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


# 7. UPDATE EMPLOYEE RECORD
# Only HR and ADMIN can update employee records.
@router.put("/{employee_id}", response_model=EmployeeResponse)
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
