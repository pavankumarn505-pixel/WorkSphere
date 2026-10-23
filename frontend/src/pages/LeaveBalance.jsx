import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./LeaveBalance.css";

const LEAVE_TYPES = [
  { type: "CASUAL", label: "Casual Leave", icon: "🌴" },
  { type: "PAID", label: "Paid Leave", icon: "📅" },
  { type: "SICK", label: "Sick Leave", icon: "🩺" },
];

function LeaveBalance() {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const year = new Date().getFullYear();

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        `/leave-policies/balances/me?year=${year}`
      );

      setBalances(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load your leave balances. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const totalAllocated = balances.reduce(
    (total, item) => total + (Number(item.allocated_days) || 0),
    0
  );

  const totalUsed = balances.reduce(
    (total, item) => total + (Number(item.used_days) || 0),
    0
  );

  const totalRemaining = balances.reduce(
    (total, item) => total + (Number(item.remaining_days) || 0),
    0
  );

  return (
    <main className="leave-balance-page">
      <header className="leave-balance-header">
        <div>
          <p className="leave-balance-eyebrow">TIME OFF OVERVIEW</p>
          <h1>My Leave Balance</h1>
          <p>
            Check your allocated, used, and remaining leave days for {year}.
          </p>
        </div>

        <div className="leave-balance-actions">
          <button
            type="button"
            className="leave-balance-refresh"
            onClick={loadBalances}
            disabled={loading}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>

          <Link to="/leaves/apply" className="leave-balance-apply">
            + Apply for Leave
          </Link>
        </div>
      </header>

      {error && (
        <div className="leave-balance-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadBalances}>
            Try Again
          </button>
        </div>
      )}

      <section className="leave-balance-summary">
        <article className="leave-balance-summary-card">
          <span>Total Allocated</span>
          <strong>{loading ? "—" : totalAllocated}</strong>
          <small>Days available for the year</small>
        </article>

        <article className="leave-balance-summary-card">
          <span>Total Used</span>
          <strong>{loading ? "—" : totalUsed}</strong>
          <small>Days deducted from your balance</small>
        </article>

        <article className="leave-balance-summary-card">
          <span>Total Remaining</span>
          <strong>{loading ? "—" : totalRemaining}</strong>
          <small>Days remaining across returned balances</small>
        </article>
      </section>

      <section className="leave-balance-section">
        <div className="leave-balance-section-heading">
          <div>
            <h2>Leave Breakdown</h2>
            <p>Balance by leave category for {year}.</p>
          </div>
        </div>

        {loading ? (
          <p className="leave-balance-message">Loading leave balances...</p>
        ) : error ? (
          <p className="leave-balance-message">
            Your balances could not be loaded.
          </p>
        ) : balances.length === 0 ? (
          <div className="leave-balance-message">
            <h3>No leave balances found</h3>
            <p>
              Your leave balances may not have been initialized for {year}.
              Please contact HR.
            </p>
          </div>
        ) : (
          <div className="leave-balance-grid">
            {LEAVE_TYPES.map((leaveType) => {
              const balance = balances.find(
                (item) => item.leave_type === leaveType.type
              );

              if (!balance) {
                return (
                  <article
                    className="leave-balance-card"
                    key={leaveType.type}
                  >
                    <div className="leave-balance-card-heading">
                      <span className="leave-balance-icon">
                        {leaveType.icon}
                      </span>
                      <div>
                        <h3>{leaveType.label}</h3>
                        <span className="leave-balance-missing">
                          Balance not initialized
                        </span>
                      </div>
                    </div>
                    <p className="leave-balance-missing-text">
                      Contact HR to set up this year's balance.
                    </p>
                  </article>
                );
              }

              const allocated = Number(balance.allocated_days) || 0;
              const used = Number(balance.used_days) || 0;
              const remaining =
                Number(balance.remaining_days) || 0;

              const usedPercent =
                allocated > 0
                  ? Math.min(100, (used / allocated) * 100)
                  : 0;

              return (
                <article
                  className="leave-balance-card"
                  key={leaveType.type}
                >
                  <div className="leave-balance-card-heading">
                    <span className="leave-balance-icon">
                      {leaveType.icon}
                    </span>
                    <div>
                      <h3>{leaveType.label}</h3>
                      <span className="leave-balance-year">
                        {year} allowance
                      </span>
                    </div>
                  </div>

                  <div className="leave-balance-remaining">
                    <strong>{remaining}</strong>
                    <span>days remaining</span>
                  </div>

                  <div
                    className="leave-balance-progress"
                    role="progressbar"
                    aria-label={`${leaveType.label} used`}
                    aria-valuemin={0}
                    aria-valuemax={allocated}
                    aria-valuenow={Math.min(allocated, used)}
                  >
                    <span style={{ width: `${usedPercent}%` }} />
                  </div>

                  <div className="leave-balance-details">
                    <div>
                      <span>Allocated</span>
                      <strong>{allocated} days</strong>
                    </div>
                    <div>
                      <span>Used</span>
                      <strong>{used} days</strong>
                    </div>
                    <div>
                      <span>Remaining</span>
                      <strong>{remaining} days</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="leave-balance-note">
        <strong>Note:</strong> Leave balances are retrieved from the HRMS
        backend. Contact HR if a balance is missing or appears incorrect.
      </footer>
    </main>
  );
}

export default LeaveBalance;