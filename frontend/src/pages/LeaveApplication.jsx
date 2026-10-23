
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./Leave.css";

function LeaveApplication() {
  const [form, setForm] = useState({
    leave_type: "CASUAL",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.end_date < form.start_date) {
      setError("End date must be on or after the start date.");
      return;
    }

    if (!form.reason.trim()) {
      setError("Please enter a reason for your leave.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/leaves/", {
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim(),
      });

      setMessage("Leave application submitted successfully!");
      setForm({
        leave_type: "CASUAL",
        start_date: "",
        end_date: "",
        reason: "",
      });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to submit your leave application."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="leave-page">
      <header className="leave-header">
        <div>
          <p className="leave-eyebrow">TIME OFF</p>
          <h1>Apply for Leave</h1>
          <p>Submit a leave request for HR review.</p>
        </div>

        <Link className="leave-secondary-link" to="/leaves/status">
          View My Leave Status
        </Link>
      </header>

      <section className="leave-form-card">
        <h2>Leave Application Form</h2>
        <p className="leave-muted">
          Complete the details below and submit your request.
        </p>

        {error && (
          <div className="leave-alert leave-alert-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="leave-alert leave-alert-success" role="status">
            {message}
            {" "}
            <Link to="/leaves/status">View your request</Link>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="leave-field">
            <label htmlFor="leave_type">Leave Type</label>
            <select
              id="leave_type"
              name="leave_type"
              value={form.leave_type}
              onChange={handleChange}
              required
            >
              <option value="SICK">Sick Leave</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="PAID">Paid Leave</option>
            </select>
          </div>

          <div className="leave-date-grid">
            <div className="leave-field">
              <label htmlFor="start_date">Start Date</label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="leave-field">
              <label htmlFor="end_date">End Date</label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="leave-field">
            <label htmlFor="reason">Reason for Leave</label>
            <textarea
              id="reason"
              name="reason"
              rows="5"
              minLength="5"
              maxLength="1000"
              placeholder="Explain why you need leave..."
              value={form.reason}
              onChange={handleChange}
              required
            />
            <small>{form.reason.length}/1000 characters</small>
          </div>

          <button
            className="leave-primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Leave Request"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LeaveApplication;
