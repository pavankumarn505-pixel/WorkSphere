import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import AttendanceAnalytics from "./pages/AttendanceAnalytics";
import LeaveApplication from "./pages/LeaveApplication";
import LeaveStatus from "./pages/LeaveStatus";
import LeaveApprovals from "./pages/LeaveApprovals";
import LeaveBalance from "./pages/LeaveBalance";
import Profile from "./pages/Profile";
import Employees from "./pages/Employees";
import Payroll from "./pages/Payroll";
import AdminUsers from "./pages/AdminUsers";

import "./App.css";

function getToken() {
  return (
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token")
  );
}

function getRole() {
  return (
    sessionStorage.getItem("user_role") ||
    localStorage.getItem("user_role") ||
    ""
  ).toUpperCase();
}

function getDashboardPath() {
  const role = getRole();

  if (role === "ADMIN") return "/admin";
  if (role === "HR") return "/hr";
  if (role === "EMPLOYEE") return "/employee";

  return "/";
}

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

function AppLayout({ children }) {
  const navigate = useNavigate();
  const role = getRole();

  function handleLogout() {
    const keys = [
      "access_token",
      "user_role",
      "user_id",
      "user_email",
    ];

    keys.forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });

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
          <NavLink
            to={getDashboardPath()}
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Dashboard
          </NavLink>

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

          {["HR", "ADMIN"].includes(role) && (
            <NavLink
              to="/employees"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Employees
            </NavLink>
          )}

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            My Profile
          </NavLink>

          <NavLink
            to="/attendance"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Attendance
          </NavLink>

          {["HR", "ADMIN"].includes(role) && (
            <NavLink
              to="/attendance/analytics"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Attendance Analytics
            </NavLink>
          )}

          <NavLink
            to="/leaves/balance"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Leave Balance
          </NavLink>

          <NavLink
            to="/leaves/apply"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Apply for Leave
          </NavLink>

          <NavLink
            to="/leaves/status"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Leave Status
          </NavLink>

          {["HR", "ADMIN"].includes(role) && (
            <NavLink
              to="/leaves/approvals"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Leave Approvals
            </NavLink>
          )}

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

function DashboardRoute() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}

function EmployeeHome() {
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
        <Route path="/" element={<Login />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <DashboardRoute />
            </ProtectedRoute>
          }
        />

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
              <EmployeeHome />
            </ProtectedRoute>
          }
        />

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

        {/* Payroll: accessible to all logged-in roles */}
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