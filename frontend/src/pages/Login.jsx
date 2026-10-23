import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const data = response.data;
      const token = data.access_token;
      const role = data.user?.role ?? data.role;

      if (!token) {
        setError("Login failed: access token was not returned by the server.");
        return;
      }

      if (!role) {
        setError("Login failed: user role was not returned by the server.");
        return;
      }

      const normalizedRole = String(role).toUpperCase();

      const dashboardRoutes = {
        ADMIN: "/admin",
        HR: "/hr",
        EMPLOYEE: "/employee",
      };

      const dashboard = dashboardRoutes[normalizedRole];

      if (!dashboard) {
        setError("Your account has an unrecognized role.");
        return;
      }

      // Store login information for this browser session.
      sessionStorage.setItem("access_token", token);
      sessionStorage.setItem("user_role", normalizedRole);

      navigate(dashboard, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        // FastAPI validation errors are commonly arrays of objects.
        const messages = detail.map((item) => {
          const field = Array.isArray(item.loc)
            ? item.loc[item.loc.length - 1]
            : "input";

          return `${field}: ${item.msg || "Invalid value"}`;
        });

        setError(messages.join(". "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (err.response?.status === 422) {
        setError(
          "The login data format does not match the backend. Please check the login request fields."
        );
      } else if (err.response?.status === 401) {
        setError("Invalid email or password.");
      } else if (err.response?.status === 403) {
        setError("You are not authorized to log in.");
      } else {
        setError(
          "Unable to log in. Please check your backend server and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-decoration">
        <div className="brand">
          <div className="brand-icon">W</div>
          <span>WorkSphere</span>
        </div>

        <div className="welcome-content">
          <span className="eyebrow">
            PEOPLE. PURPOSE. PROGRESS.
          </span>

          <h1>Great teams start with great people.</h1>

          <p>
            Manage your workforce, attendance, leave, and
            payroll — all in one place.
          </p>

          <div className="feature-tags">
            <span>Employee Management</span>
            <span>Smart Attendance</span>
            <span>HR Analytics</span>
          </div>
        </div>

        <p className="copyright">
          © 2026 WorkSphere HRMS
        </p>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="mobile-brand">
            <div className="brand-icon">W</div>
            <span>WorkSphere</span>
          </div>

          <span className="eyebrow">WELCOME BACK</span>

          <h2>Sign in to your account</h2>

          <p className="login-description">
            Enter your credentials to access your workspace.
          </p>

          <label htmlFor="email">Email address</label>

          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            disabled={loading}
          />

          <div className="password-label">
            <label htmlFor="password">Password</label>
          </div>

          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={loading}
          />

          {error && (
  <div className="error-message" role="alert">
    {typeof error === "string"
      ? error
      : "Login failed. Please check your credentials and try again."}
  </div>
)}

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>

          <div className="security-note">
            <span aria-hidden="true">🔒</span>
            Secure access to your workspace
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;