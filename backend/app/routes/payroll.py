
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.database import get_db
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.user import User
from app.schemas_payroll import (
    PayrollCreate,
    PayrollEmployeeResponse,
    PayrollResponse,
)

router = APIRouter(prefix="/payroll", tags=["Payroll"])

HR_ADMIN = require_roles("HR", "ADMIN")
CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def payroll_to_response(record: Payroll) -> dict:
    return {
        "id": record.id,
        "employee_id": record.employee_id,
        "employee_name": record.employee.full_name,
        "basic_salary": record.basic_salary,
        "allowances": record.allowances,
        "deductions": record.deductions,
        "bonus": record.bonus,
        "gross_salary": record.gross_salary,
        "net_salary": record.net_salary,
        "month": record.month,
        "created_at": record.created_at,
    }


def valid_month(month: str) -> bool:
    return bool(re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month))


@router.post(
    "/",
    response_model=PayrollResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payroll(
    payload: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(HR_ADMIN),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == payload.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    basic = money(payload.basic_salary)
    allowances = money(payload.allowances)
    bonus = money(payload.bonus)
    deductions = money(payload.deductions)

    gross = money(basic + allowances + bonus)
    net = money(gross - deductions)

    if net < 0:
        raise HTTPException(
            status_code=400,
            detail="Deductions cannot exceed gross salary",
        )

    record = Payroll(
        employee_id=employee.id,
        basic_salary=basic,
        allowances=allowances,
        deductions=deductions,
        bonus=bonus,
        gross_salary=gross,
        net_salary=net,
        month=payload.month,
    )

    db.add(record)

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Payroll already exists for this employee and month",
        )

    return record


@router.get("/", response_model=list[PayrollEmployeeResponse])
def list_payroll(
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(HR_ADMIN),
):
    query = db.query(Payroll).join(Employee)

    if month is not None:
        if not valid_month(month):
            raise HTTPException(
                status_code=400,
                detail="Month must use YYYY-MM format",
            )
        query = query.filter(Payroll.month == month)

    records = query.order_by(
        Payroll.month.desc(),
        Employee.full_name.asc(),
    ).all()

    return [payroll_to_response(record) for record in records]


@router.get("/me", response_model=list[PayrollResponse])
def my_payroll_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee profile is linked to your account",
        )

    return (
        db.query(Payroll)
        .filter(Payroll.employee_id == employee.id)
        .order_by(Payroll.month.desc())
        .all()
    )


@router.get("/me/{payroll_id}", response_model=PayrollResponse)
def my_payslip(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee profile is linked to your account",
        )

    record = (
        db.query(Payroll)
        .filter(
            Payroll.id == payroll_id,
            Payroll.employee_id == employee.id,
        )
        .first()
    )

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Payslip not found",
        )

    return record


@router.get("/summary")
def payroll_summary(
    month: str = Query(..., description="Payroll month in YYYY-MM format"),
    db: Session = Depends(get_db),
    current_user: User = Depends(HR_ADMIN),
):
    if not valid_month(month):
        raise HTTPException(
            status_code=400,
            detail="Month must use YYYY-MM format",
        )

    records = db.query(Payroll).filter(Payroll.month == month).all()

    return {
        "month": month,
        "employee_count": len(records),
        "basic_salary_total": money(
            sum((r.basic_salary for r in records), Decimal("0.00"))
        ),
        "allowances_total": money(
            sum((r.allowances for r in records), Decimal("0.00"))
        ),
        "bonus_total": money(
            sum((r.bonus for r in records), Decimal("0.00"))
        ),
        "deductions_total": money(
            sum((r.deductions for r in records), Decimal("0.00"))
        ),
        "gross_salary_total": money(
            sum((r.gross_salary for r in records), Decimal("0.00"))
        ),
        "net_salary_total": money(
            sum((r.net_salary for r in records), Decimal("0.00"))
        ),
    }
