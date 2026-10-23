
import { useCallback, useEffect, useState } from "react";
import api from "../api";
import "./Payroll.css";

const currentMonth = new Date().toISOString().slice(0, 7);

const emptyForm = {
  employee_id: "",
  basic_salary: "",
  allowances: "0",
  deductions: "0",
  bonus: "0",
  month: currentMonth,
};

function getRole() {
  return (
    sessionStorage.getItem("user_role") ||
    localStorage.getItem("user_role") ||
    ""
  ).toUpperCase();
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

function ErrorMessage({ children }) {
  if (!children) return null;
  return <div className="payroll-alert payroll-error">{children}</div>;
}

function SalaryBreakdown({ record }) {
  return (
    <div className="payslip-breakdown">
      <div className="payslip-line">
        <span>Basic salary</span>
        <strong>{money(record.basic_salary)}</strong>
      </div>
      <div className="payslip-line">
        <span>Allowances</span>
        <strong>{money(record.allowances)}</strong>
      </div>
      <div className="payslip-line">
        <span>Bonus</span>
        <strong>{money(record.bonus)}</strong>
      </div>
      <div className="payslip-line payslip-total">
        <span>Gross salary</span>
        <strong>{money(record.gross_salary)}</strong>
      </div>
      <div className="payslip-line payslip-deduction">
        <span>Deductions</span>
        <strong>− {money(record.deductions)}</strong>
      </div>
      <div className="payslip-net">
        <span>Net salary</span>
        <strong>{money(record.net_salary)}</strong>
      </div>
    </div>
  );
}

export default function Payroll() {
  const role = getRole();
  const isAdminOrHR = ["HR", "ADMIN"].includes(role);

  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (isAdminOrHR) {
        const [listResponse, summaryResponse] = await Promise.all([
          api.get("/payroll/", { params: { month } }),
          api.get("/payroll/summary", { params: { month } }),
        ]);

        setRecords(listResponse.data);
        setSummary(summaryResponse.data);
      } else {
        const response = await api.get("/payroll/me");
        setRecords(response.data);
        setSummary(null);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load payroll. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [isAdminOrHR, month]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amounts = [
      form.basic_salary,
      form.allowances,
      form.deductions,
      form.bonus,
    ];

    if (amounts.some((value) => value === "" || !Number.isFinite(Number(value)) || Number(value) < 0)) {
      setError("Enter valid, non-negative salary amounts.");
      return;
    }

    if (Number(form.deductions) > Number(form.basic_salary) + Number(form.allowances) + Number(form.bonus)) {
      setError("Deductions cannot exceed gross salary.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/payroll/", {
        employee_id: Number(form.employee_id),
        basic_salary: Number(form.basic_salary),
        allowances: Number(form.allowances || 0),
        deductions: Number(form.deductions || 0),
        bonus: Number(form.bonus || 0),
        month: form.month,
      });

      setSuccess("Payroll created successfully.");
      setMonth(form.month);
      setForm({ ...emptyForm, month: form.month });
      await loadPayroll();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not create payroll. Check the employee ID and input values."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openPayslip(record) {
    setError("");

    try {
      const response = await api.get(`/payroll/me/${record.id}`);
      setSelectedPayslip(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to open this payslip."
      );
    }
  }

  function closePayslip() {
    setSelectedPayslip(null);
  }

  const displayedRecords = isAdminOrHR
    ? records
    : records.filter((record) => record.month === month);

  return (
    <section className="payroll-page">
      <div className="payroll-page-header">
        <div>
          <p className="payroll-eyebrow">WORKSPHERE HRMS</p>
          <h1>{isAdminOrHR ? "Payroll Management" : "My Payroll"}</h1>
          <p className="payroll-subtitle">
            {isAdminOrHR
              ? "Manage salary records and review monthly payroll totals."
              : "Review your salary history and detailed payslips."}
          </p>
        </div>

        <label className="payroll-month-filter">
          Payroll month
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      {success && (
        <div className="payroll-alert payroll-success">{success}</div>
      )}

      {isAdminOrHR && summary && (
        <div className="payroll-summary-grid">
          <article className="payroll-summary-card">
            <span>Employees paid</span>
            <strong>{summary.employee_count}</strong>
            <small>For {summary.month}</small>
          </article>
          <article className="payroll-summary-card">
            <span>Gross payroll</span>
            <strong>{money(summary.gross_salary_total)}</strong>
            <small>Before deductions</small>
          </article>
          <article className="payroll-summary-card">
            <span>Total deductions</span>
            <strong>{money(summary.deductions_total)}</strong>
            <small>All payroll records</small>
          </article>
          <article className="payroll-summary-card payroll-net-card">
            <span>Net payroll</span>
            <strong>{money(summary.net_salary_total)}</strong>
            <small>After deductions</small>
          </article>
        </div>
      )}

      {isAdminOrHR && (
        <section className="payroll-panel">
          <div className="payroll-panel-heading">
            <div>
              <h2>Create payroll</h2>
              <p>Enter salary components. Gross and net salary are calculated by the server.</p>
            </div>
          </div>

          <form className="payroll-form" onSubmit={handleCreate}>
            <label>
              Employee ID
              <input
                name="employee_id"
                type="number"
                min="1"
                required
                value={form.employee_id}
                onChange={handleFormChange}
                placeholder="e.g. 1"
              />
            </label>

            <label>
              Payroll month
              <input
                name="month"
                type="month"
                required
                value={form.month}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Basic salary (₹)
              <input
                name="basic_salary"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.basic_salary}
                onChange={handleFormChange}
                placeholder="40000"
              />
            </label>

            <label>
              Allowances (₹)
              <input
                name="allowances"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.allowances}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Bonus (₹)
              <input
                name="bonus"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.bonus}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Deductions (₹)
              <input
                name="deductions"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.deductions}
                onChange={handleFormChange}
              />
            </label>

            <div className="payroll-form-actions">
              <button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create payroll"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="payroll-panel">
        <div className="payroll-panel-heading">
          <div>
            <h2>{isAdminOrHR ? "Payroll records" : "Salary history"}</h2>
            <p>
              {isAdminOrHR
                ? `Records for ${month}`
                : "Select a month to filter your salary history."}
            </p>
          </div>
          <button
            type="button"
            className="payroll-secondary-button"
            onClick={loadPayroll}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="payroll-empty">Loading payroll records...</p>
        ) : displayedRecords.length === 0 ? (
          <p className="payroll-empty">
            No payroll records found for this selection.
          </p>
        ) : (
          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  {isAdminOrHR && <th>Employee</th>}
                  <th>Month</th>
                  <th>Gross salary</th>
                  <th>Deductions</th>
                  <th>Net salary</th>
                  <th>Created</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {displayedRecords.map((record) => (
                  <tr key={record.id}>
                    {isAdminOrHR && (
                      <td>
                        <strong>{record.employee_name}</strong>
                        <small className="payroll-cell-subtitle">
                          ID: {record.employee_id}
                        </small>
                      </td>
                    )}
                    <td>{record.month}</td>
                    <td>{money(record.gross_salary)}</td>
                    <td>{money(record.deductions)}</td>
                    <td className="payroll-net-value">
                      {money(record.net_salary)}
                    </td>
                    <td>{formatDate(record.created_at)}</td>
                    <td>
                      {isAdminOrHR ? (
                        <button
                          type="button"
                          className="payroll-secondary-button"
                          onClick={() => setSelectedPayslip(record)}
                        >
                          View
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="payroll-secondary-button"
                          onClick={() => openPayslip(record)}
                        >
                          View payslip
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPayslip && (
        <div
          className="payslip-overlay"
          role="presentation"
          onClick={closePayslip}
        >
          <section
            className="payslip-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payslip-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="payslip-modal-header">
              <div>
                <p className="payroll-eyebrow">WORKSPHERE HRMS</p>
                <h2 id="payslip-title">Salary payslip</h2>
                <p>Payroll period: {selectedPayslip.month}</p>
              </div>
              <button
                type="button"
                className="payslip-close"
                onClick={closePayslip}
                aria-label="Close payslip"
              >
                ×
              </button>
            </div>

            <div className="payslip-employee-info">
              {isAdminOrHR && (
                <p>
                  <span>Employee</span>
                  <strong>
                    {selectedPayslip.employee_name ||
                      `Employee #${selectedPayslip.employee_id}`}
                  </strong>
                </p>
              )}
              <p>
                <span>Employee ID</span>
                <strong>{selectedPayslip.employee_id}</strong>
              </p>
              <p>
                <span>Payroll record</span>
                <strong>#{selectedPayslip.id}</strong>
              </p>
              <p>
                <span>Created on</span>
                <strong>{formatDate(selectedPayslip.created_at)}</strong>
              </p>
            </div>

            <SalaryBreakdown record={selectedPayslip} />

            <div className="payslip-modal-actions">
              <button
                type="button"
                className="payroll-secondary-button"
                onClick={() => window.print()}
              >
                Print payslip
              </button>
              <button
                type="button"
                onClick={closePayslip}
                className="payroll-primary-button"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
