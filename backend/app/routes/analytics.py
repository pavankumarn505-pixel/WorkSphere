
from datetime import date, datetime, time, timedelta
from typing import Optional
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.database import get_db
from app.models.attendance import Attendance
from app.models.employee import Employee
from app.models.leave import Leave
from app.models.performance import PerformanceReview
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics & Reports"],
)


# =========================================================
# Helper functions
# =========================================================

def is_hr_or_admin(user: User) -> bool:
    """Check whether the user can view organization-wide reports."""
    return str(user.role).upper() in {"HR", "ADMIN"}


def get_linked_employee(
    db: Session,
    user: User,
) -> Optional[Employee]:
    """Find the employee record linked to the logged-in user."""
    return (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )


def get_date_range(
    start_date: Optional[date],
    end_date: Optional[date],
):
    """Validate the requested reporting period."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date.",
        )


def build_analytics_summary(
    start_date: Optional[date],
    end_date: Optional[date],
    department: Optional[str],
    db: Session,
    current_user: User,
):
    """Build the report shared by JSON, CSV, and PDF endpoints."""

    get_date_range(start_date, end_date)

    manager_access = is_hr_or_admin(current_user)

    if not manager_access:
        if department:
            raise HTTPException(
                status_code=403,
                detail="Only HR or Admin can filter reports by department.",
            )

        employee = get_linked_employee(db, current_user)

        if not employee:
            return {
                "scope": "employee",
                "employee": None,
                "filters": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "department": department,
                },
                "employee_count": 0,
                "attendance": {
                    "present": 0,
                    "absent": 0,
                    "half_day": 0,
                    "total_records": 0,
                    "average_working_hours": None,
                },
                "leaves": {
                    "pending": 0,
                    "approved": 0,
                    "rejected": 0,
                    "total_requests": 0,
                },
                "performance": {
                    "review_count": 0,
                    "average_rating": None,
                },
            }

        employee_query = db.query(Employee).filter(
            Employee.id == employee.id
        )

    else:
        employee_query = db.query(Employee)

        if department:
            employee_query = employee_query.filter(
                Employee.department.ilike(department.strip())
            )

    employees = employee_query.all()
    employee_ids = [employee.id for employee in employees]

    attendance_query = db.query(Attendance).filter(
        Attendance.employee_id.in_(employee_ids)
    )

    leave_query = db.query(Leave).filter(
        Leave.employee_id.in_(employee_ids)
    )

    performance_query = db.query(PerformanceReview).filter(
        PerformanceReview.employee_id.in_(employee_ids)
    )

    # Attendance date filters.
    if start_date:
        attendance_query = attendance_query.filter(
            Attendance.date >= start_date
        )

    if end_date:
        attendance_query = attendance_query.filter(
            Attendance.date <= end_date
        )

    # Leave requests overlapping the selected reporting period.
    if start_date:
        leave_query = leave_query.filter(
            Leave.end_date >= start_date
        )

    if end_date:
        leave_query = leave_query.filter(
            Leave.start_date <= end_date
        )

    # Performance review creation date filters.
    if start_date:
        performance_query = performance_query.filter(
            PerformanceReview.created_at >= datetime.combine(
                start_date, time.min
            )
        )

    if end_date:
        performance_query = performance_query.filter(
            PerformanceReview.created_at < datetime.combine(
                end_date + timedelta(days=1), time.min
            )
        )

    attendance_records = attendance_query.all()
    leave_records = leave_query.all()
    performance_records = performance_query.all()

    # Attendance statistics.
    present_count = sum(
        1 for item in attendance_records
        if (item.status or "").upper() == "PRESENT"
    )

    absent_count = sum(
        1 for item in attendance_records
        if (item.status or "").upper() == "ABSENT"
    )

    half_day_count = sum(
        1 for item in attendance_records
        if (item.status or "").upper() == "HALF_DAY"
    )

    working_hours = [
        item.working_hours
        for item in attendance_records
        if item.working_hours is not None
    ]

    average_working_hours = (
        round(sum(working_hours) / len(working_hours), 2)
        if working_hours
        else None
    )

    # Leave statistics.
    pending_leaves = sum(
        1 for item in leave_records
        if (item.status or "").upper() == "PENDING"
    )

    approved_leaves = sum(
        1 for item in leave_records
        if (item.status or "").upper() == "APPROVED"
    )

    rejected_leaves = sum(
        1 for item in leave_records
        if (item.status or "").upper() == "REJECTED"
    )

    # Performance statistics.
    ratings = [
        item.rating
        for item in performance_records
        if item.rating is not None
    ]

    average_rating = (
        round(sum(ratings) / len(ratings), 2)
        if ratings
        else None
    )

    if manager_access:
        scope = "organization"
        employee_details = None
    else:
        scope = "employee"
        linked_employee = employees[0] if employees else None

        employee_details = (
            {
                "id": linked_employee.id,
                "full_name": linked_employee.full_name,
            }
            if linked_employee
            else None
        )

    return {
        "scope": scope,
        "employee": employee_details,
        "filters": {
            "start_date": start_date,
            "end_date": end_date,
            "department": department,
        },
        "employee_count": len(employee_ids),
        "attendance": {
            "present": present_count,
            "absent": absent_count,
            "half_day": half_day_count,
            "total_records": len(attendance_records),
            "average_working_hours": average_working_hours,
        },
        "leaves": {
            "pending": pending_leaves,
            "approved": approved_leaves,
            "rejected": rejected_leaves,
            "total_requests": len(leave_records),
        },
        "performance": {
            "review_count": len(performance_records),
            "average_rating": average_rating,
        },
    }


# =========================================================
# Existing endpoint: Analytics summary
# =========================================================

@router.get("/summary")
def get_analytics_summary(
    start_date: Optional[date] = Query(
        default=None,
        description="Start date in YYYY-MM-DD format",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="End date in YYYY-MM-DD format",
    ),
    department: Optional[str] = Query(
        default=None,
        description="Department filter for HR/Admin",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return role-restricted employee and organization analytics."""

    return build_analytics_summary(
        start_date=start_date,
        end_date=end_date,
        department=department,
        db=db,
        current_user=current_user,
    )


