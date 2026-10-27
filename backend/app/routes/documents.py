
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document
from app.models.employee import Employee
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/documents",
    tags=["Document Management"],
)

# Private folder for uploaded documents.
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "private_documents"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


# --------------------------------------------------
# Helper 1: Check HR/Admin role
# --------------------------------------------------

def is_hr_or_admin(user: User) -> bool:
    role = str(user.role).upper()
    return role in {"HR", "ADMIN"}


# --------------------------------------------------
# Helper 2: Find employee linked to logged-in user
# --------------------------------------------------

def get_employee_for_user(
    db: Session,
    user: User,
) -> Optional[Employee]:
    return (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )


# --------------------------------------------------
# Helper 3: Safely locate a stored document
# --------------------------------------------------

def get_document_file_path(document: Document) -> Path:
    stored_name = document.file_url

    if not stored_name or Path(stored_name).name != stored_name:
        raise HTTPException(
            status_code=400,
            detail="Invalid document storage path.",
        )

    file_path = (UPLOAD_DIR / stored_name).resolve()

    if file_path.parent != UPLOAD_DIR.resolve():
        raise HTTPException(
            status_code=400,
            detail="Invalid document storage path.",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Document file not found on the server.",
        )

    return file_path


# --------------------------------------------------
# API 1: Upload an employee document
# POST /documents/upload
# --------------------------------------------------

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    employee_id: int,
    file: UploadFile = File(...),
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

    if (
        not is_hr_or_admin(current_user)
        and employee.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot upload documents for another employee.",
        )

    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()

    if not original_name or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, PNG, JPG and JPEG files are allowed.",
        )

    stored_name = f"{uuid4().hex}{extension}"
    destination = UPLOAD_DIR / stored_name
    total_size = 0

    try:
        with destination.open("xb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds the 5 MB upload limit.",
                    )

                output.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot upload an empty file.",
            )

        document = Document(
            employee_id=employee.id,
            file_name=original_name,
            file_url=stored_name,
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return {
            "message": "Document uploaded successfully.",
            "document": {
                "id": document.id,
                "employee_id": document.employee_id,
                "file_name": document.file_name,
                "uploaded_at": document.uploaded_at,
            },
        }

    except Exception:
        if destination.exists():
            destination.unlink()

        db.rollback()
        raise

    finally:
        await file.close()


# --------------------------------------------------
# API 2: List documents
# GET /documents/
# --------------------------------------------------

@router.get("/")
def list_documents(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document)

    if is_hr_or_admin(current_user):
        # HR/Admin can list all documents or filter by employee.
        if employee_id is not None:
            query = query.filter(
                Document.employee_id == employee_id
            )
    else:
        # Employees can list only their own documents.
        employee = get_employee_for_user(db, current_user)

        if not employee:
            return []

        query = query.filter(
            Document.employee_id == employee.id
        )

    documents = query.order_by(
        Document.uploaded_at.desc()
    ).all()

    return [
        {
            "id": document.id,
            "employee_id": document.employee_id,
            "file_name": document.file_name,
            "uploaded_at": document.uploaded_at,
        }
        for document in documents
    ]


# --------------------------------------------------
# API 3: Download a document
# GET /documents/{document_id}/download
# --------------------------------------------------

@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    if not is_hr_or_admin(current_user):
        employee = get_employee_for_user(db, current_user)

        if (
            not employee
            or document.employee_id != employee.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot download another employee's document.",
            )

    file_path = get_document_file_path(document)

    return FileResponse(
        path=str(file_path),
        filename=document.file_name,
        media_type="application/octet-stream",
    )


# --------------------------------------------------
# API 4: Delete a document
# DELETE /documents/{document_id}
# --------------------------------------------------

@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Step 1: Find the document.
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    # Step 2: Verify permissions.
    if not is_hr_or_admin(current_user):
        employee = get_employee_for_user(db, current_user)

        if (
            not employee
            or document.employee_id != employee.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another employee's document.",
            )

    # Step 3: Find the stored file, if it exists.
    stored_name = document.file_url

    if not stored_name or Path(stored_name).name != stored_name:
        raise HTTPException(
            status_code=400,
            detail="Invalid document storage path.",
        )

    file_path = (UPLOAD_DIR / stored_name).resolve()

    if file_path.parent != UPLOAD_DIR.resolve():
        raise HTTPException(
            status_code=400,
            detail="Invalid document storage path.",
        )

    # Step 4: Delete the database record first.
    try:
        db.delete(document)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not delete the document record.",
        )

    # Step 5: Remove the stored file.
    # The database record is already deleted at this point.
    if file_path.exists():
        if not file_path.is_file():
            raise HTTPException(
                status_code=500,
                detail="The stored document path is not a file.",
            )

        try:
            file_path.unlink()
        except OSError:
            raise HTTPException(
                status_code=500,
                detail=(
                    "The database record was deleted, "
                    "but the stored file could not be removed."
                ),
            )

    # Step 6: Return success.
    return {
        "message": "Document deleted successfully.",
        "document_id": document_id,
    }
