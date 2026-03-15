const HeroSection = ({ visible, heroRef, stats }) => {
  return (
    <header
      ref={heroRef}
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "80px 24px 40px",
        textAlign: "center",
      }}
    >
      <div
        className={visible ? "animate-fade-in-up" : ""}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 14px",
          borderRadius: "100px",
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          fontSize: "13px",
          color: "#8b93a7",
          animationDelay: "0.1s",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#10b981",
            boxShadow: "0 0 8px rgba(16,185,129,0.5)",
            animation: "pulse-glow 2s ease infinite",
          }}
        />
        Trusted by 50K+ traders worldwide
      </div>

      <h1
        className={visible ? "animate-fade-in-up delay-200" : ""}
        style={{
          marginTop: "28px",
          fontSize: "clamp(36px, 5vw, 64px)",
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: "-0.035em",
          color: "#f0f2f5",
        }}
      >
        Trade with
        <span
          style={{
            display: "block",
            background: "linear-gradient(135deg, #00d4ff 0%, #8b5cf6 50%, #f43f5e 100%)",
            backgroundSize: "200% 200%",
            animation: "gradient-shift 6s ease infinite",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          machine precision
        </span>
      </h1>

      <p
        className={visible ? "animate-fade-in-up delay-300" : ""}
        style={{
          marginTop: "20px",
          fontSize: "17px",
          lineHeight: 1.65,
          color: "#6b7394",
          maxWidth: "540px",
          margin: "20px auto 0",
        }}
      >
        AI-powered trade signals, automated risk management, and institutional-grade analytics - designed for traders who demand precision.
      </p>

      <div
        className={visible ? "animate-fade-in-up delay-400" : ""}
        style={{ marginTop: "36px", display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}
      >
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
            boxShadow:
              "0 8px 30px rgba(0,212,255,0.25), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow =
              "0 14px 40px rgba(0,212,255,0.35), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow =
              "0 8px 30px rgba(0,212,255,0.25), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)";
          }}
        >
          Start Trading Free
        </a>

        <a
          href="#features"
          style={{
            padding: "14px 32px",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: 500,
            color: "#8b93a7",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = "rgba(255,255,255,0.15)";
            e.target.style.color = "#f0f2f5";
            e.target.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = "rgba(255,255,255,0.08)";
            e.target.style.color = "#8b93a7";
            e.target.style.transform = "translateY(0)";
          }}
        >
          Watch Demo
        </a>
      </div>

      <div
        className={visible ? "animate-fade-in-up delay-500" : ""}
        style={{
          marginTop: "56px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          maxWidth: "600px",
          margin: "56px auto 0",
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            style={{
              padding: "20px 16px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.02)",
              transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
              cursor: "default",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(0,212,255,0.15)";
              e.currentTarget.style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <p
              style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                background: "linear-gradient(135deg, #f0f2f5, #8b93a7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {stat.value}
              <span style={{ fontSize: "16px", fontWeight: 500 }}>{stat.suffix}</span>
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "#505872",
                marginTop: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 500,
              }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </header>
  );
};

export default HeroSection;
