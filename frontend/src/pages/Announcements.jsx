
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import "./Announcements.css";

function getStoredRole() {
  return (
    sessionStorage.getItem("user_role") ||
    localStorage.getItem("user_role") ||
    "EMPLOYEE"
  ).toUpperCase();
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

const initialForm = {
  title: "",
  message: "",
  category: "GENERAL",
  publish_at: "",
  expires_at: "",
};

export default function Announcements() {
  const role = getStoredRole();
  const canManage = ["HR", "ADMIN"].includes(role);

  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/announcements/");
      setAnnouncements(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load announcements. Please sign in again if your session expired."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim() || !form.message.trim()) {
      setError("Please enter both a title and a message.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      category: form.category,
    };

    // Send optional dates only when entered.
    if (form.publish_at) {
      payload.publish_at = new Date(form.publish_at).toISOString();
    }

    if (form.expires_at) {
      payload.expires_at = new Date(form.expires_at).toISOString();
    }

    setSaving(true);

    try {
      await api.post("/announcements/", payload);
      setForm(initialForm);
      setSuccess("Announcement created successfully.");
      await loadAnnouncements();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to create announcement."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateAnnouncement(id) {
    const confirmed = window.confirm(
      "Deactivate this announcement?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/announcements/${id}`);
      setSuccess("Announcement deactivated.");
      await loadAnnouncements();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to deactivate announcement."
      );
    }
  }

  return (
    <main className="announcements-page">
      <header className="announcements-header">
        <div>
          <p className="announcements-eyebrow">WORKSPHERE HRMS</p>
          <h1>Internal Announcements</h1>
          <p className="announcements-subtitle">
            Stay informed about company updates, policies, and events.
          </p>
        </div>

        <button
          className="announcement-refresh"
          type="button"
          onClick={loadAnnouncements}
        >
          Refresh
        </button>
      </header>

      {error && <div className="announcement-alert error">{String(
        Array.isArray(error)
          ? error.map((item) => item.msg || JSON.stringify(item)).join(", ")
          : error
      )}</div>}

      {success && (
        <div className="announcement-alert success">{success}</div>
      )}

      {canManage && (
        <section className="announcement-panel">
          <h2>Publish an announcement</h2>

          <form onSubmit={handleSubmit} className="announcement-form">
            <label>
              Title
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={200}
                required
                placeholder="Enter announcement title"
              />
            </label>

            <label>
              Category
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                <option value="GENERAL">General</option>
                <option value="POLICY">Policy</option>
                <option value="HOLIDAY">Holiday</option>
                <option value="URGENT">Urgent</option>
                <option value="EVENT">Event</option>
              </select>
            </label>

            <label className="announcement-full-width">
              Message
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                minLength={5}
                maxLength={10000}
                rows={5}
                required
                placeholder="Write the announcement here..."
              />
            </label>

            <label>
              Publish at (optional)
              <input
                type="datetime-local"
                name="publish_at"
                value={form.publish_at}
                onChange={handleChange}
              />
            </label>

            <label>
              Expires at (optional)
              <input
                type="datetime-local"
                name="expires_at"
                value={form.expires_at}
                onChange={handleChange}
              />
            </label>

            <div className="announcement-full-width">
              <button
                className="announcement-submit"
                type="submit"
                disabled={saving}
              >
                {saving ? "Publishing..." : "Publish announcement"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="announcement-list-section">
        <div className="announcement-list-heading">
          <h2>Company updates</h2>
          <span>{announcements.length} announcement(s)</span>
        </div>

        {loading ? (
          <p className="announcement-empty">Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <p className="announcement-empty">
            No announcements available.
          </p>
        ) : (
          <div className="announcement-list">
            {announcements.map((item) => (
              <article
                className="announcement-card"
                key={item.id}
              >
                <div className="announcement-card-top">
                  <span
                    className={`announcement-category ${String(
                      item.category
                    ).toLowerCase()}`}
                  >
                    {item.category}
                  </span>

                  {canManage && (
                    <button
                      type="button"
                      className="announcement-deactivate"
                      onClick={() => deactivateAnnouncement(item.id)}
                      disabled={!item.is_active}
                    >
                      {item.is_active ? "Deactivate" : "Inactive"}
                    </button>
                  )}
                </div>

                <h3>{item.title}</h3>
                <p className="announcement-message">{item.message}</p>

                <div className="announcement-meta">
                  <span>Published: {formatDate(item.publish_at)}</span>
                  <span>
                    Expires:{" "}
                    {item.expires_at
                      ? formatDate(item.expires_at)
                      : "No expiry"}
                  </span>
                </div>

                {canManage && !item.is_active && (
                  <p className="announcement-inactive-note">
                    This announcement is inactive.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
