
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import "./LeaveCalendar.css";

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function getMonthLabel(date) {
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function LeaveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [calendarLeaves, setCalendarLeaves] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Read the logged-in user's role from browser storage.
  const role =
    localStorage.getItem("role") ||
    sessionStorage.getItem("role") ||
    "";

  const isHrOrAdmin = ["HR", "ADMIN"].includes(role.toUpperCase());

  const monthStart = useMemo(
    () =>
      `${currentMonth.getFullYear()}-${String(
        currentMonth.getMonth() + 1
      ).padStart(2, "0")}-01`,
    [currentMonth]
  );

  const monthEnd = useMemo(() => {
    const lastDay = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    );

    return [
      lastDay.getFullYear(),
      String(lastDay.getMonth() + 1).padStart(2, "0"),
      String(lastDay.getDate()).padStart(2, "0"),
    ].join("-");
  }, [currentMonth]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const calendarResponse = await api.get("/leaves/calendar", {
        params: {
          start_date: monthStart,
          end_date: monthEnd,
        },
      });

      setCalendarLeaves(calendarResponse.data.leaves || []);

      if (isHrOrAdmin) {
        const today = new Date();
        const todayString = [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, "0"),
          String(today.getDate()).padStart(2, "0"),
        ].join("-");

        const [availabilityResponse, conflictsResponse] =
          await Promise.all([
            api.get("/leaves/team-availability", {
              params: { target_date: todayString },
            }),
            api.get("/leaves/conflicts", {
              params: {
                start_date: monthStart,
                end_date: monthEnd,
              },
            }),
          ]);

        setAvailability(availabilityResponse.data);
        setConflicts(conflictsResponse.data.conflicts || []);
      } else {
        setAvailability(null);
        setConflicts([]);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load leave calendar. Please check your login and backend."
      );
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd, isHrOrAdmin]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar, refreshKey]);

  const previousMonth = () => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1
      )
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      )
    );
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(
      new Date(today.getFullYear(), today.getMonth(), 1)
    );
  };

  // Build the calendar grid, including empty cells before day 1.
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const numberOfDays = new Date(year, month + 1, 0).getDate();

    return [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: numberOfDays }, (_, index) => index + 1),
    ];
  }, [currentMonth]);

  const leavesByDate = useMemo(() => {
    const grouped = {};

    calendarLeaves.forEach((leave) => {
      // Clip each leave period to the month being displayed.
      const start = new Date(
        `${leave.start_date}T00:00:00`
      );
      const end = new Date(`${leave.end_date}T00:00:00`);

      for (
        let day = new Date(
          Math.max(
            start.getTime(),
            new Date(`${monthStart}T00:00:00`).getTime()
          )
        );
        day <= end &&
        day <= new Date(`${monthEnd}T00:00:00`);
        day.setDate(day.getDate() + 1)
      ) {
        const dateKey = [
          day.getFullYear(),
          String(day.getMonth() + 1).padStart(2, "0"),
          String(day.getDate()).padStart(2, "0"),
        ].join("-");

        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(leave);
      }
    });

    return grouped;
  }, [calendarLeaves, monthStart, monthEnd]);

  const todayKey = (() => {
    const today = new Date();
    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
  })();

  return (
    <main className="leave-calendar-page">
      <header className="leave-calendar-header">
        <div>
          <p className="leave-calendar-eyebrow">WORKSPHERE HRMS</p>
          <h1>Leave Calendar &amp; Team View</h1>
          <p className="leave-calendar-subtitle">
            Plan ahead, understand team availability, and spot overlapping leave.
          </p>
        </div>

        <button
          type="button"
          className="leave-refresh-button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="leave-error" role="alert">
          <strong>Could not load data.</strong> {error}
        </div>
      )}

      {isHrOrAdmin && availability && (
        <section className="availability-cards">
          <article className="availability-card">
            <span className="availability-card-label">
              Active employees
            </span>
            <strong>{availability.total_active_employees}</strong>
          </article>

          <article className="availability-card available-card">
            <span className="availability-card-label">
              Available today
            </span>
            <strong>{availability.available_count}</strong>
          </article>

          <article className="availability-card on-leave-card">
            <span className="availability-card-label">
              On approved leave today
            </span>
            <strong>{availability.on_leave_count}</strong>
          </article>

          <article className="availability-card pending-card">
            <span className="availability-card-label">
              Pending requests covering today
            </span>
            <strong>
              {availability.pending_requests_covering_date}
            </strong>
          </article>
        </section>
      )}

      <section className="leave-calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <h2>{getMonthLabel(currentMonth)}</h2>
            <p>Approved leave appears on the dates below.</p>
          </div>

          <div className="calendar-navigation">
            <button type="button" onClick={previousMonth} aria-label="Previous month">
              &larr;
            </button>
            <button type="button" onClick={goToToday}>
              Today
            </button>
            <button type="button" onClick={nextMonth} aria-label="Next month">
              &rarr;
            </button>
          </div>
        </div>

        <div className="calendar-legend">
          <span><i className="legend-dot approved-dot" /> Approved leave</span>
          <span><i className="legend-dot today-dot" /> Today</span>
          {isHrOrAdmin && (
            <span><i className="legend-dot conflict-dot" /> Team conflict</span>
          )}
        </div>

        {loading ? (
          <div className="calendar-message">Loading calendar...</div>
        ) : (
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day) => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              )
            )}

            {calendarDays.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    className="calendar-day empty-calendar-day"
                    key={`empty-${index}`}
                  />
                );
              }

              const dateKey = [
                currentMonth.getFullYear(),
                String(currentMonth.getMonth() + 1).padStart(2, "0"),
                String(day).padStart(2, "0"),
              ].join("-");

              const dayLeaves = leavesByDate[dateKey] || [];
              const hasConflict =
                isHrOrAdmin &&
                conflicts.some((item) => item.date === dateKey);

              return (
                <div
                  className={[
                    "calendar-day",
                    dateKey === todayKey ? "calendar-today" : "",
                    hasConflict ? "calendar-conflict" : "",
                  ].filter(Boolean).join(" ")}
                  key={dateKey}
                >
                  <span className="calendar-day-number">{day}</span>

                  {hasConflict && (
                    <span className="calendar-conflict-label">
                      Team conflict
                    </span>
                  )}

                  <div className="calendar-day-leaves">
                    {dayLeaves.map((leave) => (
                      <div
                        className="calendar-leave-chip"
                        key={`${leave.leave_id}-${dateKey}`}
                        title={`${leave.employee_name} — ${leave.leave_type}`}
                      >
                        <strong>{leave.employee_name}</strong>
                        <span>{leave.leave_type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && calendarLeaves.length === 0 && !error && (
          <p className="calendar-empty-message">
            No approved team leave found for this month.
          </p>
        )}
      </section>

      {isHrOrAdmin && (
        <section className="team-details-section">
          <div className="team-section-heading">
            <div>
              <h2>Team availability</h2>
              <p>
                Availability summary for {availability?.date || "today"}.
              </p>
            </div>
          </div>

          {availability && availability.team.length > 0 ? (
            <div className="team-table-wrapper">
              <table className="team-availability-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Availability</th>
                    <th>Leave type</th>
                    <th>Leave period</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.team.map((member) => (
                    <tr key={member.employee_id}>
                      <td>{member.employee_name}</td>
                      <td>{member.department || "—"}</td>
                      <td>
                        <span
                          className={
                            member.availability === "ON_LEAVE"
                              ? "availability-status status-on-leave"
                              : "availability-status status-available"
                          }
                        >
                          {member.availability === "ON_LEAVE"
                            ? "On leave"
                            : "Available"}
                        </span>
                      </td>
                      <td>{member.leave_type || "—"}</td>
                      <td>
                        {member.leave_start_date
                          ? `${formatDate(member.leave_start_date)} – ${formatDate(member.leave_end_date)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="calendar-empty-message">
              {loading
                ? "Loading team availability..."
                : "No active employees found."}
            </p>
          )}
        </section>
      )}

      {isHrOrAdmin && (
        <section className="team-details-section">
          <div className="team-section-heading">
            <div>
              <h2>Team conflict warnings</h2>
              <p>
                Dates when at least two employees have approved leave.
              </p>
            </div>
            <span className="conflict-count">
              {conflicts.length} conflict day{conflicts.length === 1 ? "" : "s"}
            </span>
          </div>

          {conflicts.length > 0 ? (
            <div className="conflict-list">
              {conflicts.map((conflict) => (
                <article className="conflict-item" key={conflict.date}>
                  <div>
                    <strong>{formatDate(conflict.date)}</strong>
                    <p>{conflict.message}</p>
                    <span>
                      {conflict.employees
                        .map((employee) => employee.employee_name)
                        .join(", ")}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="no-conflicts-message">
              No overlapping approved team leave found for this month.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

export default LeaveCalendar;
