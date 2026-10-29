
import { useCallback, useEffect, useState } from "react";

import "./Feedback.css";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function getRole() {
  return (
    localStorage.getItem("user_role") ||
    sessionStorage.getItem("user_role") ||
    ""
  ).toUpperCase();
}

export default function Feedback() {
  const role = getRole();
  const isHRorAdmin = ["HR", "ADMIN"].includes(role);

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchFeedback = useCallback(async () => {
    const token = getToken();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/feedback/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to load feedback."
        );
      }

      setFeedbackList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isHRorAdmin) {
      fetchFeedback();
    }
  }, [isHRorAdmin, fetchFeedback]);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!message.trim()) {
      setError("Please enter your feedback.");
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/feedback/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          rating: Number(rating),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || "Could not submit feedback."
        );
      }

      setMessage("");
      setRating(5);
      setSuccess("Thank you! Your feedback was submitted.");

    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="feedback-page">
      <div className="feedback-heading">
        <div>
          <p className="feedback-eyebrow">WORKSPHERE HRMS · MODULE 26</p>
          <h1>
            {isHRorAdmin
              ? "Employee Feedback Dashboard"
              : "Employee Feedback"}
          </h1>
          <p>
            {isHRorAdmin
              ? "Review employee feedback and understand their experience."
              : "Share your thoughts to help us improve the workplace."}
          </p>
        </div>

        <div className="feedback-heading-icon">✦</div>
      </div>

      {isHRorAdmin ? (
        <section className="feedback-card">
          <div className="feedback-card-header">
            <div>
              <h2>Submitted Feedback</h2>
              <p>Latest submissions appear first.</p>
            </div>

            <button
              type="button"
              className="feedback-secondary-button"
              onClick={fetchFeedback}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error && (
            <p className="feedback-error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="feedback-empty">Loading feedback...</p>
          ) : feedbackList.length === 0 && !error ? (
            <p className="feedback-empty">
              No feedback has been submitted yet.
            </p>
          ) : (
            <div className="feedback-table-wrapper">
              <table className="feedback-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Employee ID</th>
                    <th>Rating</th>
                    <th>Message</th>
                    <th>Submitted On</th>
                  </tr>
                </thead>

                <tbody>
                  {feedbackList.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.employee_id}</td>
                      <td>
                        <span className="feedback-rating">
                          {"★".repeat(item.rating)}
                          {"☆".repeat(5 - item.rating)}
                        </span>
                        <span className="feedback-rating-number">
                          {" "}
                          ({item.rating}/5)
                        </span>
                      </td>
                      <td className="feedback-message-cell">
                        {item.message}
                      </td>
                      <td>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="feedback-card feedback-form-card">
          <div className="feedback-form-intro">
            <h2>We value your feedback</h2>
            <p>
              Tell us about your experience at WorkSphere.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="feedback-label">
              How would you rate your experience?
            </label>

            <div className="feedback-star-picker">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    value <= rating
                      ? "feedback-star selected"
                      : "feedback-star"
                  }
                  onClick={() => setRating(value)}
                  aria-label={`Rate ${value} out of 5`}
                  aria-pressed={rating === value}
                >
                  ★
                </button>
              ))}
              <span className="feedback-rating-description">
                {rating} out of 5
              </span>
            </div>

            <label
              className="feedback-label"
              htmlFor="feedback-message"
            >
              Your feedback
            </label>

            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share your suggestions or experience..."
              rows={6}
              maxLength={2000}
              required
            />

            <div className="feedback-character-count">
              {message.length}/2000 characters
            </div>

            {error && (
              <p className="feedback-error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="feedback-success" role="status">
                {success}
              </p>
            )}

            <button
              type="submit"
              className="feedback-submit-button"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
