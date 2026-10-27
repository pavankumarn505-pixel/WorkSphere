import { useCallback, useEffect, useState } from "react";
import "./Analytics.css";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token")
  );
}

function formatNumber(value) {
  return value == null ? "—" : Number(value).toLocaleString();
}

function StatCard({ title, value, description }) {
  return (
    <article className="analytics-stat-card">
      <p className="analytics-stat-title">{title}</p>
      <h2>{formatNumber(value)}</h2>
      <p className="analytics-stat-description">{description}</p>
    </article>
  );
}

function Analytics() {
  const [summary, setSummary] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departmentError, setDepartmentError] = useState("");

  const role = (
    sessionStorage.getItem("user_role") ||
    localStorage.getItem("user_role") ||
    ""
  ).toUpperCase();

  const isHRorAdmin = ["HR", "ADMIN"].includes(role);

  const loadAnalytics = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Your login session is missing. Please log in again.");
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setError("Start date cannot be later than end date.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      if (department && isHRorAdmin) {
        params.set("department", department.trim());
      }

      const query = params.toString();
      const url = `${API_URL}/analytics/summary${
        query ? `?${query}` : ""
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.detail || "Unable to load analytics."
        );
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err.message || "Unable to load analytics.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, department, isHRorAdmin]);

  const loadDepartments = useCallback(async () => {
    if (!isHRorAdmin) {
      setDepartments([]);
      setDepartmentError("");
      return;
    }

    const token = getToken();

    try {
      const response = await fetch(
        `${API_URL}/analytics/departments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.detail || "Unable to load departments."
        );
      }

      const data = await response.json();
      setDepartments(data.departments || []);
      setDepartmentError("");
    } catch (err) {
      setDepartmentError(
        err.message || "Unable to load departments."
      );
    }
  }, [isHRorAdmin]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setDepartment("");
  }

  if (!summary && loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-loading">
          Loading analytics dashboard...
        </div>
      </div>
    );
  }

  const attendance = summary?.attendance || {};
  const leaves = summary?.leaves || {};
  const performance = summary?.performance || {};

  const attendanceTotal = attendance.total_records || 0;

  const attendanceItems = [
    { label: "Present", value: attendance.present || 0 },
    { label: "Absent", value: attendance.absent || 0 },
    { label: "Half Day", value: attendance.half_day || 0 },
  ];

  const leaveItems = [
    { label: "Pending", value: leaves.pending || 0 },
    { label: "Approved", value: leaves.approved || 0 },
    { label: "Rejected", value: leaves.rejected || 0 },
  ];

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div>
          <p className="analytics-eyebrow">
            WORKSPHERE HRMS
          </p>
          <h1>Analytics &amp; Reports</h1>
          <p className="analytics-subtitle">
            Understand attendance, leave activity, and employee
            performance in one place.
          </p>
        </div>

        <button
          type="button"
          className="analytics-refresh-button"
          onClick={() => {
            loadAnalytics();
            loadDepartments();
          }}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh Reports"}
        </button>
      </header>

      <section className="analytics-filter-panel">
        <div className="analytics-filter-heading">
          <div>
            <h2>Report Filters</h2>
            <p>Choose a reporting period and department.</p>
          </div>

          <button
            type="button"
            className="analytics-clear-button"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>

        <div className="analytics-filter-grid">
          <label>
            Start Date
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label>
            End Date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          {isHRorAdmin && (
            <label>
              Department
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((item) => (
                  <option
                    key={item.department}
                    value={item.department}
                  >
                    {item.department}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className="analytics-apply-button"
            onClick={loadAnalytics}
            disabled={loading}
          >
            Apply Filters
          </button>
        </div>

        {departmentError && (
          <p className="analytics-warning">{departmentError}</p>
        )}
      </section>

      {error && (
        <div className="analytics-error" role="alert">
          <strong>Unable to load reports</strong>
          <p>{error}</p>
          <button type="button" onClick={loadAnalytics}>
            Try Again
          </button>
        </div>
      )}

      {summary && (
        <>
          <section className="analytics-section">
            <div className="analytics-section-heading">
              <h2>Overview</h2>
              <span>
                {summary.scope === "employee"
                  ? "Personal reports"
                  : "Organization reports"}
              </span>
            </div>

            <div className="analytics-stat-grid">
              <StatCard
                title={
                  summary.scope === "employee"
                    ? "My Employee ID"
                    : "Employees"
                }
                value={
                  summary.scope === "employee"
                    ? summary.employee?.id
                    : summary.employee_count
                }
                description={
                  summary.scope === "employee"
                    ? summary.employee?.full_name || "My profile"
                    : "Employees in the selected department"
                }
              />

              <StatCard
                title="Attendance Records"
                value={attendance.total_records}
                description="Records in the selected period"
              />

              <StatCard
                title="Leave Requests"
                value={leaves.total_requests}
                description="Requests overlapping the period"
              />

              <StatCard
                title="Performance Reviews"
                value={performance.review_count}
                description="Reviews created in the selected period"
              />
            </div>
          </section>

          <section className="analytics-report-grid">
            <article className="analytics-report-card">
              <div className="analytics-card-heading">
                <div>
                  <h2>Attendance Summary</h2>
                  <p>Breakdown of attendance records</p>
                </div>
                <span className="analytics-card-icon">A</span>
              </div>

              {attendanceTotal === 0 ? (
                <p className="analytics-empty">
                  No attendance records for this period.
                </p>
              ) : (
                <div className="analytics-bars">
                  {attendanceItems.map((item) => {
                    const percentage =
                      (item.value / attendanceTotal) * 100;

                    return (
                      <div
                        className="analytics-bar-item"
                        key={item.label}
                      >
                        <div className="analytics-bar-label">
                          <span>{item.label}</span>
                          <strong>
                            {item.value} (
                            {percentage.toFixed(1)}%)
                          </strong>
                        </div>

                        <div className="analytics-bar-track">
                          <div
                            className={`analytics-bar-fill ${
                              item.label === "Present"
                                ? "bar-present"
                                : item.label === "Absent"
                                  ? "bar-absent"
                                  : "bar-halfday"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="analytics-metric-footer">
                <span>Average working hours</span>
                <strong>
                  {attendance.average_working_hours == null
                    ? "—"
                    : `${attendance.average_working_hours} hrs`}
                </strong>
              </div>
            </article>

            <article className="analytics-report-card">
              <div className="analytics-card-heading">
                <div>
                  <h2>Leave Summary</h2>
                  <p>Current status of matching requests</p>
                </div>
                <span className="analytics-card-icon">L</span>
              </div>

              <div className="analytics-leave-list">
                {leaveItems.map((item) => (
                  <div
                    className="analytics-leave-item"
                    key={item.label}
                  >
                    <div className="analytics-leave-label">
                      <span
                        className={`analytics-status-dot ${
                          item.label === "Pending"
                            ? "dot-pending"
                            : item.label === "Approved"
                              ? "dot-approved"
                              : "dot-rejected"
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="analytics-metric-footer">
                <span>Total requests</span>
                <strong>{leaves.total_requests || 0}</strong>
              </div>
            </article>

            <article className="analytics-report-card analytics-performance-card">
              <div className="analytics-card-heading">
                <div>
                  <h2>Performance Insights</h2>
                  <p>Average employee review rating</p>
                </div>
                <span className="analytics-card-icon">P</span>
              </div>

              <div className="analytics-rating">
                <strong>
                  {performance.average_rating == null
                    ? "—"
                    : performance.average_rating}
                </strong>
                <span>/ 5</span>
              </div>

              <div
                className="analytics-rating-track"
                aria-label="Average rating out of five"
              >
                <div
                  className="analytics-rating-fill"
                  style={{
                    width: `${
                      performance.average_rating == null
                        ? 0
                        : Math.min(
                            100,
                            Math.max(
                              0,
                              (performance.average_rating / 5) * 100
                            )
                          )
                    }%`,
                  }}
                />
              </div>

              <p className="analytics-rating-caption">
                Based on {performance.review_count || 0} review(s)
              </p>
            </article>
          </section>

          {isHRorAdmin && (
            <section className="analytics-section">
              <div className="analytics-section-heading">
                <h2>Department Report</h2>
                <span>{departments.length} departments</span>
              </div>

              {departmentError ? (
                <div className="analytics-warning">
                  {departmentError}
                </div>
              ) : departments.length === 0 ? (
                <div className="analytics-empty">
                  No department data available.
                </div>
              ) : (
                <div className="analytics-table-wrapper">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Employee Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments
                        .filter(
                          (item) =>
                            !department ||
                            item.department.toLowerCase() ===
                              department.toLowerCase()
                        )
                        .map((item) => (
                          <tr key={item.department}>
                            <td>{item.department}</td>
                            <td>{item.employee_count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="analytics-report-note">
                Department totals show all employees. The selected
                date range applies to attendance, leave, and
                performance summaries.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Analytics;
