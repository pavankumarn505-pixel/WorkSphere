
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./Leave.css";

function LeaveStatus() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/leaves/me");
      setLeaves(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load your leave history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const pendingCount = leaves.filter(
    (leave) => leave.status === "PENDING"
  ).length;

  const approvedCount = leaves.filter(
    (leave) => leave.status === "APPROVED"
  ).length;

  const rejectedCount = leaves.filter(
    (leave) => leave.status === "REJECTED"
  ).length;

  return (
    <main className="leave-page">
      <header className="leave-header">
        <div>
          <p className="leave-eyebrow">MY REQUESTS</p>
          <h1>Leave Status</h1>
          <p>Track your submitted leave applications.</p>
        </div>

        <Link className="leave-primary-link" to="/leaves/apply">
          + Apply for Leave
        </Link>
      </header>

      {error && (
        <div className="leave-alert leave-alert-error" role="alert">
          {error}
          <button
            className="leave-retry-button"
            type="button"
            onClick={loadLeaves}
          >
            Try Again
          </button>
        </div>
      )}

      <section className="leave-summary-grid">
        <article className="leave-summary-card">
          <span>Total Requests</span>
          <strong>{leaves.length}</strong>
        </article>

        <article className="leave-summary-card">
          <span>Pending</span>
          <strong>{pendingCount}</strong>
        </article>

        <article className="leave-summary-card">
          <span>Approved</span>
          <strong>{approvedCount}</strong>
        </article>

        <article className="leave-summary-card">
          <span>Rejected</span>
          <strong>{rejectedCount}</strong>
        </article>
      </section>

      <section className="leave-history-card">
        <div className="leave-history-heading">
          <div>
            <h2>My Leave Applications</h2>
            <p className="leave-muted">
              Your requests and their latest recorded status.
            </p>
          </div>

          <button
            className="leave-refresh-button"
            type="button"
            onClick={loadLeaves}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="leave-empty-message">
            Loading your leave applications...
          </p>
        ) : error ? (
          <p className="leave-empty-message">
            Please resolve the error above to view your requests.
          </p>
        ) : leaves.length === 0 ? (
          <div className="leave-empty-message">
            <h3>No leave applications yet</h3>
            <p>When you submit a request, it will appear here.</p>
            <Link to="/leaves/apply">Apply for Leave</Link>
          </div>
        ) : (
          <div className="leave-table-wrapper">
            <table className="leave-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Leave Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>#{leave.id}</td>
                    <td>{leave.leave_type}</td>
                    <td>{leave.start_date}</td>
                    <td>{leave.end_date}</td>
                    <td className="leave-reason-cell">
                      {leave.reason}
                    </td>
                    <td>
                      <span
                        className={`leave-status leave-status-${leave.status.toLowerCase()}`}
                      >
                        {leave.status}
                      </span>
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

export default LeaveStatus;
