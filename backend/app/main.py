from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine

# =========================================================
# Import all models before creating database tables
# =========================================================

from app.models import (
    User,
    Employee,
    Attendance,
    Leave,
    Payroll,
    LeavePolicy,
    LeaveBalance,
)

# Module 14: Shift Management
from app.models.shift import Shift, EmployeeShift

# Module 16: Document Management
from app.models.document import Document

# Module 17: Performance Management
from app.models.performance import PerformanceReview

# Module 19: Notification Management
from app.models.notification import Notification


# =========================================================
# Import API routers
# =========================================================

from app.routes.auth import router as auth_router
from app.routes.employees import router as employees_router
from app.routes.attendance import router as attendance_router
from app.routes.leaves import router as leaves_router
from app.routes.dashboard import router as dashboard_router
from app.routes.leave_policies import router as leave_policies_router
from app.routes.payroll import router as payroll_router
from app.routes.admin import router as admin_router

# Module 14: Shift Management
from app.routes.shifts import router as shifts_router

# Module 16: Document Management
from app.routes.documents import router as documents_router

# Module 17: Performance Management
from app.routes.performance import router as performance_router

# Module 18: Analytics & Reports
from app.routes.analytics import router as analytics_router

# Module 19: Notification Management
from app.routes.notifications import router as notifications_router


# =========================================================
# Create database tables
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# Initialize FastAPI application
# =========================================================

app = FastAPI(
    title="WorkSphere HRMS API",
    description="Human Resource Management System API",
    version="1.0.0",
)


# =========================================================
# Configure CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Register API routers
# =========================================================

# Module 1: Authentication
app.include_router(auth_router)

# Module 2: Employee Management
app.include_router(employees_router)

# Module 3: Attendance Management
app.include_router(attendance_router)

# Module 4: Leave Management
app.include_router(leaves_router)

# Dashboard
app.include_router(dashboard_router)

# Leave Policies
app.include_router(leave_policies_router)

# Module 5: Payroll Management
app.include_router(payroll_router)

# Admin Management
app.include_router(admin_router)

# Module 14: Shift Management
app.include_router(shifts_router)

# Module 16: Document Management
app.include_router(documents_router)

# Module 17: Performance Management
app.include_router(performance_router)

# Module 18: Analytics & Reports
app.include_router(analytics_router)

# Module 19: Notification Management
app.include_router(notifications_router)


# =========================================================
# Root endpoint
# =========================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API"
    }


# =========================================================
# Health check endpoint
# =========================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
