
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";

import { useCallback, useEffect, useState } from "react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import AttendanceAnalytics from "./pages/AttendanceAnalytics";
import LeaveApplication from "./pages/LeaveApplication";
import LeaveStatus from "./pages/LeaveStatus";
import LeaveApprovals from "./pages/LeaveApprovals";
import LeaveBalance from "./pages/LeaveBalance";
import LeaveCalendar from "./pages/LeaveCalendar";
import Profile from "./pages/Profile";
import Employees from "./pages/Employees";
import Payroll from "./pages/Payroll";
import AdminUsers from "./pages/AdminUsers";
import Shifts from "./pages/Shifts";
import Onboarding from "./pages/Onboarding";

// Module 22: Resignation & Exit Management
import Resignations from "./pages/Resignations";

// Module 23: Internal Announcements
import Announcements from "./pages/Announcements";

// Module 24: Task Assignment & Tracking
import Tasks from "./pages/Tasks";

// Module 26: Employee Feedback
import Feedback from "./pages/Feedback";

import Performance from "./Performance";
import Analytics from "./Analytics";
import Notifications from "./components/Notifications";

import "./App.css";

const API_URL = "http://127.0.0.1:8000";

// Get the login token from localStorage or sessionStorage.
function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

// Get the current user's role.
function getRole() {
  return (
    localStorage.getItem("user_role") ||
    sessionStorage.getItem("user_role") ||
    ""
  ).toUpperCase();
}

// Get the correct dashboard based on the user's role.
function getDashboardPath() {
  const role = getRole();

  if (role === "ADMIN") return "/admin";
  if (role === "HR") return "/hr";
  if (role === "EMPLOYEE") return "/employee";

  return "/";
}

// Protect routes from unauthorized access.
function ProtectedRoute({ children, allowedRoles }) {
  const token = getToken();
  const role = getRole();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardPath()} replace />;
  }

  return children;
}

