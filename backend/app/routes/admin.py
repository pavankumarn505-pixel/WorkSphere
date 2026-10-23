from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.schemas_admin import (
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserStatusUpdate,
    AdminUserResponse,
)

router = APIRouter(
    prefix="/admin/users",
    tags=["Admin - User Management"],
)

require_admin = require_roles("ADMIN")


def get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return user


def ensure_another_active_admin_exists(
    db: Session,
    target_user: User,
) -> None:
    if target_user.role != "ADMIN" or not target_user.is_active:
        return

    other_active_admins = (
        db.query(User)
        .filter(
            User.role == "ADMIN",
            User.is_active.is_(True),
            User.id != target_user.id,
        )
        .count()
    )

    if other_active_admins == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove or deactivate the last active administrator.",
        )


@router.get(
    "",
    response_model=list[AdminUserResponse],
)
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return db.query(User).order_by(User.id.asc()).all()


@router.post(
    "",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    email = str(data.email).strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=data.full_name,
        email=email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=True,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except Exception:
        db.rollback()
        raise


@router.patch(
    "/{user_id}",
    response_model=AdminUserResponse,
)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = get_user_or_404(user_id, db)
    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update.",
        )

    for field, value in changes.items():
        if value is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field} cannot be null.",
            )

    if "email" in changes:
        email = str(changes["email"]).strip().lower()

        duplicate = (
            db.query(User)
            .filter(
                User.email == email,
                User.id != user.id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another account already uses this email.",
            )

        changes["email"] = email

    if (
        changes.get("role") is not None
        and changes["role"] != "ADMIN"
    ):
        ensure_another_active_admin_exists(db, user)

    for field, value in changes.items():
        setattr(user, field, value)

    try:
        db.commit()
        db.refresh(user)
        return user
    except Exception:
        db.rollback()
        raise


@router.patch(
    "/{user_id}/status",
    response_model=AdminUserResponse,
)
def update_user_status(
    user_id: int,
    data: AdminUserStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = get_user_or_404(user_id, db)

    if user.id == admin.id and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot deactivate your own account.",
        )

    if not data.is_active:
        ensure_another_active_admin_exists(db, user)

    user.is_active = data.is_active

    try:
        db.commit()
        db.refresh(user)
        return user
    except Exception:
        db.rollback()
        raise


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = get_user_or_404(user_id, db)

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot delete your own account.",
        )

    ensure_another_active_admin_exists(db, user)

    linked_employee = (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )

    if linked_employee is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This user is linked to an employee record. "
                "Deactivate the account instead to preserve HR history."
            ),
        )

    try:
        db.delete(user)
        db.commit()
    except Exception:
        db.rollback()
        raise
