
import { useEffect, useState } from "react";
import "./Performance.css";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

function Performance() {
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState("");
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const token = getToken();

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async function loadEmployees() {
    try {
      const response = await fetch(`${API_URL}/employees/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Could not load employees.");
      }

      const data = await response.json();

      // Supports APIs that return an array or { employees: [...] }.
      const employeeList = Array.isArray(data)
        ? data
        : data.employees || data.items || [];

      setEmployees(employeeList);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadReviews(employee = employeeFilter) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const query = employee
        ? `?employee_id=${encodeURIComponent(employee)}`
        : "";

      const response = await fetch(
        `${API_URL}/performance/${query}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load reviews.");
      }

      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setError("Please log in to access Performance Management.");
      return;
    }

    loadEmployees();
    loadReviews("");
    // Initial loading only; filters are handled by the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!employeeId || !reviewPeriod.trim() || !feedback.trim()) {
      setError("Please complete all fields.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/performance/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          employee_id: Number(employeeId),
          review_period: reviewPeriod.trim(),
          rating: Number(rating),
          feedback: feedback.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not create the performance review."
        );
      }

      setMessage("Performance review created successfully.");
      setReviewPeriod("");
      setRating("5");
      setFeedback("");
      setEmployeeFilter("");
      await loadReviews("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="performance-page">
      <header className="performance-header">
        <div>
          <p className="performance-eyebrow">PEOPLE DEVELOPMENT</p>
          <h1>Performance Management</h1>
          <p className="performance-subtitle">
            Review employee progress, ratings, and feedback.
          </p>
        </div>

        <div className="performance-total">
          <span>Total reviews</span>
          <strong>{reviews.length}</strong>
        </div>
      </header>

      {!token && (
        <div className="performance-alert error">
          Please log in to continue.
        </div>
      )}

      {error && (
        <div className="performance-alert error">{error}</div>
      )}

      {message && (
        <div className="performance-alert success">{message}</div>
      )}

      <section className="performance-card">
        <h2>Create Performance Review</h2>
        <p className="performance-help">
          Select an employee and record their performance for a review period.
        </p>

        <form onSubmit={handleSubmit} className="performance-form">
          <div className="performance-field">
            <label htmlFor="employeeId">Employee</label>
            <select
              id="employeeId"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
            >
              <option value="">Select an employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name || employee.name || `Employee ${employee.id}`}
                  {" — ID "}
                  {employee.id}
                </option>
              ))}
            </select>
          </div>

          <div className="performance-field">
            <label htmlFor="reviewPeriod">Review period</label>
            <input
              id="reviewPeriod"
              type="text"
              placeholder="e.g. Annual 2026"
              value={reviewPeriod}
              onChange={(event) => setReviewPeriod(event.target.value)}
              maxLength={50}
              required
            />
          </div>

          <div className="performance-field">
            <label htmlFor="rating">Rating</label>
            <select
              id="rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              required
            >
              <option value="5">5 — Excellent</option>
              <option value="4">4 — Very good</option>
              <option value="3">3 — Meets expectations</option>
              <option value="2">2 — Needs improvement</option>
              <option value="1">1 — Unsatisfactory</option>
            </select>
          </div>

          <div className="performance-field full-width">
            <label htmlFor="feedback">Feedback</label>
            <textarea
              id="feedback"
              rows="4"
              placeholder="Enter clear, constructive performance feedback..."
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              required
            />
          </div>

          <div className="performance-actions full-width">
            <button type="submit" disabled={saving || !token}>
              {saving ? "Saving..." : "Create Review"}
            </button>
          </div>
        </form>
      </section>

      <section className="performance-card">
        <div className="performance-list-header">
          <div>
            <h2>Review History</h2>
            <p className="performance-help">
              Browse performance reviews available to your account.
            </p>
          </div>

          <div className="performance-filter">
            <label htmlFor="employeeFilter">Employee ID</label>
            <input
              id="employeeFilter"
              type="number"
              min="1"
              placeholder="All employees"
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
            />
            <button
              type="button"
              onClick={() => loadReviews()}
              disabled={loading || !token}
            >
              Filter
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEmployeeFilter("");
                loadReviews("");
              }}
              disabled={loading || !token}
            >
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <p className="performance-empty">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="performance-empty">
            No performance reviews found.
          </p>
        ) : (
          <div className="performance-table-wrapper">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Review ID</th>
                  <th>Employee ID</th>
                  <th>Period</th>
                  <th>Rating</th>
                  <th>Feedback</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>#{review.id}</td>
                    <td>{review.employee_id}</td>
                    <td>{review.review_period}</td>
                    <td>
                      <span className="performance-rating">
                        {review.rating} / 5
                      </span>
                    </td>
                    <td className="performance-feedback">
                      {review.feedback}
                    </td>
                    <td>
                      {review.created_at
                        ? new Date(review.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default Performance;
