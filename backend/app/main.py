from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine

# Import all models before creating database tables.
from app.models import (
    User,
    Employee,
    Attendance,
    Leave,
    Payroll,
    LeavePolicy,
    LeaveBalance,
)

# Import API routers.
from app.routes.auth import router as auth_router
from app.routes.employees import router as employees_router
from app.routes.attendance import router as attendance_router
from app.routes.leaves import router as leaves_router
from app.routes.dashboard import router as dashboard_router
from app.routes.leave_policies import router as leave_policies_router
from app.routes.payroll import router as payroll_router

# Module 13: Admin User Management.
from app.routes.admin import router as admin_router


# Create tables for all registered models.
Base.metadata.create_all(bind=engine)


# Initialize the FastAPI application.
app = FastAPI(
    title="WorkSphere HRMS API",
    description="Human Resource Management System API",
    version="1.0.0",
)


# Allow requests from the configured React frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers.
app.include_router(auth_router)
app.include_router(employees_router)
app.include_router(attendance_router)
app.include_router(leaves_router)
app.include_router(dashboard_router)
app.include_router(leave_policies_router)
app.include_router(payroll_router)

# Module 13: Admin User Management endpoints.
app.include_router(admin_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
