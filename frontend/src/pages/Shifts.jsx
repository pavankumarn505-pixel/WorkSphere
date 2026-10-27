import { useCallback, useEffect, useState } from "react";
import api from "../api";
import "./Shifts.css";

function formatTime(time) {
  if (!time) return "-";

  // Display a backend time such as 09:00:00 as 09:00.
  return time.slice(0, 5);
}

function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [shiftForm, setShiftForm] = useState({
    name: "Morning",
    start_time: "09:00",
    end_time: "17:00",
  });

  const [assignmentForm, setAssignmentForm] = useState({
    employee_id: "",
    shift_id: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingShift, setSavingShift] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [shiftResponse, assignmentResponse, employeeResponse] =
        await Promise.all([
          api.get("/shifts/"),
          api.get("/shifts/assignments"),
          api.get("/employees/"),
        ]);

      setShifts(shiftResponse.data);
      setAssignments(assignmentResponse.data);

      // Support an employee list returned as an array or paginated object.
      const employeeData = employeeResponse.data;
      setEmployees(
        Array.isArray(employeeData)
          ? employeeData
          : employeeData.items || []
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load shift information. Check your login and backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleShiftChange(event) {
    const { name, value } = event.target;

    setShiftForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleAssignmentChange(event) {
    const { name, value } = event.target;

    setAssignmentForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleCreateShift(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (shiftForm.start_time === shiftForm.end_time) {
      setError("Shift start time and end time must be different.");
      return;
    }

    setSavingShift(true);

    try {
      await api.post("/shifts/", {
        name: shiftForm.name,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
      });

      setMessage("Shift created successfully.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to create shift."
      );
    } finally {
      setSavingShift(false);
    }
  }

  async function handleAssignShift(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!assignmentForm.employee_id || !assignmentForm.shift_id) {
      setError("Please select an employee and a shift.");
      return;
    }

    setSavingAssignment(true);

    try {
      await api.post("/shifts/assignments", {
        employee_id: Number(assignmentForm.employee_id),
        shift_id: Number(assignmentForm.shift_id),
      });

      setMessage("Shift assigned successfully.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to assign shift."
      );
    } finally {
      setSavingAssignment(false);
    }
  }

  return (
    <main className="shifts-page">
      <header className="shifts-header">
        <div>
          <p className="shifts-eyebrow">WORKFORCE MANAGEMENT</p>
          <h1>Shift Management</h1>
          <p className="shifts-subtitle">
            Create work shifts and manage employee assignments.
          </p>
        </div>

        <button
          type="button"
          className="shifts-refresh"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="shifts-alert shifts-alert-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="shifts-alert shifts-alert-success" role="status">
          {message}
        </div>
      )}

      <section className="shifts-stats">
        <article className="shifts-stat-card">
          <span>Available shifts</span>
          <strong>{shifts.length}</strong>
        </article>

        <article className="shifts-stat-card">
          <span>Active employees</span>
          <strong>
            {employees.filter(
              (employee) => employee.status === "ACTIVE"
            ).length}
          </strong>
        </article>

        <article className="shifts-stat-card">
          <span>Shift assignments</span>
          <strong>{assignments.length}</strong>
        </article>
      </section>

      <section className="shifts-forms">
        <article className="shifts-panel">
          <h2>Create a shift</h2>
          <p className="shifts-panel-description">
            Define the shift name and working hours.
          </p>

          <form onSubmit={handleCreateShift}>
            <label htmlFor="shift-name">Shift name</label>
            <select
              id="shift-name"
              name="name"
              value={shiftForm.name}
              onChange={handleShiftChange}
              required
            >
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
              <option value="Night">Night</option>
            </select>

            <div className="shifts-time-grid">
              <div>
                <label htmlFor="shift-start">Start time</label>
                <input
                  id="shift-start"
                  type="time"
                  name="start_time"
                  value={shiftForm.start_time}
                  onChange={handleShiftChange}
                  required
                />
              </div>

              <div>
                <label htmlFor="shift-end">End time</label>
                <input
                  id="shift-end"
                  type="time"
                  name="end_time"
                  value={shiftForm.end_time}
                  onChange={handleShiftChange}
                  required
                />
              </div>
            </div>

            <button
              className="shifts-primary-button"
              type="submit"
              disabled={savingShift}
            >
              {savingShift ? "Creating..." : "Create Shift"}
            </button>
          </form>
        </article>

        <article className="shifts-panel">
          <h2>Assign a shift</h2>
          <p className="shifts-panel-description">
            Choose an active employee and their shift.
          </p>

          <form onSubmit={handleAssignShift}>
            <label htmlFor="employee-select">Employee</label>
            <select
              id="employee-select"
              name="employee_id"
              value={assignmentForm.employee_id}
              onChange={handleAssignmentChange}
              required
            >
              <option value="">Select an employee</option>

              {employees
                .filter((employee) => employee.status === "ACTIVE")
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name} (ID: {employee.id})
                  </option>
                ))}
            </select>

            <label htmlFor="assigned-shift">Shift</label>
            <select
              id="assigned-shift"
              name="shift_id"
              value={assignmentForm.shift_id}
              onChange={handleAssignmentChange}
              required
            >
              <option value="">Select a shift</option>

              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({formatTime(shift.start_time)} -{" "}
                  {formatTime(shift.end_time)})
                </option>
              ))}
            </select>

            <button
              className="shifts-primary-button"
              type="submit"
              disabled={savingAssignment}
            >
              {savingAssignment ? "Assigning..." : "Assign Shift"}
            </button>
          </form>
        </article>
      </section>

      <section className="shifts-panel shifts-table-panel">
        <div className="shifts-section-heading">
          <div>
            <h2>Available shifts</h2>
            <p className="shifts-panel-description">
              Working hours configured in the system.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="shifts-empty">Loading shifts...</p>
        ) : shifts.length === 0 ? (
          <p className="shifts-empty">
            No shifts found. Create a shift to get started.
          </p>
        ) : (
          <div className="shifts-table-wrapper">
            <table className="shifts-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Shift name</th>
                  <th>Start time</th>
                  <th>End time</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td>{shift.id}</td>
                    <td>
                      <span className="shifts-name">
                        {shift.name}
                      </span>
                    </td>
                    <td>{formatTime(shift.start_time)}</td>
                    <td>{formatTime(shift.end_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="shifts-panel shifts-table-panel">
        <h2>Employee shift assignments</h2>
        <p className="shifts-panel-description">
          Review each employee's current shift.
        </p>

        {loading ? (
          <p className="shifts-empty">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <p className="shifts-empty">
            No shift assignments found.
          </p>
        ) : (
          <div className="shifts-table-wrapper">
            <table className="shifts-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Shift</th>
                  <th>Start time</th>
                  <th>End time</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.employee_name}</td>
                    <td>{assignment.employee_id}</td>
                    <td>
                      <span className="shifts-name">
                        {assignment.shift_name}
                      </span>
                    </td>
                    <td>{formatTime(assignment.start_time)}</td>
                    <td>{formatTime(assignment.end_time)}</td>
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

export default Shifts;