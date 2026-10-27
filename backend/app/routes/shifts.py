
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_roles
from app.models.employee import Employee
from app.models.shift import Shift, EmployeeShift
from app.schemas_shift import (
    ShiftCreate,
    ShiftResponse,
    ShiftAssignmentCreate,
    ShiftAssignmentResponse,
)

router = APIRouter(
    prefix="/shifts",
    tags=["Shift Management"],
)


# --------------------------------------------------
# 1. Create a shift (HR/Admin only)
# --------------------------------------------------
@router.post(
    "/",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    shift_data: ShiftCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    # Prevent duplicate shift names.
    existing_shift = (
        db.query(Shift)
        .filter(Shift.name == shift_data.name)
        .first()
    )

    if existing_shift:
        raise HTTPException(
            status_code=409,
            detail="A shift with this name already exists.",
        )

    new_shift = Shift(
        name=shift_data.name,
        start_time=shift_data.start_time,
        end_time=shift_data.end_time,
    )

    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)

    return new_shift


# --------------------------------------------------
# 2. View all shifts
# --------------------------------------------------
@router.get("/", response_model=list[ShiftResponse])
def get_shifts(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    return db.query(Shift).order_by(Shift.id).all()


# --------------------------------------------------
# 3. Assign or change an employee's shift
# --------------------------------------------------
@router.post(
    "/assignments",
    response_model=ShiftAssignmentResponse,
)
def assign_shift(
    assignment_data: ShiftAssignmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == assignment_data.employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    # Only active employees can receive a new assignment.
    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Cannot assign a shift to an inactive employee.",
        )

    shift = (
        db.query(Shift)
        .filter(Shift.id == assignment_data.shift_id)
        .first()
    )

    if not shift:
        raise HTTPException(
            status_code=404,
            detail="Shift not found.",
        )

    # Update the existing assignment if one already exists.
    assignment = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == assignment_data.employee_id
        )
        .first()
    )

    if assignment:
        assignment.shift_id = shift.id
    else:
        assignment = EmployeeShift(
            employee_id=employee.id,
            shift_id=shift.id,
        )
        db.add(assignment)

    db.commit()
    db.refresh(assignment)

    return ShiftAssignmentResponse(
        id=assignment.id,
        employee_id=employee.id,
        shift_id=shift.id,
        employee_name=employee.full_name,
        shift_name=shift.name,
        start_time=shift.start_time,
        end_time=shift.end_time,
    )


# --------------------------------------------------
# 4. View all employee shift assignments
# --------------------------------------------------
@router.get(
    "/assignments",
    response_model=list[ShiftAssignmentResponse],
)
def get_shift_assignments(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    assignments = (
        db.query(EmployeeShift)
        .join(Employee, EmployeeShift.employee_id == Employee.id)
        .join(Shift, EmployeeShift.shift_id == Shift.id)
        .order_by(Employee.full_name)
        .all()
    )

    return [
        ShiftAssignmentResponse(
            id=item.id,
            employee_id=item.employee_id,
            shift_id=item.shift_id,
            employee_name=item.employee.full_name,
            shift_name=item.shift.name,
            start_time=item.shift.start_time,
            end_time=item.shift.end_time,
        )
        for item in assignments
    ]


# --------------------------------------------------
# 5. View one employee's assigned shift
# --------------------------------------------------
@router.get(
    "/employees/{employee_id}",
    response_model=ShiftAssignmentResponse,
)
def get_employee_shift(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    assignment = (
        db.query(EmployeeShift)
        .filter(EmployeeShift.employee_id == employee_id)
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="No shift is assigned to this employee.",
        )

    return ShiftAssignmentResponse(
        id=assignment.id,
        employee_id=assignment.employee_id,
        shift_id=assignment.shift_id,
        employee_name=assignment.employee.full_name,
        shift_name=assignment.shift.name,
        start_time=assignment.shift.start_time,
        end_time=assignment.shift.end_time,
    )
