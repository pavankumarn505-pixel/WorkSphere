
import logging
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.attendance import Attendance
from app.models.employee import Employee
from app.models.leave import Leave
from app.models.shift import EmployeeShift, Shift

logger = logging.getLogger(__name__)

# Wait 10 minutes after a shift ends before marking absence.
SHIFT_END_GRACE_MINUTES = 10


def get_shift_end_datetime(
    shift_date: date,
    shift: Shift,
) -> datetime:
    """Calculate the actual end datetime, including overnight shifts."""

    shift_end = datetime.combine(shift_date, shift.end_time)

    # Example: a shift starts at 22:00 and ends at 06:00.
    if shift.end_time <= shift.start_time:
        shift_end += timedelta(days=1)

    return shift_end


def employee_has_approved_leave(
    db: Session,
    employee_id: int,
    shift_date: date,
) -> bool:
    """Return True if approved leave covers the shift date."""

    approved_leave = (
        db.query(Leave.id)
        .filter(
            Leave.employee_id == employee_id,
            func.upper(Leave.status) == "APPROVED",
            Leave.start_date <= shift_date,
            Leave.end_date >= shift_date,
        )
        .first()
    )

    return approved_leave is not None


def run_absence_check() -> int:
    """
    Mark active employees absent when:
    1. They have an assigned shift.
    2. The shift has ended and the grace period has passed.
    3. No attendance record exists for that shift date.
    4. They do not have approved leave.

    Returns the number of absence records created.
    """

    db = SessionLocal()
    created_count = 0

    try:
        now = datetime.now()

        # Check yesterday and today to support overnight shifts.
        candidate_dates = [
            now.date() - timedelta(days=1),
            now.date(),
        ]

        assignments = (
            db.query(EmployeeShift, Employee, Shift)
            .join(
                Employee,
                Employee.id == EmployeeShift.employee_id,
            )
            .join(
                Shift,
                Shift.id == EmployeeShift.shift_id,
            )
            .filter(Employee.status == "ACTIVE")
            .all()
        )

        for assignment, employee, shift in assignments:
            for shift_date in candidate_dates:

                if shift_date > now.date():
                    continue

                shift_end = get_shift_end_datetime(
                    shift_date,
                    shift,
                )

                absence_cutoff = shift_end + timedelta(
                    minutes=SHIFT_END_GRACE_MINUTES
                )

                # Do not mark absence before the shift has ended
                # and the grace period has passed.
                if now < absence_cutoff:
                    continue

                existing_attendance = (
                    db.query(Attendance.id)
                    .filter(
                        Attendance.employee_id == employee.id,
                        Attendance.date == shift_date,
                    )
                    .first()
                )

                # Do not create duplicate or conflicting records.
                if existing_attendance is not None:
                    continue

                # Approved leave prevents automatic absence.
                if employee_has_approved_leave(
                    db,
                    employee.id,
                    shift_date,
                ):
                    continue

                absent_record = Attendance(
                    employee_id=employee.id,
                    date=shift_date,
                    check_in=None,
                    check_out=None,
                    status="ABSENT",
                )

                try:
                    db.add(absent_record)
                    db.commit()
                    created_count += 1

                    logger.info(
                        "Auto-marked absent: employee_id=%s, "
                        "date=%s, shift=%s",
                        employee.id,
                        shift_date,
                        shift.name,
                    )

                except IntegrityError:
                    # Another request may have created the record.
                    db.rollback()

        logger.info(
            "Automatic absence check finished. Records created: %s",
            created_count,
        )

        return created_count

    except Exception:
        db.rollback()
        logger.exception("Automatic absence check failed.")
        raise

    finally:
        db.close()
