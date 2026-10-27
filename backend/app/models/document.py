
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Document(Base):
    # Name of the database table.
    __tablename__ = "documents"

    # Unique ID for each uploaded document.
    id = Column(Integer, primary_key=True, index=True)

    # Employee who owns this document.
    # The employee must exist in the employees table.
    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    # Original filename shown to the user.
    file_name = Column(String(255), nullable=False)

    # Private storage reference, not a public download URL.
    file_url = Column(String(500), nullable=False)

    # Automatically records when the document is uploaded.
    uploaded_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
