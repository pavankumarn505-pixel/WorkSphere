
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import "./Employees.css";

const emptyForm = {
  user_id: "",
  full_name: "",
  designation: "",
  department: "",
  joining_date: "",
  salary: "0.00",
  status: "ACTIVE",
};

const emptyFilters = {
  name: "",
  department: "",
  designation: "",
  role: "",
  employee_status: "",
  attendance_status: "",
  performance_rating: "",
};

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  if (typeof detail === "string") {
    return detail;
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

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({ ...emptyFilters });
  const [activeFilters, setActiveFilters] = useState({ ...emptyFilters });
  const [filtering, setFiltering] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  // Load all employee records.
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/employees/");
      setEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Dropdown options from currently loaded employee records.
  const departments = useMemo(
    () =>
      [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [employees]
  );

  const designations = useMemo(
    () =>
      [...new Set(employees.map((e) => e.designation).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [employees]
  );

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Apply all selected filters through the FastAPI backend.
  async function applyFilters(event) {
    event?.preventDefault();

    setFiltering(true);
    setError("");
    setSuccess("");

    const params = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim() !== "") {
        // FastAPI expects performance_rating as a number.
        params[key] =
          key === "performance_rating" ? Number(value) : value.trim();
      }
    });

    try {
      const response = await api.get("/employees/search", { params });

      setEmployees(Array.isArray(response.data) ? response.data : []);
      setActiveFilters({ ...filters });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFiltering(false);
    }
  }

  // Clear all filters and reload the complete employee directory.
  async function clearFilters() {
    setFilters({ ...emptyFilters });
    setActiveFilters({ ...emptyFilters });
    await loadEmployees();
  }

  function openAddForm() {
    setEditingEmployee(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(employee) {
    setEditingEmployee(employee);

    setForm({
      user_id: employee.user_id ?? "",
      full_name: employee.full_name ?? "",
      designation: employee.designation ?? "",
      department: employee.department ?? "",
      joining_date: employee.joining_date ?? "",
      salary: String(employee.salary ?? "0.00"),
      status: String(employee.status || "ACTIVE").toUpperCase(),
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingEmployee(null);
    setForm({ ...emptyForm });
    setError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const fullName = form.full_name.trim();
    const designation = form.designation.trim();
    const department = form.department.trim();
    const salary = Number(form.salary);

    if (fullName.length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    if (designation.length < 2 || department.length < 2) {
      setError(
        "Designation and department must contain at least 2 characters."
      );
      return;
    }

    if (!form.joining_date) {
      setError("Please select a joining date.");
      return;
    }

    if (!Number.isFinite(salary) || salary < 0) {
      setError("Salary must be zero or a positive number.");
      return;
    }

    const payload = {
      full_name: fullName,
      designation,
      department,
      joining_date: form.joining_date,
      salary: salary.toFixed(2),
      status: form.status,
    };

    if (!editingEmployee && form.user_id !== "") {
      const userId = Number(form.user_id);

      if (!Number.isInteger(userId) || userId <= 0) {
        setError("Linked user ID must be a positive whole number.");
        return;
      }

      payload.user_id = userId;
    }

    setSaving(true);

    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, payload);
        setSuccess("Employee details updated successfully.");
      } else {
        await api.post("/employees/", payload);
        setSuccess("Employee added successfully.");
      }

      setShowForm(false);
      setEditingEmployee(null);
      setForm({ ...emptyForm });

      await loadEmployees();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const activeCount = employees.filter(
    (e) => String(e.status || "").toUpperCase() === "ACTIVE"
  ).length;

  const inactiveCount = employees.filter(
    (e) => String(e.status || "").toUpperCase() === "INACTIVE"
  ).length;

  const totalSalary = employees.reduce(
    (sum, e) => sum + (Number(e.salary) || 0),
    0
  );

  const hasActiveFilters = Object.values(filters).some(
    (value) => value.trim() !== ""
  );

  const hasAppliedFilters = Object.values(activeFilters).some(
    (value) => value.trim() !== ""
  );

  return (
    <div className="employees-page">
      <div className="employees-heading">
        <div>
          <p className="employees-eyebrow">PEOPLE OPERATIONS</p>
          <h1>Employee Management</h1>
          <p className="employees-subtitle">
            Manage employee records, departments, salaries, and employment status.
          </p>
        </div>

        <button
          type="button"
          className="employee-primary-button"
          onClick={openAddForm}
        >
          ＋ Add Employee
        </button>
      </div>

      {error && !showForm && (
        <div className="employee-alert employee-alert-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="employee-alert employee-alert-success" role="status">
          {success}
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="employee-stat-grid">
        <article className="employee-stat-card">
          <span className="employee-stat-icon">👥</span>
          <p>Employees in Results</p>
          <strong>{employees.length}</strong>
          <span className="employee-stat-note">Current directory results</span>
        </article>

        <article className="employee-stat-card">
          <span className="employee-stat-icon employee-icon-green">✓</span>
          <p>Active Employees</p>
          <strong>{activeCount}</strong>
          <span className="employee-stat-note">In current results</span>
        </article>

        <article className="employee-stat-card">
          <span className="employee-stat-icon employee-icon-orange">Ⅱ</span>
          <p>Inactive Employees</p>
          <strong>{inactiveCount}</strong>
          <span className="employee-stat-note">In current results</span>
        </article>

        <article className="employee-stat-card">
          <span className="employee-stat-icon employee-icon-purple">₹</span>
          <p>Total Listed Salary</p>
          <strong className="employee-salary-total">
            {formatCurrency(totalSalary)}
          </strong>
          <span className="employee-stat-note">Sum of current results</span>
        </article>
      </section>

      <section className="employee-table-card">
        <div className="employee-table-heading">
          <div>
            <h2>Employee Directory</h2>
            <p>Search and filter employee records using the backend API.</p>
          </div>

          <span className="employee-result-count">
            {employees.length} employees
          </span>
        </div>

        <form className="employee-filters" onSubmit={applyFilters}>
          <label className="employee-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              name="name"
              placeholder="Search employee name..."
              aria-label="Search employee name"
              value={filters.name}
              onChange={handleFilterChange}
            />
          </label>

          <select
            name="department"
            aria-label="Filter by department"
            value={filters.department}
            onChange={handleFilterChange}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <select
            name="designation"
            aria-label="Filter by designation"
            value={filters.designation}
            onChange={handleFilterChange}
          >
            <option value="">All designations</option>
            {designations.map((designation) => (
              <option key={designation} value={designation}>
                {designation}
              </option>
            ))}
          </select>

          <select
            name="role"
            aria-label="Filter by user role"
            value={filters.role}
            onChange={handleFilterChange}
          >
            <option value="">All user roles</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="HR">HR</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select
            name="employee_status"
            aria-label="Filter by employment status"
            value={filters.employee_status}
            onChange={handleFilterChange}
          >
            <option value="">All employment statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select
            name="attendance_status"
            aria-label="Filter by attendance status"
            value={filters.attendance_status}
            onChange={handleFilterChange}
          >
            <option value="">All attendance statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="HALF_DAY">Half day</option>
          </select>

          {/* NEW: Performance rating filter */}
          <select
            name="performance_rating"
            aria-label="Filter by performance rating"
            value={filters.performance_rating}
            onChange={handleFilterChange}
          >
            <option value="">All performance ratings</option>
            <option value="1">1 Star</option>
            <option value="2">2 Stars</option>
            <option value="3">3 Stars</option>
            <option value="4">4 Stars</option>
            <option value="5">5 Stars</option>
          </select>

          <button
            type="submit"
            className="employee-primary-button"
            disabled={filtering || loading}
          >
            {filtering ? "Searching..." : "Apply Filters"}
          </button>

          <button
            type="button"
            className="employee-refresh-button"
            onClick={loadEmployees}
            disabled={loading || filtering}
          >
            ↻ Refresh All
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              className="employee-cancel-button"
              onClick={clearFilters}
              disabled={filtering}
            >
              Clear Filters
            </button>
          )}
        </form>

        <p className="employee-stat-note">
          {hasAppliedFilters
            ? "Showing results for the last applied filters."
            : "Showing all employee records."}
        </p>

        {loading || filtering ? (
          <div className="employee-empty-state">
            <span className="employee-loading-spinner" />
            <p>
              {filtering ? "Applying filters..." : "Loading employees..."}
            </p>
          </div>
        ) : employees.length === 0 ? (
          <div className="employee-empty-state">
            <span className="employee-empty-icon">⌕</span>
            <h3>No employees found</h3>
            <p>Try different search terms or clear the filters.</p>
            <button
              type="button"
              className="employee-cancel-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="employee-table-scroll">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>DEPARTMENT</th>
                  <th>JOINING DATE</th>
                  <th>SALARY</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => {
                  const isActive =
                    String(employee.status || "").toUpperCase() === "ACTIVE";

                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="employee-identity">
                          <span className="employee-avatar">
                            {(employee.full_name || "?")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                          <div>
                            <strong>{employee.full_name}</strong>
                            <span>
                              EMP-{String(employee.id).padStart(3, "0")}
                            </span>
                            <small>{employee.designation}</small>
                          </div>
                        </div>
                      </td>

                      <td>{employee.department}</td>
                      <td>{formatDate(employee.joining_date)}</td>
                      <td>{formatCurrency(employee.salary)}</td>

                      <td>
                        <span
                          className={`employee-status ${
                            isActive
                              ? "employee-status-active"
                              : "employee-status-inactive"
                          }`}
                        >
                          <span />
                          {employee.status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="employee-edit-button"
                          onClick={() => openEditForm(employee)}
                          aria-label={`Edit ${employee.full_name}`}
                        >
                          ✎ Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="employee-table-footer">
          <span>Showing {employees.length} employee records</span>
          <span>WorkSphere HRMS</span>
        </div>
      </section>

      {showForm && (
        <div
          className="employee-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="employee-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-title"
          >
            <div className="employee-modal-heading">
              <div>
                <p className="employees-eyebrow">
                  {editingEmployee ? "UPDATE RECORD" : "NEW RECORD"}
                </p>
                <h2 id="employee-form-title">
                  {editingEmployee ? "Edit Employee" : "Add Employee"}
                </h2>
                <p>Enter the employee information below.</p>
              </div>

              <button
                type="button"
                className="employee-modal-close"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="employee-alert employee-alert-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {!editingEmployee && (
                <div className="employee-form-field">
                  <label htmlFor="user_id">
                    Linked User ID{" "}
                    <span className="employee-optional">(optional)</span>
                  </label>
                  <input
                    id="user_id"
                    name="user_id"
                    type="number"
                    min="1"
                    step="1"
                    value={form.user_id}
                    onChange={handleChange}
                    placeholder="Link an existing user account"
                  />
                  <small>
                    Leave blank if the employee does not have a linked account
                    yet.
                  </small>
                </div>
              )}

              <div className="employee-form-grid">
                <div className="employee-form-field">
                  <label htmlFor="full_name">Full Name *</label>
                  <input
                    id="full_name"
                    name="full_name"
                    value={form.full_name}
                    onChange={handleChange}
                    minLength="2"
                    maxLength="100"
                    required
                    placeholder="Enter full name"
                  />
                </div>

                <div className="employee-form-field">
                  <label htmlFor="designation">Designation *</label>
                  <input
                    id="designation"
                    name="designation"
                    value={form.designation}
                    onChange={handleChange}
                    minLength="2"
                    maxLength="100"
                    required
                    placeholder="e.g. Software Engineer"
                  />
                </div>

                <div className="employee-form-field">
                  <label htmlFor="department">Department *</label>
                  <input
                    id="department"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    minLength="2"
                    maxLength="100"
                    required
                    list="employee-departments"
                    placeholder="e.g. Engineering"
                  />
                  <datalist id="employee-departments">
                    {departments.map((department) => (
                      <option key={department} value={department} />
                    ))}
                  </datalist>
                </div>

                <div className="employee-form-field">
                  <label htmlFor="joining_date">Joining Date *</label>
                  <input
                    id="joining_date"
                    name="joining_date"
                    type="date"
                    value={form.joining_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="employee-form-field">
                  <label htmlFor="salary">Salary (₹) *</label>
                  <input
                    id="salary"
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.salary}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="employee-form-field">
                  <label htmlFor="status">Employment Status *</label>
                  <select
                    id="status"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    required
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="employee-modal-actions">
                <button
                  type="button"
                  className="employee-cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="employee-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingEmployee
                      ? "Save Changes"
                      : "Add Employee"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default Employees;