# =========================================================
# Existing endpoint: Department report
# =========================================================

@router.get("/departments")
def get_department_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return employee counts by department for HR/Admin."""

    if not is_hr_or_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only HR or Admin can view department reports.",
        )

    employees = db.query(Employee).all()
    department_counts = {}

    for employee in employees:
        department_name = employee.department or "Unassigned"
        department_counts[department_name] = (
            department_counts.get(department_name, 0) + 1
        )

    return {
        "total_employees": len(employees),
        "departments": [
            {
                "department": name,
                "employee_count": count,
            }
            for name, count in sorted(department_counts.items())
        ],
    }


# =========================================================
# Module 25: CSV export
# =========================================================

@router.get("/export/csv")
def export_analytics_csv(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    department: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the permitted analytics summary as a CSV file."""

    report = build_analytics_summary(
        start_date=start_date,
        end_date=end_date,
        department=department,
        db=db,
        current_user=current_user,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["WorkSphere HRMS - Analytics Report"])
    writer.writerow([
        "Generated At",
        datetime.now().isoformat(timespec="seconds"),
    ])
    writer.writerow(["Report Scope", report.get("scope", "")])
    writer.writerow(["Employee Count", report.get("employee_count", 0)])

    employee_details = report.get("employee")
    if employee_details:
        writer.writerow(["Employee ID", employee_details["id"]])
        writer.writerow(["Employee Name", employee_details["full_name"]])

    writer.writerow([])
    writer.writerow(["Section", "Metric", "Value"])

    for section in ("attendance", "leaves", "performance", "filters"):
        for key, value in report.get(section, {}).items():
            writer.writerow([
                section.title(),
                key.replace("_", " ").title(),
                "" if value is None else value,
            ])

    # BOM helps Excel recognize UTF-8.
    csv_content = "\ufeff" + output.getvalue()
    filename = f"worksphere_analytics_{date.today().isoformat()}.csv"

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


# =========================================================
# Module 25: PDF export
# =========================================================

@router.get("/export/pdf")
def export_analytics_pdf(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    department: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the permitted analytics summary as a PDF file."""

    report = build_analytics_summary(
        start_date=start_date,
        end_date=end_date,
        department=department,
        db=db,
        current_user=current_user,
    )

    buffer = io.BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    content = [
        Paragraph("WorkSphere HRMS", styles["Title"]),
        Paragraph("Analytics and Reports", styles["Heading2"]),
        Paragraph(
            f"Generated: {datetime.now().strftime('%d-%m-%Y %H:%M')}",
            styles["Normal"],
        ),
        Spacer(1, 0.2 * inch),
    ]

    rows = [["Metric", "Value"]]
    rows.append(["Report Scope", str(report.get("scope", ""))])
    rows.append(["Employee Count", str(report.get("employee_count", 0))])

    employee_details = report.get("employee")
    if employee_details:
        rows.append(["Employee ID", str(employee_details["id"])])
        rows.append(["Employee Name", str(employee_details["full_name"])])

    for section in ("attendance", "leaves", "performance", "filters"):
        rows.append([section.title(), ""])

        for key, value in report.get(section, {}).items():
            display_value = "Not available" if value is None else str(value)

            rows.append([
                f"  {key.replace('_', ' ').title()}",
                display_value,
            ])

    table = Table(
        rows,
        colWidths=[3.4 * inch, 2.5 * inch],
        repeatRows=1,
    )

    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17365D")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("LEADING", (0, 0), (-1, -1), 12),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 1), (-1, -1), colors.whitesmoke),
        ])
    )

    content.append(table)
    content.append(Spacer(1, 0.2 * inch))
    content.append(
        Paragraph(
            "Confidential - WorkSphere HRMS",
            styles["Italic"],
        )
    )

    document.build(content)
    buffer.seek(0)

    filename = f"worksphere_analytics_{date.today().isoformat()}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