// Shared navigation layout.
function AppLayout({ children }) {
  const navigate = useNavigate();
  const role = getRole();
  const isHRorAdmin = ["HR", "ADMIN"].includes(role);

  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count from FastAPI.
  const fetchUnreadCount = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/notifications/unread-count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const count =
        typeof data === "number"
          ? data
          : data.unread_count ?? data.count ?? data.unread ?? 0;

      setUnreadCount(Math.max(0, Number(count) || 0));
    } catch (error) {
      console.error(
        "Unable to fetch unread notification count:",
        error
      );
    }
  }, []);

  // Load initially and refresh every 30 seconds.
  useEffect(() => {
    fetchUnreadCount();

    const intervalId = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(intervalId);
  }, [fetchUnreadCount]);

  // Clear authentication data during logout.
  function handleLogout() {
    const keys = [
      "access_token",
      "token",
      "user_role",
      "user_id",
      "user_email",
    ];

    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    setUnreadCount(0);
    navigate("/", { replace: true });
  }

  return (
    <>
      <header className="app-navigation">
        <div className="app-navigation-brand">
          <span className="app-brand-icon">W</span>
          <span>WorkSphere</span>
        </div>

        <nav
          className="app-navigation-links"
          aria-label="Main navigation"
        >
          {/* Dashboard */}
          <NavLink
            to={getDashboardPath()}
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Dashboard
          </NavLink>

          {/* Module 19: Notifications */}
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            <span>Notifications</span>

            {unreadCount > 0 && (
              <span
                className="notification-badge"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </NavLink>

          {/* Module 23: Internal Announcements */}
          <NavLink
            to="/announcements"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Announcements
          </NavLink>

          {/* Module 24: Task Assignment & Tracking */}
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            My Tasks
          </NavLink>

          {/* Module 26: Employee Feedback */}
          <NavLink
            to="/feedback"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            {isHRorAdmin ? "Feedback Dashboard" : "My Feedback"}
          </NavLink>

          {/* Admin navigation */}
          {role === "ADMIN" && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Admin Users
            </NavLink>
          )}

          {/* HR and Admin navigation */}
          {isHRorAdmin && (
            <>
              <NavLink
                to="/employees"
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                Employees
              </NavLink>

              <NavLink
                to="/shifts"
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                Shift Management
              </NavLink>

              <NavLink
                to="/performance"
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                Performance Management
              </NavLink>

              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                Analytics &amp; Reports
              </NavLink>

              <NavLink
                to="/attendance/analytics"
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                Attendance Analytics
              </NavLink>

              <NavLink
                to="/leaves/approvals"
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                Leave Approvals
              </NavLink>
            </>
          )}

          {/* Module 21: Employee Onboarding */}
          <NavLink
            to="/onboarding"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            My Onboarding
          </NavLink>

          {/* Module 22: Resignation & Exit Management */}
          <NavLink
            to="/resignations"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Resignation &amp; Exit
          </NavLink>

          {/* Profile */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            My Profile
          </NavLink>

          {/* Attendance */}
          <NavLink
            to="/attendance"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Attendance
          </NavLink>

          {/* Leave Balance */}
          <NavLink
            to="/leaves/balance"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Leave Balance
          </NavLink>

          {/* Apply for Leave */}
          <NavLink
            to="/leaves/apply"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Apply for Leave
          </NavLink>

          {/* Leave Status */}
          <NavLink
            to="/leaves/status"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Leave Status
          </NavLink>

          {/* Leave Calendar */}
          <NavLink
            to="/leaves/calendar"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Leave Calendar &amp; Team View
          </NavLink>

          {/* Payroll */}
          <NavLink
            to="/payroll"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Payroll
          </NavLink>
        </nav>

        <button
          type="button"
          className="app-logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      <main>{children}</main>
    </>
  );
}

// Reusable dashboard layout.
function DashboardRoute() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />

        {/* Role-specific dashboards */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <DashboardRoute />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr"
          element={
            <ProtectedRoute allowedRoles={["HR"]}>
              <DashboardRoute />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <DashboardRoute />
            </ProtectedRoute>
          }
        />

        {/* Admin user management */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AppLayout>
                <AdminUsers />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Employee management */}
        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={["HR", "ADMIN"]}>
              <AppLayout>
                <Employees />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 14: Shift Management */}
        <Route
          path="/shifts"
          element={
            <ProtectedRoute allowedRoles={["HR", "ADMIN"]}>
              <AppLayout>
                <Shifts />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 17: Performance Management */}
        <Route
          path="/performance"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Performance />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 18: Analytics and Reports */}
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Analytics />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 19: Notification Management */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Notifications />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 23: Internal Announcements */}
        <Route
          path="/announcements"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Announcements />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 24: Task Assignment & Tracking */}
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Tasks />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 26: Employee Feedback */}
        <Route
          path="/feedback"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Feedback />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 21: Employee Onboarding */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Onboarding />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 22: Resignation & Exit Management */}
        <Route
          path="/resignations"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Resignations />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Profile />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Attendance */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Attendance />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Attendance Analytics */}
        <Route
          path="/attendance/analytics"
          element={
            <ProtectedRoute allowedRoles={["HR", "ADMIN"]}>
              <AppLayout>
                <AttendanceAnalytics />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Leave Balance */}
        <Route
          path="/leaves/balance"
          element={
            <ProtectedRoute>
              <AppLayout>
                <LeaveBalance />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Apply for Leave */}
        <Route
          path="/leaves/apply"
          element={
            <ProtectedRoute>
              <AppLayout>
                <LeaveApplication />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Leave Status */}
        <Route
          path="/leaves/status"
          element={
            <ProtectedRoute>
              <AppLayout>
                <LeaveStatus />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Leave Approvals */}
        <Route
          path="/leaves/approvals"
          element={
            <ProtectedRoute allowedRoles={["HR", "ADMIN"]}>
              <AppLayout>
                <LeaveApprovals />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Module 15: Leave Calendar */}
        <Route
          path="/leaves/calendar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <LeaveCalendar />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Payroll */}
        <Route
          path="/payroll"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Payroll />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Unknown routes */}
        <Route
          path="*"
          element={
            <Navigate to={getDashboardPath()} replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
