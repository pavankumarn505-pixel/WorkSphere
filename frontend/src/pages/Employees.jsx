
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

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/employees/");
      setEmployees(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const departments = useMemo(
    () =>
      [...new Set(
        employees
          .map((employee) => employee.department)
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b)),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        [
          employee.full_name,
          employee.designation,
          employee.department,
          String(employee.id),
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const matchesDepartment =
        departmentFilter === "ALL" ||
        employee.department === departmentFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, search, departmentFilter, statusFilter]);

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
      status: employee.status ?? "ACTIVE",
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
      setError("Designation and department must contain at least 2 characters.");
      return;
    }

    if (!form.joining_date) {
      setError("Please select a joining date.");
      return;
    }

    if (!Number.isFinite(salary) || salary < 0) {
      setError("Salary must be a valid number greater than or equal to zero.");
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
    (employee) => employee.status === "ACTIVE"
  ).length;

  const inactiveCount = employees.filter(
    (employee) => employee.status === "INACTIVE"
  ).length;

  const totalSalary = employees.reduce(
    (sum, employee) => sum + (Number(employee.salary) || 0),
    0
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

        <button className="employee-primary-button" onClick={openAddForm}>
          <span aria-hidden="true">＋</span> Add Employee
        </button>
      </div>

      {error && !showForm && (
        <div className="employee-alert employee-alert-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="employee-alert employee-alert-success" role="status">
          {success}
          <button onClick={() => setSuccess("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      <section className="employee-stat-grid">
        <article className="employee-stat-card">
          <span className="employee-stat-icon">👥</span>
          <p>Total Employees</p>
          <strong>{employees.length}</strong>
          <span className="employee-stat-note">All employee records</span>
        </article>

        <article className="employee-stat-card">
          <span className="employee-stat-icon employee-icon-green">✓</span>
          <p>Active Employees</p>
          <strong>{activeCount}</strong>
          <span className="employee-stat-note">Currently active</span>
        </article>

        <article className="employee-stat-card">
          <span className="employee-stat-icon employee-icon-orange">Ⅱ</span>
          <p>Inactive Employees</p>
          <strong>{inactiveCount}</strong>
          <span className="employee-stat-note">Currently inactive</span>
        </article>

        <article className="employee-stat-card">
          <span className="employee-stat-icon employee-icon-purple">₹</span>
          <p>Total Listed Salary</p>
          <strong className="employee-salary-total">
            {totalSalary.toLocaleString("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 2,
            })}
          </strong>
          <span className="employee-stat-note">Sum of listed salaries</span>
        </article>
      </section>

      <section className="employee-table-card">
        <div className="employee-table-heading">
          <div>
            <h2>Employee Directory</h2>
            <p>Search, filter, and manage your employee records.</p>
          </div>
          <span className="employee-result-count">
            {filteredEmployees.length} shown
          </span>
        </div>

        <div className="employee-filters">
          <label className="employee-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search name, ID, designation..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option value="ALL">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <button
            type="button"
            className="employee-refresh-button"
            onClick={loadEmployees}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="employee-empty-state">
            <span className="employee-loading-spinner" />
            <p>Loading employee records...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="employee-empty-state">
            <span className="employee-empty-icon">⌕</span>
            <h3>No employees found</h3>
            <p>
              {employees.length === 0
                ? "Add your first employee to get started."
                : "Try changing your search or filter settings."}
            </p>
            {employees.length === 0 && (
              <button
                className="employee-primary-button"
                onClick={openAddForm}
              >
                Add First Employee
              </button>
            )}
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
                {filteredEmployees.map((employee) => (
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
                          <span>EMP-{String(employee.id).padStart(3, "0")}</span>
                          <small>{employee.designation}</small>
                        </div>
                      </div>
                    </td>

                    <td>{employee.department}</td>
                    <td>{formatDate(employee.joining_date)}</td>
                    <td>
                      {Number(employee.salary || 0).toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span
                        className={`employee-status ${
                          employee.status === "ACTIVE"
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="employee-table-footer">
          <span>
            Showing {filteredEmployees.length} of {employees.length} employees
          </span>
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
                <p>
                  Enter the employee information in the fields below.
                </p>
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
                    Linked User ID <span className="employee-optional">(optional)</span>
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
                    Leave blank if this employee does not need to be linked to a user yet.
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
