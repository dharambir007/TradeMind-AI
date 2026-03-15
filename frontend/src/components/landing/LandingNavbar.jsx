const LandingNavbar = () => {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(6, 8, 15, 0.8)",
        backdropFilter: "blur(20px) saturate(1.2)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #00d4ff, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0,212,255,0.2)",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>TM</span>
          </div>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#f0f2f5",
              letterSpacing: "-0.02em",
            }}
          >
            TradeMind
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <a
            href="/login"
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#8b93a7",
              border: "1px solid transparent",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.color = "#f0f2f5";
              e.target.style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "#8b93a7";
              e.target.style.background = "transparent";
            }}
          >
            Sign in
          </a>

          <a
            href="/signup"
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              textDecoration: "none",
              background: "linear-gradient(135deg, #00d4ff, #8b5cf6)",
              boxShadow: "0 4px 20px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow =
                "0 8px 30px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow =
                "0 4px 20px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)";
            }}
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
};

export default LandingNavbar;
