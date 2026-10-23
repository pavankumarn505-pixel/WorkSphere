import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  UserCheck,
  UserX,
  Trash2,
  Users,
  ShieldCheck,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../api/axios";
import "./AdminUsers.css";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  role: "EMPLOYEE",
};

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item.loc)
          ? item.loc[item.loc.length - 1]
          : "Input";
        return `${field}: ${item.msg || "Invalid value"}`;
      })
      .join(". ");
  }

  if (error.response?.status === 401) {
    return "Your session may have expired. Please sign in again.";
  }

  if (error.response?.status === 403) {
    return "Access denied. Only administrators can manage users.";
  }

  return "Something went wrong. Please try again.";
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const currentRole = (
    sessionStorage.getItem("user_role") ||
    localStorage.getItem("user_role") ||
    ""
  ).toUpperCase();

  const currentToken =
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await api.get("/admin/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        String(user.id).includes(query) ||
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "ALL" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.is_active) ||
        (statusFilter === "INACTIVE" && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const activeCount = users.filter((user) => user.is_active).length;
  const inactiveCount = users.length - activeCount;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;

  function openCreateModal() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setFormError("");
    setNotice("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    if (!form.full_name.trim() || !form.email.trim()) {
      setFormError("Please enter the user's full name and email.");
      return;
    }

    if (!editingUser && form.password.length < 8) {
      setFormError("The password must contain at least 8 characters.");
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
    };

    setSaving(true);

    try {
      if (editingUser) {
        await api.patch(`/admin/users/${editingUser.id}`, payload);
        setNotice("User details updated successfully.");
      } else {
        await api.post("/admin/users", {
          ...payload,
          password: form.password,
        });
        setNotice("User created successfully.");
      }

      setModalOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(user) {
    const action = user.is_active ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.full_name}'s account?`
    );

    if (!confirmed) return;

    setPageError("");
    setNotice("");

    try {
      await api.patch(`/admin/users/${user.id}/status`, {
        is_active: !user.is_active,
      });
      setNotice(
        `${user.full_name}'s account was ${user.is_active ? "deactivated" : "activated"}.`
      );
      await loadUsers();
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function handleDelete(user) {
    const confirmed = window.confirm(
      `Delete ${user.full_name} (${user.email}) permanently? This action cannot be undone.`
    );

    if (!confirmed) return;

    setPageError("");
    setNotice("");

    try {
      await api.delete(`/admin/users/${user.id}`);
      setNotice(`User ${user.full_name} was deleted.`);
      await loadUsers();
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  if (!currentToken) {
    return (
      <section className="admin-users-page">
        <div className="admin-alert admin-alert-error">
          <AlertCircle size={18} />
          Please sign in to access user management.
        </div>
      </section>
    );
  }

  if (currentRole !== "ADMIN") {
    return (
      <section className="admin-users-page">
        <div className="admin-alert admin-alert-error">
          <ShieldCheck size={18} />
          Access denied. This page is available to administrators only.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-users-page">
      <div className="admin-users-heading">
        <div>
          <div className="admin-users-eyebrow">
            WORKSPHERE / ADMINISTRATION
          </div>
          <h1>User Management</h1>
          <p>Manage user accounts, access roles, and account status.</p>
        </div>

        <button
          type="button"
          className="admin-primary-button"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      {pageError && (
        <div className="admin-alert admin-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{pageError}</span>
          <button
            type="button"
            className="admin-alert-close"
            onClick={() => setPageError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {notice && (
        <div className="admin-alert admin-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            type="button"
            className="admin-alert-close"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="admin-users-stats">
        <article className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-blue">
            <Users size={21} />
          </div>
          <div>
            <span>Total users</span>
            <strong>{users.length}</strong>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-green">
            <UserCheck size={21} />
          </div>
          <div>
            <span>Active users</span>
            <strong>{activeCount}</strong>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-orange">
            <UserX size={21} />
          </div>
          <div>
            <span>Inactive users</span>
            <strong>{inactiveCount}</strong>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-purple">
            <ShieldCheck size={21} />
          </div>
          <div>
            <span>Administrators</span>
            <strong>{adminCount}</strong>
          </div>
        </article>
      </div>

      <div className="admin-users-table-card">
        <div className="admin-table-heading">
          <div>
            <h2>All users</h2>
            <p>View and manage registered WorkSphere accounts.</p>
          </div>

          <button
            type="button"
            className="admin-secondary-button"
            onClick={loadUsers}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "admin-spinning" : ""} />
            Refresh
          </button>
        </div>

        <div className="admin-users-filters">
          <label className="admin-search-box">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search name, email, or ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="ALL">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="HR">HR</option>
            <option value="EMPLOYEE">Employee</option>
          </select>

          <select
            aria-label="Filter by account status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {loading ? (
          <div className="admin-users-empty">
            <RefreshCw size={24} className="admin-spinning" />
            <p>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-users-empty">
            <Users size={30} />
            <h3>No users found</h3>
            <p>Try changing your search or filters.</p>
          </div>
        ) : (
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email address</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="admin-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isCurrentUser =
                    user.email.toLowerCase() ===
                    (
                      sessionStorage.getItem("user_email") ||
                      localStorage.getItem("user_email") ||
                      ""
                    ).toLowerCase();

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{user.full_name}</strong>
                            <span>ID: {user.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="admin-email-cell">{user.email}</td>
                      <td>
                        <span className={`admin-role-badge admin-role-${user.role.toLowerCase()}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-status-badge ${user.is_active ? "is-active" : "is-inactive"}`}
                        >
                          <span />
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="admin-icon-button"
                            title="Edit user"
                            aria-label={`Edit ${user.full_name}`}
                            onClick={() => openEditModal(user)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-button"
                            title={user.is_active ? "Deactivate user" : "Activate user"}
                            aria-label={`${user.is_active ? "Deactivate" : "Activate"} ${user.full_name}`}
                            onClick={() => handleStatusChange(user)}
                            disabled={isCurrentUser && user.is_active}
                          >
                            {user.is_active ? (
                              <UserX size={17} />
                            ) : (
                              <UserCheck size={17} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="admin-icon-button admin-delete-button"
                            title="Delete user"
                            aria-label={`Delete ${user.full_name}`}
                            onClick={() => handleDelete(user)}
                            disabled={isCurrentUser}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-table-footer">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {modalOpen && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="admin-user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-modal-title"
          >
            <div className="admin-modal-heading">
              <div>
                <span className="admin-users-eyebrow">
                  {editingUser ? "UPDATE ACCOUNT" : "NEW ACCOUNT"}
                </span>
                <h2 id="admin-user-modal-title">
                  {editingUser ? "Edit user" : "Create user"}
                </h2>
                <p>
                  {editingUser
                    ? "Update the account details and access role."
                    : "Create a new account for your WorkSphere team."}
                </p>
              </div>
              <button
                type="button"
                className="admin-icon-button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form className="admin-user-form" onSubmit={handleSubmit}>
              <label htmlFor="admin-full-name">Full name</label>
              <input
                id="admin-full-name"
                name="full_name"
                value={form.full_name}
                onChange={updateForm}
                minLength={2}
                maxLength={100}
                placeholder="Enter full name"
                required
                disabled={saving}
              />

              <label htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                name="email"
                type="email"
                value={form.email}
                onChange={updateForm}
                maxLength={255}
                placeholder="name@company.com"
                required
                disabled={saving}
              />

              {!editingUser && (
                <>
                  <label htmlFor="admin-password">Temporary password</label>
                  <input
                    id="admin-password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={updateForm}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    required
                    disabled={saving}
                  />
                </>
              )}

              <label htmlFor="admin-role">Access role</label>
              <select
                id="admin-role"
                name="role"
                value={form.role}
                onChange={updateForm}
                required
                disabled={saving}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="HR">HR</option>
                <option value="ADMIN">Admin</option>
              </select>

              {formError && (
                <div className="admin-alert admin-alert-error" role="alert">
                  <AlertCircle size={18} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingUser
                      ? "Save changes"
                      : "Create user"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default AdminUsers;
