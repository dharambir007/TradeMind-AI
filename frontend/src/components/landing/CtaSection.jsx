const CtaSection = () => {
  return (
    <section style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }} id="demo">
      <div
        style={{
          borderRadius: "20px",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(135deg, rgba(0,212,255,0.03) 0%, rgba(139,92,246,0.03) 100%)",
          padding: "60px 40px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "300px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)",
          }}
        />

        <p
          style={{
            display: "inline-block",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            padding: "6px 14px",
            borderRadius: "100px",
            border: "1px solid rgba(0,212,255,0.1)",
            background: "rgba(0,212,255,0.05)",
            color: "#00d4ff",
            fontWeight: 600,
            marginBottom: "20px",
          }}
        >
          Launch Offer
        </p>
        <h3 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#f0f2f5" }}>
          Ready to transform your trading?
        </h3>
        <p style={{ marginTop: "12px", fontSize: "15px", color: "#505872", maxWidth: "440px", margin: "12px auto 0" }}>
          Join thousands of traders using AI-powered signals to make smarter decisions, faster.
        </p>

        <div style={{ marginTop: "32px", display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          <a
            href="/signup"
            style={{
              padding: "14px 32px",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#fff",
              textDecoration: "none",
              background: "linear-gradient(135deg, #00d4ff, #8b5cf6)",
              boxShadow: "0 8px 30px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 14px 40px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 8px 30px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)";
            }}
          >
            Create Free Account
          </a>

          <a
            href="/login"
            style={{
              padding: "14px 32px",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 500,
              color: "#8b93a7",
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.15)";
              e.target.style.color = "#f0f2f5";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.08)";
              e.target.style.color = "#8b93a7";
            }}
          >
            Sign In
          </a>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
