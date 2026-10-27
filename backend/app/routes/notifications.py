from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.models.notification import Notification

# Import the authentication dependency from your existing auth module.
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/notifications",
    tags=["Notification Management"],
)


# =========================================================
# Pydantic schemas
# =========================================================

class NotificationCreate(BaseModel):
    user_id: int = Field(..., gt=0)
    title: str = Field(..., min_length=1, max_length=150)
    message: str = Field(..., min_length=1)
    notification_type: str = Field(default="SYSTEM", max_length=50)


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# =========================================================
# Helper: check HR/Admin role
# =========================================================

def is_hr_or_admin(current_user: User) -> bool:
    return (current_user.role or "").upper() in ("HR", "ADMIN")


# =========================================================
# 1. List the logged-in user's notifications
# =========================================================

@router.get("/", response_model=list[NotificationResponse])
def get_notifications(
    unread_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )

    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    return query.order_by(Notification.created_at.desc()).all()


# =========================================================
# 2. Count unread notifications
# =========================================================

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    return {"unread_count": count}


# =========================================================
# 3. Mark one notification as read
# =========================================================

@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return {
        "message": "Notification marked as read",
        "notification": NotificationResponse.from_orm(notification),
    }


# =========================================================
# 4. Mark all notifications as read
# =========================================================

@router.patch("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .update(
            {Notification.is_read: True},
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated_count": updated_count,
    }


# =========================================================
# 5. Create a notification (HR/Admin only)
# =========================================================

@router.post(
    "/",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_notification(
    notification_data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_hr_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR or Admin can create notifications",
        )

    title = notification_data.title.strip()
    message = notification_data.message.strip()
    notification_type = notification_data.notification_type.strip().upper()

    if not title or not message or not notification_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title, message, and notification type cannot be blank",
        )

    recipient = (
        db.query(User)
        .filter(User.id == notification_data.user_id)
        .first()
    )

    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient user not found",
        )

    notification = Notification(
        user_id=recipient.id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False,
    )

    try:
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create notification",
        )
