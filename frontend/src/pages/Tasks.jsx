
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import "./Tasks.css";

function getRole() {
  return (
    sessionStorage.getItem("user_role") ||
    localStorage.getItem("user_role") ||
    ""
  ).toUpperCase();
}

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || "Invalid input").join(", ");
  }

  return detail || "Something went wrong. Please try again.";
}

const emptyForm = {
  title: "",
  description: "",
  assigned_to: "",
  priority: "MEDIUM",
  due_date: "",
};

export default function Tasks() {
  const role = getRole();
  const canManage = ["HR", "ADMIN"].includes(role);

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        canManage ? "/tasks/" : "/tasks/me"
      );
      setTasks(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  const loadEmployees = useCallback(async () => {
    if (!canManage) return;

    try {
      const response = await api.get("/employees/");
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];

      setEmployees(data.filter(
        (employee) => employee.status === "ACTIVE"
      ));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [canManage]);

  useEffect(() => {
    loadTasks();
    loadEmployees();
  }, [loadTasks, loadEmployees]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim() || !form.assigned_to || !form.due_date) {
      setError("Enter a title, employee, and due date.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/tasks/", {
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: Number(form.assigned_to),
        priority: form.priority,
        due_date: form.due_date,
      });

      setForm(emptyForm);
      setSuccess("Task assigned successfully.");
      await loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    setError("");
    setSuccess("");

    try {
      await api.patch(`/tasks/${taskId}/status`, {
        status: newStatus,
      });

      setSuccess("Task status updated.");
      await loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDelete(taskId) {
    if (!window.confirm("Delete this task permanently?")) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/tasks/${taskId}`);
      setSuccess("Task deleted.");
      await loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function isOverdue(task) {
    return (
      task.status !== "COMPLETED" &&
      task.due_date < new Date().toLocaleDateString("en-CA")
    );
  }

  const completedCount = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;

  return (
    <div className="tasks-page">
      <header className="tasks-header">
        <div>
          <p className="tasks-eyebrow">WORKSPHERE HRMS</p>
          <h1>Task Assignment &amp; Tracking</h1>
          <p>Assign work, manage deadlines, and track progress.</p>
        </div>

        <button
          type="button"
          className="tasks-refresh"
          onClick={loadTasks}
        >
          Refresh
        </button>
      </header>

      <section className="tasks-summary">
        <article className="tasks-summary-card">
          <span>Total tasks</span>
          <strong>{tasks.length}</strong>
        </article>
        <article className="tasks-summary-card">
          <span>In progress</span>
          <strong>
            {tasks.filter((task) => task.status === "IN_PROGRESS").length}
          </strong>
        </article>
        <article className="tasks-summary-card">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </article>
        <article className="tasks-summary-card">
          <span>Overdue</span>
          <strong>{tasks.filter(isOverdue).length}</strong>
        </article>
      </section>

      {error && <div className="tasks-alert tasks-error">{error}</div>}
      {success && (
        <div className="tasks-alert tasks-success">{success}</div>
      )}

      {canManage && (
        <section className="tasks-panel">
          <h2>Assign a new task</h2>

          <form className="tasks-form" onSubmit={handleCreate}>
            <label>
              Task title
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                minLength={3}
                maxLength={200}
                required
                placeholder="Enter task title"
              />
            </label>

            <label>
              Assign to employee
              <select
                name="assigned_to"
                value={form.assigned_to}
                onChange={handleChange}
                required
              >
                <option value="">Select an employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name} — ID {employee.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>

            <label>
              Due date
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
                required
              />
            </label>

            <label className="tasks-full-width">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                maxLength={5000}
                placeholder="Describe the task..."
              />
            </label>

            <button
              type="submit"
              className="tasks-submit tasks-full-width"
              disabled={saving}
            >
              {saving ? "Assigning..." : "Assign Task"}
            </button>
          </form>
        </section>
      )}

      <section className="tasks-list-section">
        <h2>{canManage ? "All assigned tasks" : "My tasks"}</h2>

        {loading ? (
          <p>Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="tasks-empty">No tasks available yet.</p>
        ) : (
          <div className="tasks-list">
            {tasks.map((task) => (
              <article className="task-card" key={task.id}>
                <div className="task-card-heading">
                  <div>
                    <span className={`task-priority ${task.priority.toLowerCase()}`}>
                      {task.priority} PRIORITY
                    </span>
                    <h3>{task.title}</h3>
                  </div>

                  {isOverdue(task) && (
                    <span className="task-overdue">OVERDUE</span>
                  )}
                </div>

                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}

                <div className="task-details">
                  <span>Employee ID: {task.assigned_to}</span>
                  <span>Due: {task.due_date}</span>
                  <span>Status: {task.status.replace("_", " ")}</span>
                </div>

                <div className="task-actions">
                  <label>
                    Update status
                    <select
                      value={task.status}
                      onChange={(event) =>
                        handleStatusChange(task.id, event.target.value)
                      }
                    >
                      <option value="TODO">To do</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </label>

                  {canManage && (
                    <button
                      type="button"
                      className="task-delete"
                      onClick={() => handleDelete(task.id)}
                    >
                      Delete task
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
