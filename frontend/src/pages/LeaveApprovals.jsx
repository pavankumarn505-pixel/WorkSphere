
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import "./LeaveApprovals.css";

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (error.response?.status === 401) {
    return "Your session may have expired. Please log in again.";
  }

  if (error.response?.status === 403) {
    return "You do not have permission to manage leave requests.";
  }

  return error.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function LeaveApprovals() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/leaves/");
      setRequests(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "ALL" || request.status === statusFilter;

      const matchesEmployee =
        employeeIdFilter.trim() === "" ||
        String(request.employee_id).includes(employeeIdFilter.trim());

      return matchesStatus && matchesEmployee;
    });
  }, [requests, statusFilter, employeeIdFilter]);

  const pendingCount = requests.filter(
    (request) => request.status === "PENDING"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "APPROVED"
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status === "REJECTED"
  ).length;

  async function handleDecision(request, decision) {
    const action = decision === "APPROVED" ? "approve" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} leave request #${request.id}?`
    );

    if (!confirmed) return;

    setProcessingId(request.id);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(
        `/leaves/${request.id}/decision`,
        { status: decision }
      );

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id ? response.data : item
        )
      );

      setNotice(
        `Leave request #${request.id} was ${decision.toLowerCase()} successfully.`
      );
    } catch (err) {
      setError(getErrorMessage(err));
      await loadRequests();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="leave-approvals-page">
      <div className="leave-approvals-heading">
        <div>
          <p className="leave-approvals-eyebrow">PEOPLE OPERATIONS</p>
          <h1>Leave Approvals</h1>
          <p>
            Review employee leave applications and manage approval decisions.
          </p>
        </div>

        <button
          type="button"
          className="leave-approvals-refresh"
          onClick={loadRequests}
          disabled={loading || processingId !== null}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="leave-approvals-alert leave-approvals-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {notice && (
        <div className="leave-approvals-alert leave-approvals-success" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      <section className="leave-approvals-stats">
        <article className="leave-approvals-stat">
          <span className="leave-approvals-stat-icon">▤</span>
          <p>Total Requests</p>
          <strong>{requests.length}</strong>
          <small>All submitted requests</small>
        </article>

        <article className="leave-approvals-stat">
          <span className="leave-approvals-stat-icon leave-pending-icon">◷</span>
          <p>Pending</p>
          <strong>{pendingCount}</strong>
          <small>Awaiting a decision</small>
        </article>

        <article className="leave-approvals-stat">
          <span className="leave-approvals-stat-icon leave-approved-icon">✓</span>
          <p>Approved</p>
          <strong>{approvedCount}</strong>
          <small>Approved requests</small>
        </article>

        <article className="leave-approvals-stat">
          <span className="leave-approvals-stat-icon leave-rejected-icon">×</span>
          <p>Rejected</p>
          <strong>{rejectedCount}</strong>
          <small>Rejected requests</small>
        </article>
      </section>

      <section className="leave-approvals-card">
        <div className="leave-approvals-card-heading">
          <div>
            <h2>Leave Applications</h2>
            <p>Review request details before making a decision.</p>
          </div>

          <span className="leave-approvals-count">
            {filteredRequests.length} shown
          </span>
        </div>

        <div className="leave-approvals-filters">
          <label>
            <span>Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>

          <label>
            <span>Employee ID</span>
            <input
              type="number"
              min="1"
              placeholder="Enter employee ID"
              value={employeeIdFilter}
              onChange={(event) => setEmployeeIdFilter(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="leave-approvals-clear"
            onClick={() => {
              setStatusFilter("ALL");
              setEmployeeIdFilter("");
            }}
          >
            Clear filters
          </button>
        </div>

        {loading ? (
          <div className="leave-approvals-empty">
            <span className="leave-approvals-spinner" />
            <p>Loading leave applications...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="leave-approvals-empty">
            <span className="leave-approvals-empty-icon">▤</span>
            <h3>No leave requests found</h3>
            <p>
              {requests.length === 0
                ? "There are no leave applications to review yet."
                : "Try changing the filters to see other requests."}
            </p>
          </div>
        ) : (
          <div className="leave-approvals-table-wrap">
            <table className="leave-approvals-table">
              <thead>
                <tr>
                  <th>REQUEST</th>
                  <th>EMPLOYEE</th>
                  <th>LEAVE TYPE</th>
                  <th>DATES</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th>DECISION</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong className="leave-request-number">
                        #{request.id}
                      </strong>
                    </td>

                    <td>
                      <span className="leave-employee-id">
                        Employee #{request.employee_id}
                      </span>
                    </td>

                    <td>
                      <span className="leave-type-label">
                        {request.leave_type}
                      </span>
                    </td>

                    <td>
                      <div className="leave-date-range">
                        <span>{formatDate(request.start_date)}</span>
                        <span className="leave-date-separator">to</span>
                        <span>{formatDate(request.end_date)}</span>
                      </div>
                    </td>

                    <td>
                      <div
                        className="leave-reason"
                        title={request.reason}
                      >
                        {request.reason}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`leave-request-status leave-status-${request.status.toLowerCase()}`}
                      >
                        <span />
                        {request.status}
                      </span>
                    </td>

                    <td>
                      {request.status === "PENDING" ? (
                        <div className="leave-decision-actions">
                          <button
                            type="button"
                            className="leave-approve-button"
                            disabled={processingId !== null}
                            onClick={() =>
                              handleDecision(request, "APPROVED")
                            }
                          >
                            {processingId === request.id
                              ? "Saving..."
                              : "Approve"}
                          </button>

                          <button
                            type="button"
                            className="leave-reject-button"
                            disabled={processingId !== null}
                            onClick={() =>
                              handleDecision(request, "REJECTED")
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="leave-decision-complete">
                          Decision recorded
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="leave-approvals-footer">
          <span>
            Showing {filteredRequests.length} of {requests.length} requests
          </span>
          <span>WorkSphere HRMS</span>
        </div>
      </section>
    </div>
  );
}

export default LeaveApprovals;
