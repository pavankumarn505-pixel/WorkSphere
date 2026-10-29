
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import "./Onboarding.css";

function getRole() {
  return (
    localStorage.getItem("user_role") ||
    sessionStorage.getItem("user_role") ||
    ""
  ).toUpperCase();
}

function formatDate(date) {
  if (!date) return "No due date";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Onboarding() {
  const role = getRole();
  const isHRorAdmin = ["HR", "ADMIN"].includes(role);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = isHRorAdmin
        ? await api.get("/onboarding/")
        : await api.get("/onboarding/me");

      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load onboarding tasks. Please check your login and backend."
      );
    } finally {
      setLoading(false);
    }
  }, [isHRorAdmin]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === "COMPLETED").length,
    [tasks]
  );

  const pendingTasks = tasks.length - completedTasks;

  const progress = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  async function handleCreateTask(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!employeeId || Number(employeeId) <= 0) {
      setError("Enter a valid employee ID.");
      return;
    }

    if (!taskName.trim()) {
      setError("Enter an onboarding task name.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/onboarding/", {
        employee_id: Number(employeeId),
        task_name: taskName.trim(),
        due_date: dueDate || null,
      });

      setMessage("Onboarding task assigned successfully.");
      setEmployeeId("");
      setTaskName("");
      setDueDate("");

      await loadTasks();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to create the onboarding task."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(task) {
    const newStatus =
      task.status === "COMPLETED" ? "PENDING" : "COMPLETED";

    setError("");
    setMessage("");

    try {
      await api.put(`/onboarding/${task.id}/status`, {
        status: newStatus,
      });

      setMessage(`Task updated to ${newStatus}.`);
      await loadTasks();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to update this task's status."
      );
    }
  }

  return (
    <div className="onboarding-page">
      <section className="onboarding-heading">
        <div>
          <p className="onboarding-eyebrow">PEOPLE · PURPOSE · PROGRESS</p>
          <h1>Employee Onboarding</h1>
          <p className="onboarding-subtitle">
            Track onboarding activities, complete assigned tasks, and help
            every employee get started smoothly.
          </p>
        </div>

        <button
          type="button"
          className="onboarding-refresh-button"
          onClick={loadTasks}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </section>

      {error && (
        <div className="onboarding-alert onboarding-alert-error" role="alert">
          {String(error)}
        </div>
      )}

      {message && (
        <div className="onboarding-alert onboarding-alert-success" role="status">
          {message}
        </div>
      )}

      <section className="onboarding-stats">
        <article className="onboarding-stat-card">
          <span className="onboarding-stat-label">Total tasks</span>
          <strong>{tasks.length}</strong>
          <span className="onboarding-stat-note">Assigned activities</span>
        </article>

        <article className="onboarding-stat-card">
          <span className="onboarding-stat-label">Completed</span>
          <strong>{completedTasks}</strong>
          <span className="onboarding-stat-note">Finished activities</span>
        </article>

        <article className="onboarding-stat-card">
          <span className="onboarding-stat-label">Pending</span>
          <strong>{pendingTasks}</strong>
          <span className="onboarding-stat-note">Activities remaining</span>
        </article>

        <article className="onboarding-stat-card onboarding-progress-card">
          <span className="onboarding-stat-label">Overall progress</span>
          <strong>{progress}%</strong>
          <div
            className="onboarding-progress-track"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="onboarding-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="onboarding-stat-note">
            {completedTasks} of {tasks.length} tasks completed
          </span>
        </article>
      </section>

      {isHRorAdmin && (
        <section className="onboarding-panel">
          <div className="onboarding-section-heading">
            <div>
              <h2>Assign an onboarding task</h2>
              <p>Create a checklist item for an existing employee.</p>
            </div>
          </div>

          <form className="onboarding-form" onSubmit={handleCreateTask}>
            <label>
              Employee ID
              <input
                type="number"
                min="1"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="Example: 1"
                required
              />
            </label>

            <label>
              Task name
              <input
                type="text"
                minLength="2"
                maxLength="200"
                value={taskName}
                onChange={(event) => setTaskName(event.target.value)}
                placeholder="Example: Complete company orientation"
                required
              />
            </label>

            <label>
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <button
              type="submit"
              className="onboarding-primary-button"
              disabled={saving}
            >
              {saving ? "Assigning..." : "Assign task"}
            </button>
          </form>

          <p className="onboarding-form-hint">
            Use an employee ID that already exists in WorkSphere.
          </p>
        </section>
      )}

      <section className="onboarding-panel">
        <div className="onboarding-section-heading">
          <div>
            <h2>{isHRorAdmin ? "All onboarding tasks" : "My onboarding checklist"}</h2>
            <p>
              {isHRorAdmin
                ? "Review employee tasks and update their status."
                : "Complete your assigned activities as you progress."}
            </p>
          </div>
          <span className="onboarding-task-count">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        {loading ? (
          <div className="onboarding-empty-state">Loading onboarding tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="onboarding-empty-state">
            <span className="onboarding-empty-icon">✓</span>
            <h3>No onboarding tasks yet</h3>
            <p>
              {isHRorAdmin
                ? "Assign the first task using the form above."
                : "Your onboarding checklist will appear here when tasks are assigned."}
            </p>
          </div>
        ) : (
          <div className="onboarding-table-wrapper">
            <table className="onboarding-table">
              <thead>
                <tr>
                  {isHRorAdmin && <th>Employee ID</th>}
                  <th>Task</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    {isHRorAdmin && <td>#{task.employee_id}</td>}
                    <td>
                      <div className="onboarding-task-name">
                        {task.task_name}
                      </div>
                      <span className="onboarding-task-id">
                        Task #{task.id}
                      </span>
                    </td>
                    <td>{formatDate(task.due_date)}</td>
                    <td>
                      <span
                        className={`onboarding-status ${
                          task.status === "COMPLETED"
                            ? "onboarding-status-completed"
                            : "onboarding-status-pending"
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="onboarding-action-button"
                        onClick={() => handleStatusChange(task)}
                      >
                        {task.status === "COMPLETED"
                          ? "Mark pending"
                          : "Mark completed"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Onboarding;
