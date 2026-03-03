import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI crashed:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#05070e",
            color: "#f0f2f5",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "460px" }}>
            <h2 style={{ fontSize: "20px", marginBottom: "10px" }}>
              Dashboard crashed
            </h2>
            <p style={{ color: "#8b93a7", marginBottom: "16px" }}>
              A runtime error occurred. Reload to recover.
            </p>
            {this.state.error?.message && (
              <p style={{ color: "#fda4af", fontSize: "13px", marginBottom: "16px" }}>
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              style={{
                border: "none",
                borderRadius: "8px",
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: 600,
                background: "linear-gradient(135deg, #00d4ff, #8b5cf6)",
                color: "#fff",
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
