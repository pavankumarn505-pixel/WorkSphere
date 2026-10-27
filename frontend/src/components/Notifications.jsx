import { useEffect, useState, useCallback } from "react";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  // Support common token keys used by login pages.
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  });

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = getToken();

    if (!token) {
      setError("Please log in first. Your access token was not found.");
      setLoading(false);
      return;
    }

    try {
      const [listResponse, countResponse] = await Promise.all([
        fetch(`${API_URL}/notifications/`, {
          headers: requestHeaders(),
        }),
        fetch(`${API_URL}/notifications/unread-count`, {
          headers: requestHeaders(),
        }),
      ]);

      if (!listResponse.ok || !countResponse.ok) {
        if (
          listResponse.status === 401 ||
          listResponse.status === 403 ||
          countResponse.status === 401 ||
          countResponse.status === 403
        ) {
          throw new Error(
            "Authentication failed. Please log in again."
          );
        }

        throw new Error(
          "Could not load notifications. Check your backend API."
        );
      }

      const listData = await listResponse.json();
      const countData = await countResponse.json();

      setNotifications(Array.isArray(listData) ? listData : []);

      // Supports either a number or common JSON response formats.
      const count =
        typeof countData === "number"
          ? countData
          : countData.unread_count ??
            countData.count ??
            countData.unread ??
            0;

      setUnreadCount(Number(count) || 0);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the WorkSphere backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(notificationId) {
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: requestHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Unable to mark notification as read.");
      }

      await loadNotifications();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markAllAsRead() {
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/notifications/read-all`,
        {
          method: "PATCH",
          headers: requestHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Unable to mark all notifications as read.");
      }

      await loadNotifications();
    } catch (err) {
      setError(err.message);
    }
  }

  const styles = {
    page: {
      maxWidth: "1000px",
      margin: "24px auto",
      padding: "24px",
      color: "#1e293b",
      fontFamily: "Arial, sans-serif",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "12px",
      marginBottom: "24px",
    },
    button: {
      padding: "10px 14px",
      border: "none",
      borderRadius: "8px",
      background: "#2563eb",
      color: "#ffffff",
      cursor: "pointer",
      fontSize: "14px",
    },
    secondaryButton: {
      padding: "8px 12px",
      border: "1px solid #cbd5e1",
      borderRadius: "7px",
      background: "#ffffff",
      color: "#1e40af",
      cursor: "pointer",
    },
    card: {
      padding: "18px",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      marginBottom: "12px",
      background: "#ffffff",
    },
    unread: {
      background: "#eff6ff",
      borderLeft: "4px solid #2563eb",
    },
    muted: {
      color: "#64748b",
      fontSize: "13px",
    },
    message: {
      color: "#475569",
      lineHeight: 1.6,
      overflowWrap: "anywhere",
    },
    error: {
      background: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
      padding: "12px",
      borderRadius: "8px",
      marginBottom: "16px",
    },
  };

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: "0 0 8px" }}>Notifications</h1>
          <p style={styles.muted}>
            Stay updated with your WorkSphere HR activities.
          </p>
          <strong>
            {unreadCount} unread notification
            {unreadCount === 1 ? "" : "s"}
          </strong>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            style={styles.secondaryButton}
            onClick={loadNotifications}
            disabled={loading}
          >
            Refresh
          </button>

          <button
            style={styles.button}
            onClick={markAllAsRead}
            disabled={loading || unreadCount === 0}
          >
            Mark all as read
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.error} role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <div style={styles.card}>
          <h3>No notifications yet</h3>
          <p style={styles.muted}>
            New HR updates will appear here.
          </p>
        </div>
      ) : (
        notifications.map((notification) => (
          <article
            key={notification.id}
            style={{
              ...styles.card,
              ...(notification.is_read ? {} : styles.unread),
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <h3 style={{ margin: "0 0 10px" }}>
                {notification.title}
              </h3>

              <span style={styles.muted}>
                {notification.is_read ? "Read" : "Unread"}
              </span>
            </div>

            <p style={styles.message}>{notification.message}</p>

            <p style={styles.muted}>
              Type: {notification.notification_type || "SYSTEM"}
              {" · "}
              {notification.created_at
                ? new Date(notification.created_at).toLocaleString()
                : "Date unavailable"}
            </p>

            {!notification.is_read && (
              <button
                style={styles.secondaryButton}
                onClick={() => markAsRead(notification.id)}
              >
                Mark as read
              </button>
            )}
          </article>
        ))
      )}
    </main>
  );
}