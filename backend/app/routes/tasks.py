
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.task import Task
from app.models.user import User
from app.schemas_task import TaskCreate, TaskStatusUpdate, TaskResponse

router = APIRouter(
    prefix="/tasks",
    tags=["Task Assignment & Tracking"],
)


def get_linked_employee(db: Session, user: User) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee record is linked to your account.",
        )

    return employee


# HR/Admin: create and assign a task.
@router.post(
    "/",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == data.assigned_to)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Assigned employee not found.",
        )

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Cannot assign a task to an inactive employee.",
        )

    task = Task(
        title=data.title.strip(),
        description=(
            data.description.strip()
            if data.description and data.description.strip()
            else None
        ),
        assigned_to=employee.id,
        assigned_by=current_user.id,
        priority=data.priority,
        status="TODO",
        due_date=data.due_date,
    )

    if not task.title:
        raise HTTPException(
            status_code=422,
            detail="Task title cannot be empty.",
        )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


# HR/Admin: list all tasks.
@router.get(
    "/",
    response_model=list[TaskResponse],
)
def list_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    return (
        db.query(Task)
        .order_by(Task.due_date.asc(), Task.id.desc())
        .all()
    )


# Employee: list only their own tasks.
# Keep this route before /{task_id}.
@router.get(
    "/me",
    response_model=list[TaskResponse],
)
def list_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_linked_employee(db, current_user)

    return (
        db.query(Task)
        .filter(Task.assigned_to == employee.id)
        .order_by(Task.due_date.asc(), Task.id.desc())
        .all()
    )


# HR/Admin: view tasks assigned to a particular employee.
@router.get(
    "/employee/{employee_id}",
    response_model=list[TaskResponse],
)
def list_employee_tasks(
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
            status_code=404,
            detail="Employee not found.",
        )

    return (
        db.query(Task)
        .filter(Task.assigned_to == employee_id)
        .order_by(Task.due_date.asc(), Task.id.desc())
        .all()
    )


# HR/Admin: update task details.
@router.put(
    "/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    task_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    employee = (
        db.query(Employee)
        .filter(Employee.id == data.assigned_to)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Assigned employee not found.",
        )

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Cannot assign a task to an inactive employee.",
        )

    task.title = data.title.strip()
    task.description = (
        data.description.strip()
        if data.description and data.description.strip()
        else None
    )
    task.assigned_to = employee.id
    task.priority = data.priority
    task.due_date = data.due_date

    db.commit()
    db.refresh(task)

    return task


# Employee: update status only for their own task.
# HR/Admin may also update task status.
@router.patch(
    "/{task_id}/status",
    response_model=TaskResponse,
)
def update_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    if current_user.role not in ["HR", "ADMIN"]:
        employee = get_linked_employee(db, current_user)

        if task.assigned_to != employee.id:
            raise HTTPException(
                status_code=403,
                detail="You can update only your own assigned tasks.",
            )

    task.status = data.status

    db.commit()
    db.refresh(task)

    return task


# HR/Admin: delete a task.
@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    db.delete(task)
    db.commit()

    return {"message": "Task deleted successfully."}
