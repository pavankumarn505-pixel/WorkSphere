import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import "./Attendance.css";

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(value) {
  if (!value) return "--";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return value;
}

function formatHours(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const hours = Number(value);

  return Number.isFinite(hours) ? `${hours.toFixed(2)} hrs` : "--";
}

function getLateLabel(item) {
  if (!item.check_in) return "—";

  if (item.is_late) {
    return `Late by ${item.late_by_minutes ?? 0} min`;
  }

  return "On Time";
}

function getEarlyCheckoutLabel(item) {
  if (!item.check_out) return "—";

  if (item.is_early_checkout) {
    return `Early by ${item.early_by_minutes ?? 0} min`;
  }

  return "On Time";
}

function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAttendance = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    setError("");

    try {
      const response = await api.get("/attendance/me");

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected attendance response.");
      }

      setAttendance(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to load attendance history. Please try again."
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const today = getLocalDateString();

  // Find today's attendance record.
  const todayRecord = useMemo(
    () => attendance.find((item) => item.date === today),
    [attendance, today]
  );

  // A record with check-in but no check-out is still open.
  const openAttendanceRecord = useMemo(
    () =>
      attendance.find(
        (item) => item.check_in && !item.check_out
      ),
    [attendance]
  );

  const canCheckIn =
    !todayRecord && !openAttendanceRecord;

  const canCheckOut = Boolean(openAttendanceRecord);

  const now = new Date();

  async function handleAttendance(action) {
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post(`/attendance/${action}`);

      setMessage(
        response.data?.message ||
          (action === "check-in"
            ? "Check-in successful!"
            : "Check-out successful!")
      );

      await loadAttendance(false);
    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Attendance action failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="attendance-page">
      <header className="attendance-header">
        <div>
          <p className="attendance-eyebrow">WORKSPHERE HRMS</p>
          <h1>Attendance Management</h1>
          <p>
            Track your daily attendance, working hours, and shift
            punctuality.
          </p>
        </div>

        <div className="attendance-date">
          <span>Today</span>
          <strong>
            {now.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
        </div>
      </header>

      {error && (
        <div className="attendance-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadAttendance()}
            disabled={loading || submitting}
          >
            Retry
          </button>
        </div>
      )}

      {message && (
        <div className="attendance-success" role="status">
          {message}
        </div>
      )}

      <section className="attendance-cards">
        <article className="attendance-card">
          <span>Today's Status</span>
          <h2>
            {loading
              ? "Loading..."
              : todayRecord?.status?.replaceAll("_", " ") ||
                (openAttendanceRecord
                  ? "Shift in progress"
                  : "Not checked in")}
          </h2>
        </article>

        <article className="attendance-card">
          <span>Check-in Time</span>
          <h2>{formatTime(openAttendanceRecord?.check_in || todayRecord?.check_in)}</h2>
        </article>

        <article className="attendance-card">
          <span>Check-out Time</span>
          <h2>{formatTime(openAttendanceRecord?.check_out || todayRecord?.check_out)}</h2>
        </article>

        <article className="attendance-card">
          <span>Working Hours</span>
          <h2>
            {formatHours(
              openAttendanceRecord?.working_hours ??
                todayRecord?.working_hours
            )}
          </h2>
        </article>

        <article className="attendance-card">
          <span>Late Entry</span>
          <h2
            className={
              openAttendanceRecord?.is_late || todayRecord?.is_late
                ? "attendance-late-text"
                : "attendance-on-time-text"
            }
          >
            {loading
              ? "Loading..."
              : getLateLabel(openAttendanceRecord || todayRecord || {})}
          </h2>
        </article>

        <article className="attendance-card">
          <span>Early Checkout</span>
          <h2>
            {loading
              ? "Loading..."
              : getEarlyCheckoutLabel(
                  openAttendanceRecord || todayRecord || {}
                )}
          </h2>
        </article>
      </section>

      <section className="attendance-actions">
        <button
          type="button"
          className="check-in-button"
          disabled={submitting || loading || !canCheckIn}
          onClick={() => handleAttendance("check-in")}
        >
          {submitting ? "Please wait..." : "Check In"}
        </button>

        <button
          type="button"
          className="check-out-button"
          disabled={submitting || loading || !canCheckOut}
          onClick={() => handleAttendance("check-out")}
        >
          {submitting ? "Please wait..." : "Check Out"}
        </button>

        <button
          type="button"
          className="attendance-refresh-button"
          disabled={loading || submitting}
          onClick={() => {
            setMessage("");
            loadAttendance();
          }}
        >
          {loading ? "Refreshing..." : "Refresh History"}
        </button>
      </section>

      <section className="attendance-history">
        <div className="attendance-history-header">
          <div>
            <h2>Attendance History</h2>
            <p>
              Review check-in, check-out, working hours, and
              punctuality records.
            </p>
          </div>

          <span className="attendance-record-count">
            {attendance.length}{" "}
            {attendance.length === 1 ? "record" : "records"}
          </span>
        </div>

        {loading ? (
          <div className="attendance-empty-state">
            Loading attendance records...
          </div>
        ) : attendance.length === 0 ? (
          <div className="attendance-empty-state">
            <h3>No attendance records yet</h3>
            <p>
              Your attendance history will appear here after your
              first check-in.
            </p>
          </div>
        ) : (
          <div className="attendance-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                  <th>Late Entry</th>
                  <th>Early Checkout</th>
                </tr>
              </thead>

              <tbody>
                {attendance.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{formatTime(item.check_in)}</td>
                    <td>{formatTime(item.check_out)}</td>
                    <td>{formatHours(item.working_hours)}</td>

                    <td>
                      <span
                        className={`attendance-status ${
                          (item.status || "unknown").toLowerCase()
                        }`}
                      >
                        {(item.status || "UNKNOWN").replaceAll(
                          "_",
                          " "
                        )}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`attendance-late-badge ${
                          !item.check_in
                            ? "unknown"
                            : item.is_late
                              ? "late"
                              : "on-time"
                        }`}
                      >
                        {getLateLabel(item)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`attendance-late-badge ${
                          !item.check_out
                            ? "unknown"
                            : item.is_early_checkout
                              ? "late"
                              : "on-time"
                        }`}
                      >
                        {getEarlyCheckoutLabel(item)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Attendance;
