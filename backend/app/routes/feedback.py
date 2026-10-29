
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.feedback import Feedback
from app.models.employee import Employee
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas_feedback import FeedbackCreate


router = APIRouter(
    prefix="/feedback",
    tags=["Employee Feedback"],
)


# --------------------------------------------------
# Helper functions
# --------------------------------------------------

def is_hr_or_admin(user: User) -> bool:
    return str(user.role).upper() in {"HR", "ADMIN"}


def get_employee_for_user(
    db: Session,
    user: User,
):
    return (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )


def feedback_to_dict(feedback: Feedback) -> dict:
    return {
        "id": feedback.id,
        "employee_id": feedback.employee_id,
        "message": feedback.message,
        "rating": feedback.rating,
        "created_at": feedback.created_at,
    }


# --------------------------------------------------
# API 1: Submit employee feedback
# POST /feedback/
# Authenticated employees only
# --------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    feedback_data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # HR/Admin accounts use the feedback dashboard,
    # while employee accounts submit feedback.
    if is_hr_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employees can submit feedback.",
        )

    employee = get_employee_for_user(db, current_user)

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile is linked to your account.",
        )

    message = feedback_data.message.strip()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feedback message cannot be blank.",
        )

    feedback = Feedback(
        employee_id=employee.id,
        message=message,
        rating=feedback_data.rating,
        created_at=datetime.now(timezone.utc),
    )

    try:
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save feedback.",
        )

    return {
        "message": "Feedback submitted successfully.",
        "feedback": feedback_to_dict(feedback),
    }


# --------------------------------------------------
# API 2: View all employee feedback
# GET /feedback/
# HR/Admin only
# --------------------------------------------------

@router.get("/")
def list_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_hr_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR or Admin can view all employee feedback.",
        )

    feedback_records = (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .all()
    )

    return [
        feedback_to_dict(feedback)
        for feedback in feedback_records
    ]
