
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.announcement import Announcement
from app.models.user import User
from app.schemas_announcement import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
)

router = APIRouter(
    prefix="/announcements",
    tags=["Internal Announcements"],
)


def current_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_visible(announcement: Announcement) -> bool:
    now = current_utc()

    # Inactive announcements are hidden from employees.
    if not announcement.is_active:
        return False

    # Hide announcements that have not reached their publish time.
    if announcement.publish_at and announcement.publish_at > now:
        return False

    # Hide announcements after their expiry time.
    if announcement.expires_at and announcement.expires_at <= now:
        return False

    return True


@router.post(
    "/",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    publish_at = data.publish_at or datetime.now(timezone.utc)

    if data.expires_at and data.expires_at <= publish_at:
        raise HTTPException(
            status_code=422,
            detail="Expiry date must be later than publication date.",
        )

    announcement = Announcement(
        title=data.title.strip(),
        message=data.message.strip(),
        category=data.category,
        created_by=current_user.id,
        publish_at=publish_at,
        expires_at=data.expires_at,
        is_active=1,
    )

    if not announcement.title or not announcement.message:
        raise HTTPException(
            status_code=422,
            detail="Title and message cannot be empty.",
        )

    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.get(
    "/",
    response_model=list[AnnouncementResponse],
)
def list_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    announcements = (
        db.query(Announcement)
        .order_by(Announcement.publish_at.desc())
        .all()
    )

    # HR and Admin can see all announcements, including inactive ones.
    if current_user.role in ["HR", "ADMIN"]:
        return announcements

    # Employees only see currently published, active announcements.
    return [
        item for item in announcements
        if is_visible(item)
    ]


@router.put(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def update_announcement(
    announcement_id: int,
    data: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if announcement is None:
        raise HTTPException(
            status_code=404,
            detail="Announcement not found.",
        )

    updates = data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if field in ["title", "message"] and value is not None:
            value = value.strip()
            if not value:
                raise HTTPException(
                    status_code=422,
                    detail=f"{field.capitalize()} cannot be empty.",
                )

        if field == "is_active" and value is not None:
            value = int(value)

        setattr(announcement, field, value)

    if (
        announcement.expires_at
        and announcement.publish_at
        and announcement.expires_at <= announcement.publish_at
    ):
        raise HTTPException(
            status_code=422,
            detail="Expiry date must be later than publication date.",
        )

    db.commit()
    db.refresh(announcement)
    return announcement


@router.delete("/{announcement_id}")
def deactivate_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if announcement is None:
        raise HTTPException(
            status_code=404,
            detail="Announcement not found.",
        )

    # Soft delete: preserve the announcement in the database.
    announcement.is_active = 0
    db.commit()

    return {
        "message": "Announcement deactivated successfully."
    }
