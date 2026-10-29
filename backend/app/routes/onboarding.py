
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.onboarding import Onboarding
from app.models.user import User
from app.schemas_onboarding import (
    OnboardingCreate,
    OnboardingStatusUpdate,
    OnboardingResponse,
    OnboardingProgress,
)

router = APIRouter(
    prefix="/onboarding",
    tags=["Employee Onboarding"],
)


# ---------------------------------------------------------
# Helper: find the employee linked to the logged-in user
# ---------------------------------------------------------
def get_linked_employee(db: Session, user: User) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee record is linked to your account.",
        )

    return employee


# ---------------------------------------------------------
# 1. Assign an onboarding task (HR/Admin only)
# POST /onboarding/
# ---------------------------------------------------------
@router.post(
    "/",
    response_model=OnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_onboarding_task(
    data: OnboardingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
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

    task = Onboarding(
        employee_id=data.employee_id,
        task_name=data.task_name.strip(),
        status="PENDING",
        due_date=data.due_date,
    )

    if not task.task_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Task name cannot be empty.",
        )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


# ---------------------------------------------------------
# 2. View all onboarding tasks (HR/Admin only)
# GET /onboarding/
# ---------------------------------------------------------
@router.get(
    "/",
    response_model=list[OnboardingResponse],
)
def list_onboarding_tasks(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    query = db.query(Onboarding)

    if employee_id is not None:
        query = query.filter(
            Onboarding.employee_id == employee_id
        )

    return query.order_by(Onboarding.id.desc()).all()


# ---------------------------------------------------------
# 3. View my onboarding checklist
# GET /onboarding/me
# ---------------------------------------------------------
@router.get(
    "/me",
    response_model=list[OnboardingResponse],
)
def get_my_onboarding_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_linked_employee(db, current_user)

    return (
        db.query(Onboarding)
        .filter(Onboarding.employee_id == employee.id)
        .order_by(Onboarding.id)
        .all()
    )


# ---------------------------------------------------------
# 4. Update task status
# PUT /onboarding/{task_id}/status
#
# HR/Admin can update any task.
# Employees can update only their own tasks.
# ---------------------------------------------------------
@router.put(
    "/{task_id}/status",
    response_model=OnboardingResponse,
)
def update_onboarding_status(
    task_id: int,
    data: OnboardingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Onboarding)
        .filter(Onboarding.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found.",
        )

    if current_user.role.upper() not in {"HR", "ADMIN"}:
        employee = get_linked_employee(db, current_user)

        if task.employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can update only your own onboarding tasks.",
            )

    task.status = data.status

    db.commit()
    db.refresh(task)

    return task


# ---------------------------------------------------------
# 5. View onboarding progress
# GET /onboarding/progress/{employee_id}
#
# HR/Admin can view any employee's progress.
# Employees can view only their own progress.
# ---------------------------------------------------------
@router.get(
    "/progress/{employee_id}",
    response_model=OnboardingProgress,
)
def get_onboarding_progress(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    if current_user.role.upper() not in {"HR", "ADMIN"}:
        own_employee = get_linked_employee(db, current_user)

        if own_employee.id != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can view only your own onboarding progress.",
            )

    tasks = (
        db.query(Onboarding)
        .filter(Onboarding.employee_id == employee_id)
        .all()
    )

    total_tasks = len(tasks)

    completed_tasks = sum(
        1 for task in tasks
        if task.status == "COMPLETED"
    )

    pending_tasks = total_tasks - completed_tasks

    progress_percentage = (
        round((completed_tasks / total_tasks) * 100, 2)
        if total_tasks > 0
        else 0.0
    )

    return OnboardingProgress(
        employee_id=employee_id,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        pending_tasks=pending_tasks,
        progress_percentage=progress_percentage,
    )
