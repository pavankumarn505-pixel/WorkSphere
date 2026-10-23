
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock3,
  RefreshCw,
} from "lucide-react";

import api from "../api/axios";
import "./AttendanceAnalytics.css";

const today = new Date();

function AttendanceAnalytics() {
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [employeeId, setEmployeeId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    try {
      const params = { year, month };

      if (employeeId.trim()) {
        const id = Number(employeeId);

        if (!Number.isInteger(id) || id <= 0) {
          setError("Enter a valid positive employee ID.");
          setAnalytics(null);
          return;
        }

        params.employee_id = id;
      }

      const response = await api.get(
        "/attendance/analytics/monthly",
        { params }
      );

      setAnalytics(response.data);
    } catch (err) {
      setAnalytics(null);

      if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again.");
      } else if (err.response?.status === 403) {
        setError("Only HR and Admin users can view attendance analytics.");
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to load attendance analytics. Check the backend and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // Load when the page first opens.
    // Filter changes are handled by the Apply Filters button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = (analytics?.daily_breakdown || []).map((item) => ({
    ...item,
    day: Number(item.date.slice(-2)),
  }));

  return (
    <div className="attendance-analytics-page">
      <div className="analytics-heading">
        <div>
          <p className="analytics-eyebrow">WORKFORCE REPORTS</p>
          <h1>Attendance Analytics</h1>
          <p className="analytics-subtitle">
            Monitor attendance patterns and monthly workforce activity.
          </p>
        </div>

        <button
          className="analytics-refresh-button"
          onClick={loadAnalytics}
          disabled={loading}
          type="button"
        >
          <RefreshCw size={17} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <section className="analytics-filters">
        <div className="analytics-filter-field">
          <label htmlFor="attendance-year">Year</label>
          <select
            id="attendance-year"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {Array.from({ length: 7 }, (_, index) => today.getFullYear() - 3 + index).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              )
            )}
          </select>
        </div>

        <div className="analytics-filter-field">
          <label htmlFor="attendance-month">Month</label>
          <select
            id="attendance-month"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map(
              (value) => (
                <option key={value} value={value}>
                  {new Date(year, value - 1, 1).toLocaleString("en", {
                    month: "long",
                  })}
                </option>
              )
            )}
          </select>
        </div>

        <div className="analytics-filter-field">
          <label htmlFor="analytics-employee">Employee ID (optional)</label>
          <input
            id="analytics-employee"
            type="number"
            min="1"
            placeholder="All employees"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          />
        </div>

        <button
          className="analytics-apply-button"
          type="button"
          onClick={loadAnalytics}
          disabled={loading}
        >
          Apply Filters
        </button>
      </section>

      {error && (
        <div className="analytics-error" role="alert">
          {error}
        </div>
      )}

      {loading && !analytics && (
        <div className="analytics-message">Loading attendance report...</div>
      )}

      {!loading && !error && analytics && (
        <>
          <div className="analytics-period">
            <CalendarDays size={18} />
            <span>
              {analytics.month_name} {analytics.year}
              {analytics.employee_id
                ? ` · Employee #${analytics.employee_id}`
                : " · All employees"}
            </span>
          </div>

          <section className="analytics-stat-grid">
            <article className="analytics-stat-card">
              <div className="analytics-stat-icon total-icon">
                <CalendarDays size={21} />
              </div>
              <p>Total Records</p>
              <h2>{analytics.total_records}</h2>
              <span>Recorded attendance entries</span>
            </article>

            <article className="analytics-stat-card">
              <div className="analytics-stat-icon present-icon">
                <CheckCircle2 size={21} />
              </div>
              <p>Present</p>
              <h2>{analytics.present}</h2>
              <span>Full-day attendance records</span>
            </article>

            <article className="analytics-stat-card">
              <div className="analytics-stat-icon absent-icon">
                <XCircle size={21} />
              </div>
              <p>Absent</p>
              <h2>{analytics.absent}</h2>
              <span>Absence records</span>
            </article>

            <article className="analytics-stat-card">
              <div className="analytics-stat-icon halfday-icon">
                <Clock3 size={21} />
              </div>
              <p>Half Day</p>
              <h2>{analytics.half_day}</h2>
              <span>Half-day attendance records</span>
            </article>
          </section>

          <section className="analytics-chart-card">
            <div className="analytics-chart-heading">
              <div>
                <h2>Daily Attendance Trend</h2>
                <p>Attendance records for each day of the selected month</p>
              </div>
              <div className="analytics-percentage">
                <span>Attendance rate</span>
                <strong>{analytics.attendance_percentage}%</strong>
              </div>
            </div>

            {analytics.total_records === 0 ? (
              <div className="analytics-empty">
                No attendance records found for this month.
              </div>
            ) : (
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 15, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(day) => `Day ${day}`}
                    />
                    <Legend />
                    <Bar
                      dataKey="present"
                      name="Present"
                      fill="#16a34a"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="absent"
                      name="Absent"
                      fill="#dc2626"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="half_day"
                      name="Half Day"
                      fill="#d97706"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <p className="analytics-footnote">
            Attendance rate gives full credit to PRESENT records and half
            credit to HALF_DAY records. Dates without attendance records are
            excluded from this calculation.
          </p>
        </>
      )}
    </div>
  );
}

export default AttendanceAnalytics;
