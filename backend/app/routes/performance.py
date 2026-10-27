
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.performance import PerformanceReview
from app.models.employee import Employee
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/performance",
    tags=["Performance Management"],
)


# --------------------------------------------------
# Request validation
# --------------------------------------------------

class PerformanceReviewCreate(BaseModel):
    employee_id: int = Field(gt=0)
    review_period: str = Field(min_length=1, max_length=50)
    rating: int = Field(ge=1, le=5)
    feedback: str = Field(min_length=1)


# --------------------------------------------------
# Helper functions
# --------------------------------------------------

def is_hr_or_admin(user: User) -> bool:
    return str(user.role).upper() in {"HR", "ADMIN"}


def get_employee_for_user(
    db: Session,
    user: User,
) -> Optional[Employee]:
    return (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )


def review_to_dict(review: PerformanceReview) -> dict:
    return {
        "id": review.id,
        "employee_id": review.employee_id,
        "review_period": review.review_period,
        "rating": review.rating,
        "feedback": review.feedback,
        "created_at": review.created_at,
    }


# --------------------------------------------------
# API 1: Create a performance review
# POST /performance/
# HR/Admin only
# --------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_performance_review(
    review_data: PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_hr_or_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only HR or Admin can create performance reviews.",
        )

    employee = (
        db.query(Employee)
        .filter(Employee.id == review_data.employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    period = review_data.review_period.strip()
    feedback = review_data.feedback.strip()

    if not period or not feedback:
        raise HTTPException(
            status_code=422,
            detail="Review period and feedback cannot be blank.",
        )

    review = PerformanceReview(
        employee_id=employee.id,
        review_period=period,
        rating=review_data.rating,
        feedback=feedback,
    )

    try:
        db.add(review)
        db.commit()
        db.refresh(review)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the performance review.",
        )

    return {
        "message": "Performance review created successfully.",
        "review": review_to_dict(review),
    }


# --------------------------------------------------
# API 2: List performance reviews
# GET /performance/
# HR/Admin: all reviews
# Employee: own reviews only
# --------------------------------------------------

@router.get("/")
def list_performance_reviews(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PerformanceReview)

    if is_hr_or_admin(current_user):
        if employee_id is not None:
            query = query.filter(
                PerformanceReview.employee_id == employee_id
            )
    else:
        employee = get_employee_for_user(db, current_user)

        if not employee:
            return []

        if (
            employee_id is not None
            and employee_id != employee.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only view your own performance reviews.",
            )

        query = query.filter(
            PerformanceReview.employee_id == employee.id
        )

    reviews = query.order_by(
        PerformanceReview.created_at.desc()
    ).all()

    return [review_to_dict(review) for review in reviews]


# --------------------------------------------------
# API 3: List reviews for one employee
# GET /performance/employee/{employee_id}
# --------------------------------------------------

@router.get("/employee/{employee_id}")
def get_employee_performance_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    if not is_hr_or_admin(current_user):
        current_employee = get_employee_for_user(db, current_user)

        if (
            not current_employee
            or current_employee.id != employee_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only view your own performance reviews.",
            )

    reviews = (
        db.query(PerformanceReview)
        .filter(PerformanceReview.employee_id == employee_id)
        .order_by(PerformanceReview.created_at.desc())
        .all()
    )

    return [review_to_dict(review) for review in reviews]


# --------------------------------------------------
# API 4: Get one performance review
# GET /performance/{review_id}
# --------------------------------------------------

@router.get("/{review_id}")
def get_performance_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = (
        db.query(PerformanceReview)
        .filter(PerformanceReview.id == review_id)
        .first()
    )

    if not review:
        raise HTTPException(
            status_code=404,
            detail="Performance review not found.",
        )

    if not is_hr_or_admin(current_user):
        employee = get_employee_for_user(db, current_user)

        if (
            not employee
            or review.employee_id != employee.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only view your own performance reviews.",
            )

    return review_to_dict(review)
