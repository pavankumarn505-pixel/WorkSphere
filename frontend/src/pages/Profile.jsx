
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Profile.css";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Profile editing state
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  function resetPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword.length > 128) {
      setError("Your new password cannot exceed 128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Your new password must be different from your current password.");
      return;
    }

    try {
      setChangingPassword(true);

      await api.put("/employees/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      resetPasswordFields();
      setMessage("Your password was changed successfully.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to change your password. Please try again."
      );
    } finally {
      setChangingPassword(false);
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
        <p className="profile-error" role="alert">
          {error}
        </p>
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
            Manage your personal information and account security.
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

      {/* Personal and employment information */}
      <section className="profile-card">
        <div className="profile-card-heading">
          <h2>Personal &amp; Employment Details</h2>

          <span
            className={`profile-status ${
              profile.status === "ACTIVE" ? "is-active" : "is-inactive"
            }`}
          >
            {profile.status || "UNKNOWN"}
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
                    {value === null ||
                    value === undefined ||
                    value === ""
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

      {/* Change password */}
      <section className="profile-card password-card">
        <div className="profile-card-heading">
          <div>
            <h2>Change Password</h2>
            <p className="profile-subtitle">
              Keep your WorkSphere account secure.
            </p>
          </div>

          <span className="security-icon" aria-hidden="true">
            &#128274;
          </span>
        </div>

        <form
          className="profile-edit-form"
          onSubmit={handleChangePassword}
        >
          <div className="password-field">
            <label htmlFor="current-password">Current Password</label>

            <div className="password-input-wrapper">
              <input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(event.target.value)
                }
                autoComplete="current-password"
                maxLength={128}
                required
                disabled={changingPassword}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowCurrentPassword((previous) => !previous)
                }
                aria-label={
                  showCurrentPassword
                    ? "Hide current password"
                    : "Show current password"
                }
                disabled={changingPassword}
              >
                {showCurrentPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="password-field">
            <label htmlFor="new-password">New Password</label>

            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                disabled={changingPassword}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowNewPassword((previous) => !previous)
                }
                aria-label={
                  showNewPassword
                    ? "Hide new password"
                    : "Show new password"
                }
                disabled={changingPassword}
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>

            <p className="profile-field-help">
              Use at least 8 characters. Avoid reusing your current password.
            </p>
          </div>

          <div className="password-field">
            <label htmlFor="confirm-password">
              Confirm New Password
            </label>

            <div className="password-input-wrapper">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                disabled={changingPassword}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
                disabled={changingPassword}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="profile-actions">
            <button
              type="submit"
              className="profile-button profile-button-primary"
              disabled={changingPassword}
            >
              {changingPassword
                ? "Changing Password..."
                : "Change Password"}
            </button>

            <button
              type="button"
              className="profile-button profile-button-secondary"
              onClick={resetPasswordFields}
              disabled={changingPassword}
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      <p className="profile-note">
        You can update your full name and password. Contact your HR team to
        request changes to your employment information.
      </p>
    </div>
  );
}

export default Profile;
