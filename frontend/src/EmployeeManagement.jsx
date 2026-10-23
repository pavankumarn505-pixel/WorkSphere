
import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import "./EmployeeManagement.css";

const emptyForm = {
  full_name: "",
  designation: "",
  department: "",
  joining_date: "",
  salary: "",
  status: "ACTIVE",
  user_id: null,
};

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [nameSearch, setNameSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadEmployees() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/employees/");
      setEmployees(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const payload = {
      ...form,
      salary: Number(form.salary),
    };

    try {
      if (editingId !== null) {
        await apiRequest(`/employees/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            full_name: payload.full_name,
            designation: payload.designation,
            department: payload.department,
            joining_date: payload.joining_date,
            salary: payload.salary,
            status: payload.status,
          }),
        });

        setMessage("Employee updated successfully.");
      } else {
        await apiRequest("/employees/", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setMessage("Employee created successfully.");
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadEmployees();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleEdit(employee) {
    setEditingId(employee.id);
    setForm({
      user_id: employee.user_id,
      full_name: employee.full_name,
      designation: employee.designation,
      department: employee.department,
      joining_date: employee.joining_date,
      salary: String(employee.salary),
      status: employee.status,
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (nameSearch.trim()) {
        params.set("name", nameSearch.trim());
      }

      if (departmentSearch.trim()) {
        params.set("department", departmentSearch.trim());
      }

      const query = params.toString();
      const data = await apiRequest(
        `/employees/search${query ? `?${query}` : ""}`
      );

      setEmployees(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    setNameSearch("");
    setDepartmentSearch("");
    loadEmployees();
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  return (
    <main className="employee-page">
      <header className="employee-header">
        <div>
          <p className="eyebrow">WORKSPHERE HRMS</p>
          <h1>Employee Management</h1>
          <p className="subtitle">
            Manage your employee records in one place.
          </p>
        </div>

        <button className="secondary-button" onClick={loadEmployees}>
          Refresh
        </button>
      </header>

      <section className="employee-stats">
        <article className="stat-card">
          <span>Total Employees</span>
          <strong>{employees.length}</strong>
        </article>

        <article className="stat-card">
          <span>Active Employees</span>
          <strong>
            {employees.filter((employee) => employee.status === "ACTIVE").length}
          </strong>
        </article>

        <article className="stat-card">
          <span>Inactive Employees</span>
          <strong>
            {employees.filter((employee) => employee.status === "INACTIVE").length}
          </strong>
        </article>
      </section>

      {error && <div className="alert error-alert">{error}</div>}
      {message && <div className="alert success-alert">{message}</div>}

      <section className="panel">
        <h2>{editingId !== null ? "Update Employee" : "Add Employee"}</h2>

        <form onSubmit={handleSubmit} className="employee-form">
          <label>
            Full Name
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              minLength={2}
              maxLength={100}
              required
            />
          </label>

          <label>
            Designation
            <input
              name="designation"
              value={form.designation}
              onChange={handleChange}
              minLength={2}
              maxLength={100}
              required
            />
          </label>

          <label>
            Department
            <input
              name="department"
              value={form.department}
              onChange={handleChange}
              minLength={2}
              maxLength={100}
              required
            />
          </label>

          <label>
            Joining Date
            <input
              type="date"
              name="joining_date"
              value={form.joining_date}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Salary
            <input
              type="number"
              name="salary"
              value={form.salary}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </label>

          <label>
            Status
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              required
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button">
              {editingId !== null ? "Save Changes" : "Add Employee"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="secondary-button"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Search Employees</h2>

        <form onSubmit={handleSearch} className="search-form">
          <input
            placeholder="Employee name"
            value={nameSearch}
            onChange={(event) => setNameSearch(event.target.value)}
          />

          <input
            placeholder="Department"
            value={departmentSearch}
            onChange={(event) => setDepartmentSearch(event.target.value)}
          />

          <button type="submit" className="primary-button">
            Search
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={resetSearch}
          >
            Clear
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="table-heading">
          <h2>Employee Directory</h2>
          <span>{employees.length} record(s)</span>
        </div>

        {loading ? (
          <p className="empty-state">Loading employees...</p>
        ) : employees.length === 0 ? (
          <p className="empty-state">No employees found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Joining Date</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.id}</td>
                    <td>{employee.full_name}</td>
                    <td>{employee.designation}</td>
                    <td>{employee.department}</td>
                    <td>{employee.joining_date}</td>
                    <td>
                      ₹
                      {Number(employee.salary).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          employee.status === "ACTIVE"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {employee.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="edit-button"
                        onClick={() => handleEdit(employee)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
