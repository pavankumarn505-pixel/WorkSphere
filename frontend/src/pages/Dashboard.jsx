
import { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  CalendarCheck,
  CalendarDays,
  Wallet,
  RefreshCw,
  TrendingUp,
  Clock,
  CircleCheck,
  CircleX,
} from "lucide-react";

import api from "../api/axios";
import "./Dashboard.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <article className="dashboard-stat-card">
      <div className={`dashboard-stat-icon ${color}`}>
        <Icon size={23} />
      </div>
      <p className="dashboard-stat-title">{title}</p>
      <h2>{value}</h2>
      <p className="dashboard-stat-subtitle">{subtitle}</p>
    </article>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/dashboard/summary");
      setData(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again.");
      } else if (err.response?.status === 403) {
        setError(
          "Dashboard analytics are available to HR and Admin users only."
        );
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to load dashboard data. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const role = (
    sessionStorage.getItem("user_role") ||
    localStorage.getItem("user_role") ||
    ""
  ).toUpperCase();

  const isEmployee = role === "EMPLOYEE";

  if (isEmployee) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">WORKSPACE</p>
            <h1>Employee Portal</h1>
            <p>Manage your attendance and leave requests.</p>
          </div>
        </div>

        <div className="dashboard-message">
          <Users size={30} />
          <h2>Welcome to WorkSphere</h2>
          <p>
            Use the navigation above to manage your attendance
            and leave requests.
          </p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <RefreshCw className="dashboard-spinner" size={28} />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadDashboard}>
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const employees = data.employees;
  const attendance = data.attendance;
  const leaves = data.leaves;
  const payroll = data.payroll;

  const attendanceItems = [
    { label: "Present", value: attendance.present, color: "green" },
    { label: "Absent", value: attendance.absent, color: "red" },
    { label: "Half-day", value: attendance.half_day, color: "orange" },
  ];

  const leaveItems = [
    { label: "Pending", value: leaves.pending, color: "orange" },
    { label: "Approved", value: leaves.approved, color: "green" },
    { label: "Rejected", value: leaves.rejected, color: "red" },
  ];

  const maxPayroll = Math.max(
    1,
    ...payroll.monthly_trend.map(
      (item) => Number(item.total_net_salary) || 0
    )
  );

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">
            {role === "ADMIN" ? "ADMINISTRATION" : "HUMAN RESOURCES"}
          </p>
          <h1>Dashboard Overview</h1>
          <p>Here's what's happening across your organization.</p>
        </div>

        <button
          className="dashboard-refresh"
          type="button"
          onClick={loadDashboard}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="dashboard-date">
        <CalendarDays size={17} />
        Dashboard date: {data.generated_for}
      </div>

      <div className="dashboard-section-heading">
        <h2>Employee Overview</h2>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard
          title="Total Employees"
          value={employees.total}
          subtitle="All employee records"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Employees"
          value={employees.active}
          subtitle="Currently active"
          icon={UserCheck}
          color="green"
        />
        <StatCard
          title="Inactive Employees"
          value={employees.inactive}
          subtitle="Currently inactive"
          icon={UserX}
          color="orange"
        />
        <StatCard
          title="Today's Attendance"
          value={attendance.total_records}
          subtitle="Recorded attendance entries"
          icon={CalendarCheck}
          color="purple"
        />
      </div>

      <div className="dashboard-section-heading">
        <h2>Attendance & Leave</h2>
      </div>

      <div className="dashboard-panel-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h3>Attendance Summary</h3>
              <p>{attendance.date}</p>
            </div>
            <CalendarCheck size={22} />
          </div>

          {attendance.total_records === 0 ? (
            <p className="dashboard-empty">
              No attendance records have been recorded for today.
            </p>
          ) : (
            <div className="dashboard-metric-list">
              {attendanceItems.map((item) => {
                const percent =
                  (item.value / attendance.total_records) * 100;

                return (
                  <div className="dashboard-metric" key={item.label}>
                    <div className="dashboard-metric-label">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="dashboard-progress-track">
                      <div
                        className={`dashboard-progress-fill ${item.color}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="dashboard-mini-stats">
            <span><CircleCheck size={15} /> {attendance.present} Present</span>
            <span><CircleX size={15} /> {attendance.absent} Absent</span>
            <span><Clock size={15} /> {attendance.half_day} Half-day</span>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h3>Leave Statistics</h3>
              <p>{leaves.total_requests} total requests</p>
            </div>
            <CalendarDays size={22} />
          </div>

          {leaves.total_requests === 0 ? (
            <p className="dashboard-empty">
              No leave requests have been submitted yet.
            </p>
          ) : (
            <div className="dashboard-metric-list">
              {leaveItems.map((item) => {
                const percent =
                  (item.value / leaves.total_requests) * 100;

                return (
                  <div className="dashboard-metric" key={item.label}>
                    <div className="dashboard-metric-label">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="dashboard-progress-track">
                      <div
                        className={`dashboard-progress-fill ${item.color}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>

      <div className="dashboard-section-heading">
        <h2>Payroll Overview</h2>
        <span>{payroll.month}</span>
      </div>

      <div className="dashboard-stat-grid dashboard-payroll-grid">
        <StatCard
          title="Monthly Net Payroll"
          value={formatCurrency(payroll.total_net_salary)}
          subtitle={`Payroll month: ${payroll.month}`}
          icon={Wallet}
          color="blue"
        />
        <StatCard
          title="Payroll Records"
          value={payroll.record_count}
          subtitle="Records for the selected month"
          icon={TrendingUp}
          color="green"
        />
      </div>

      <article className="dashboard-panel dashboard-payroll-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h3>Six-Month Payroll Trend</h3>
            <p>Total net salary by payroll month</p>
          </div>
          <Wallet size={22} />
        </div>

        {payroll.monthly_trend.every(
          (item) => Number(item.total_net_salary) === 0
        ) ? (
          <p className="dashboard-empty">
            No payroll totals are available for these six months yet.
          </p>
        ) : (
          <div className="dashboard-chart">
            {payroll.monthly_trend.map((item) => {
              const amount = Number(item.total_net_salary) || 0;
              const height = (amount / maxPayroll) * 100;

              return (
                <div className="dashboard-chart-column" key={item.month}>
                  <span className="dashboard-chart-value">
                    {formatCurrency(amount)}
                  </span>
                  <div className="dashboard-chart-bar-area">
                    <div
                      className="dashboard-chart-bar"
                      style={{ height: `${height}%` }}
                      title={`${item.month}: ${formatCurrency(amount)}`}
                    />
                  </div>
                  <span className="dashboard-chart-label">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </article>

      <p className="dashboard-footer">
        WorkSphere HRMS · Dashboard analytics
      </p>
    </section>
  );
}

export default Dashboard;
