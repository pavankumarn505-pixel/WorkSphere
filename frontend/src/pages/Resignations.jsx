
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import "./Resignations.css";

function getRole() {
  return (
    localStorage.getItem("user_role") ||
    sessionStorage.getItem("user_role") ||
    ""
  ).toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Resignations() {
  const role = getRole();
  const isHR = ["HR", "ADMIN"].includes(role);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [reason, setReason] = useState("");
  const [resignationDate, setResignationDate] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");

  const [comments, setComments] = useState({});
  const [decidingId, setDecidingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = isHR
        ? await api.get("/resignations/")
        : await api.get("/resignations/me");

      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load resignation requests. Check your login and backend."
      );
    } finally {
      setLoading(false);
    }
  }, [isHR]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (lastWorkingDate < resignationDate) {
      setError(
        "Last working date cannot be before the resignation date."
      );
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/resignations/", {
        reason: reason.trim(),
        resignation_date: resignationDate,
        last_working_date: lastWorkingDate,
      });

      setMessage("Your resignation request was submitted successfully.");
      setReason("");
      setResignationDate("");
      setLastWorkingDate("");

      await loadRequests();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to submit your resignation request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(requestId, decision) {
    setError("");
    setMessage("");
    setDecidingId(requestId);

    try {
      await api.put(`/resignations/${requestId}/decision`, {
        status: decision,
        hr_comments: comments[requestId] || null,
      });

      setMessage(`Resignation request ${decision.toLowerCase()} successfully.`);
      await loadRequests();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to update the resignation request."
      );
    } finally {
      setDecidingId(null);
    }
  }

  const pending = requests.filter(
    (request) => request.status === "PENDING"
  ).length;

  const approved = requests.filter(
    (request) => request.status === "APPROVED"
  ).length;

  const rejected = requests.filter(
    (request) => request.status === "REJECTED"
  ).length;

  return (
    <main className="resignation-page">
      <header className="resignation-heading">
        <div>
          <p className="resignation-eyebrow">
            PEOPLE · PURPOSE · PROGRESS
          </p>
          <h1>Resignation & Exit Management</h1>
          <p>
            {isHR
              ? "Review employee resignation requests and manage exit decisions."
              : "Submit a resignation request and track its approval status."}
          </p>
        </div>

        <button
          className="resignation-refresh"
          type="button"
          onClick={loadRequests}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="resignation-alert resignation-error" role="alert">
          {String(error)}
        </div>
      )}

      {message && (
        <div className="resignation-alert resignation-success" role="status">
          {message}
        </div>
      )}

      <section className="resignation-stats">
        <article className="resignation-stat">
          <span>Total requests</span>
          <strong>{requests.length}</strong>
        </article>
        <article className="resignation-stat">
          <span>Pending</span>
          <strong>{pending}</strong>
        </article>
        <article className="resignation-stat">
          <span>Approved</span>
          <strong>{approved}</strong>
        </article>
        <article className="resignation-stat">
          <span>Rejected</span>
          <strong>{rejected}</strong>
        </article>
      </section>

      {!isHR && (
        <section className="resignation-panel">
          <h2>Submit resignation request</h2>
          <p className="resignation-description">
            Provide your resignation reason and proposed working dates.
          </p>

          <form className="resignation-form" onSubmit={handleSubmit}>
            <label>
              Reason for resignation
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={5}
                maxLength={2000}
                placeholder="Explain your reason for resigning..."
                required
                rows={4}
              />
            </label>

            <div className="resignation-date-grid">
              <label>
                Resignation date
                <input
                  type="date"
                  value={resignationDate}
                  onChange={(event) =>
                    setResignationDate(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Proposed last working date
                <input
                  type="date"
                  value={lastWorkingDate}
                  min={resignationDate || undefined}
                  onChange={(event) =>
                    setLastWorkingDate(event.target.value)
                  }
                  required
                />
              </label>
            </div>

            <button
              className="resignation-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit resignation"}
            </button>
          </form>
        </section>
      )}

      <section className="resignation-panel">
        <div className="resignation-list-heading">
          <div>
            <h2>{isHR ? "All resignation requests" : "My requests"}</h2>
            <p className="resignation-description">
              Review request details and current decisions.
            </p>
          </div>
          <span className="resignation-count">
            {requests.length} requests
          </span>
        </div>

        {loading ? (
          <p className="resignation-empty">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="resignation-empty">
            No resignation requests found.
          </p>
        ) : (
          <div className="resignation-table-wrapper">
            <table className="resignation-table">
              <thead>
                <tr>
                  {isHR && <th>Employee ID</th>}
                  <th>Reason</th>
                  <th>Resignation date</th>
                  <th>Last working date</th>
                  <th>Status</th>
                  <th>HR comments / action</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    {isHR && <td>#{request.employee_id}</td>}
                    <td className="resignation-reason">
                      {request.reason}
                    </td>
                    <td>{formatDate(request.resignation_date)}</td>
                    <td>{formatDate(request.last_working_date)}</td>
                    <td>
                      <span
                        className={`resignation-status resignation-status-${request.status.toLowerCase()}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td>
                      {isHR && request.status === "PENDING" ? (
                        <div className="resignation-review">
                          <textarea
                            value={comments[request.id] || ""}
                            onChange={(event) =>
                              setComments((previous) => ({
                                ...previous,
                                [request.id]: event.target.value,
                              }))
                            }
                            placeholder="Optional HR comments"
                            rows={2}
                            maxLength={2000}
                          />

                          <div className="resignation-review-actions">
                            <button
                              type="button"
                              className="resignation-approve"
                              disabled={decidingId !== null}
                              onClick={() =>
                                handleDecision(request.id, "APPROVED")
                              }
                            >
                              {decidingId === request.id
                                ? "Saving..."
                                : "Approve"}
                            </button>

                            <button
                              type="button"
                              className="resignation-reject"
                              disabled={decidingId !== null}
                              onClick={() =>
                                handleDecision(request.id, "REJECTED")
                              }
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="resignation-comments">
                          {request.hr_comments || "—"}
                        </span>
                      )}
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
