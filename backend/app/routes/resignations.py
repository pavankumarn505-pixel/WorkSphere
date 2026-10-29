
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.resignation import Resignation
from app.models.user import User
from app.schemas_resignation import (
    ResignationCreate,
    ResignationDecision,
    ResignationResponse,
)

router = APIRouter(
    prefix="/resignations",
    tags=["Resignation & Exit Management"],
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


# Employees submit their own resignation requests.
@router.post(
    "/",
    response_model=ResignationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_resignation(
    data: ResignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_linked_employee(db, current_user)

    existing_request = (
        db.query(Resignation)
        .filter(
            Resignation.employee_id == employee.id,
            Resignation.status == "PENDING",
        )
        .first()
    )

    if existing_request:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending resignation request.",
        )

    resignation = Resignation(
        employee_id=employee.id,
        reason=data.reason.strip(),
        resignation_date=data.resignation_date,
        last_working_date=data.last_working_date,
        status="PENDING",
    )

    if not resignation.reason:
        raise HTTPException(
            status_code=422,
            detail="Resignation reason cannot be empty.",
        )

    db.add(resignation)
    db.commit()
    db.refresh(resignation)
    return resignation


# HR/Admin can view all requests.
@router.get(
    "/",
    response_model=list[ResignationResponse],
)
def list_resignations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    return (
        db.query(Resignation)
        .order_by(Resignation.id.desc())
        .all()
    )


# Employees can view their own requests.
@router.get(
    "/me",
    response_model=list[ResignationResponse],
)
def get_my_resignations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_linked_employee(db, current_user)

    return (
        db.query(Resignation)
        .filter(Resignation.employee_id == employee.id)
        .order_by(Resignation.id.desc())
        .all()
    )


# HR/Admin approve or reject a request.
@router.put(
    "/{resignation_id}/decision",
    response_model=ResignationResponse,
)
def decide_resignation(
    resignation_id: int,
    data: ResignationDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    resignation = (
        db.query(Resignation)
        .filter(Resignation.id == resignation_id)
        .first()
    )

    if resignation is None:
        raise HTTPException(
            status_code=404,
            detail="Resignation request not found.",
        )

    if resignation.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Only pending requests can be approved or rejected.",
        )

    resignation.status = data.status
    resignation.hr_comments = (
        data.hr_comments.strip()
        if data.hr_comments and data.hr_comments.strip()
        else None
    )

    db.commit()
    db.refresh(resignation)
    return resignation
