import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SettingsSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    if (isOpen) fetchUser();
  }, [isOpen]);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/user/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        localStorage.removeItem("token");
        navigate("/signup");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Failed to delete account");
      }
    } catch (err) {
      console.error("Delete account error:", err);
      alert("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 40,
          opacity: animateIn ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Sidebar */}
      <div
        style={{
          position: "fixed", top: 0, right: 0,
          width: "320px", height: "100vh",
          background: "rgba(8, 10, 18, 0.95)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          zIndex: 50, display: "flex", flexDirection: "column",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
          transform: animateIn ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.01em" }}>Settings</h2>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            color: "#505872", cursor: "pointer", padding: "6px", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#8b93a7"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#505872"; }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Info */}
        <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: 700, color: "#fff",
            }}>
              {user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#f0f2f5" }}>
                {user?.name?.split(" ").slice(0, 2).join(" ") || "User"}
              </p>
              <p style={{ fontSize: "12px", color: "#505872" }}>{user?.email || ""}</p>
            </div>
          </div>
        </div>

        {/* Settings Options */}
        <div style={{ flex: 1, padding: "12px 0" }}>
          <p style={{ padding: "8px 20px", fontSize: "11px", color: "#3b4260", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            Account
          </p>

          <button
            onClick={() => setShowDeleteDialog(true)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 20px", background: "transparent", border: "none",
              color: "#f43f5e", cursor: "pointer", fontSize: "13px", textAlign: "left",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(244,63,94,0.04)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Account
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p style={{ fontSize: "11px", color: "#3b4260", textAlign: "center" }}>
            TradeMind AI v1.0
          </p>
        </div>
      </div>

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteDialog(false)}
          deleting={deleting}
        />
      )}
    </>
  );
};

const DeleteConfirmDialog = ({ onConfirm, onCancel, deleting }) => {
  return (
    <>
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: "rgba(12, 16, 28, 0.95)", backdropFilter: "blur(20px)",
          borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)",
          padding: "28px", maxWidth: "380px", width: "90%",
          boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
          animation: "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Icon */}
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="20" height="20" fill="none" stroke="#f43f5e" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f0f2f5", textAlign: "center", marginBottom: "8px" }}>
            Delete Account
          </h3>
          <p style={{ fontSize: "13px", color: "#6b7394", textAlign: "center", marginBottom: "24px", lineHeight: 1.5 }}>
            This action cannot be undone. All your data will be permanently removed.
          </p>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onCancel} disabled={deleting} style={{
              flex: 1, padding: "10px", borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)",
              color: "#8b93a7", cursor: "pointer", fontSize: "13px", fontWeight: 600,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.03)"; }}
            >Cancel</button>
            <button onClick={onConfirm} disabled={deleting} style={{
              flex: 1, padding: "10px", borderRadius: "10px",
              border: "none", background: deleting ? "rgba(244,63,94,0.3)" : "#f43f5e",
              color: "#fff", cursor: deleting ? "not-allowed" : "pointer",
              fontSize: "13px", fontWeight: 600, opacity: deleting ? 0.6 : 1,
              transition: "all 0.2s ease",
              boxShadow: deleting ? "none" : "0 4px 20px rgba(244,63,94,0.25)",
            }}>
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsSidebar;
