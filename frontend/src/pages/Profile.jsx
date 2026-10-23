
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Profile.css";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/employees/me/profile");

        if (!cancelled) {
          setProfile(response.data);
          setFullName(response.data.full_name || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              "Unable to load your profile. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleEdit() {
    setFullName(profile.full_name || "");
    setError("");
    setMessage("");
    setEditing(true);
  }

  function handleCancel() {
    setFullName(profile.full_name || "");
    setEditing(false);
    setError("");
    setMessage("");
  }

  async function handleSave(event) {
    event.preventDefault();

    const trimmedName = fullName.trim();

    if (trimmedName.length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Full name cannot exceed 100 characters.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await api.put("/employees/me/profile", {
        full_name: trimmedName,
      });

      setProfile((previousProfile) => ({
        ...previousProfile,
        full_name: response.data.full_name,
      }));

      setFullName(response.data.full_name);
      setEditing(false);
      setMessage("Your profile was updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to update your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <p className="profile-message">Loading your profile...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="profile-page">
        <h1>My Profile</h1>
        <p className="profile-error">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const details = [
    ["Employee ID", profile.employee_id],
    ["Full Name", profile.full_name],
    ["Email Address", profile.email],
    ["Role", profile.role],
    ["Designation", profile.designation],
    ["Department", profile.department],
    ["Joining Date", profile.joining_date],
    ["Employment Status", profile.status],
    ["Account Status", profile.is_active ? "Active" : "Inactive"],
  ];

  return (
    <div className="profile-page">
      <div className="profile-heading">
        <div>
          <p className="profile-eyebrow">EMPLOYEE SELF-SERVICE</p>
          <h1>My Profile</h1>
          <p className="profile-subtitle">
            View your personal and employment information.
          </p>
        </div>

        <div className="profile-avatar" aria-hidden="true">
          {profile.full_name?.trim().charAt(0).toUpperCase() || "U"}
        </div>
      </div>

      {message && (
        <p className="profile-success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="profile-error" role="alert">
          {error}
        </p>
      )}

      <section className="profile-card">
        <div className="profile-card-heading">
          <h2>Personal &amp; Employment Details</h2>

          <span
            className={`profile-status ${
              profile.status === "ACTIVE" ? "is-active" : "is-inactive"
            }`}
          >
            {profile.status}
          </span>
        </div>

        {editing ? (
          <form className="profile-edit-form" onSubmit={handleSave}>
            <label htmlFor="profile-full-name">Full Name</label>

            <input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              minLength={2}
              maxLength={100}
              required
              disabled={saving}
              autoComplete="name"
            />

            <p className="profile-field-help">
              You can update your name here. Other employment details are
              managed by HR.
            </p>

            <div className="profile-actions">
              <button
                type="submit"
                className="profile-button profile-button-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="profile-button profile-button-secondary"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="profile-details">
              {details.map(([label, value]) => (
                <div className="profile-detail" key={label}>
                  <span className="profile-detail-label">{label}</span>
                  <span className="profile-detail-value">
                    {value === null || value === undefined || value === ""
                      ? "Not provided"
                      : value}
                  </span>
                </div>
              ))}
            </div>

            <div className="profile-footer">
              <button
                type="button"
                className="profile-button profile-button-primary"
                onClick={handleEdit}
              >
                Edit Profile
              </button>
            </div>
          </>
        )}
      </section>

      <p className="profile-note">
        You can update your full name. Contact your HR team to request changes
        to your employment information.
      </p>
    </div>
  );
}

export default Profile;
