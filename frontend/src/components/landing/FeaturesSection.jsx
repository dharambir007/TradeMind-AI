const FeaturesSection = ({ visible, features }) => {
  return (
    <section
      id="features"
      style={{ position: "relative", zIndex: 1, maxWidth: "1100px", margin: "0 auto", padding: "80px 24px 60px" }}
    >
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <p
          style={{
            display: "inline-block",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            padding: "6px 14px",
            borderRadius: "100px",
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            color: "#6b7394",
            fontWeight: 600,
          }}
        >
          Features
        </p>
        <h2
          style={{ marginTop: "16px", fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#f0f2f5" }}
        >
          Everything you need to
          <br />
          trade with clarity
        </h2>
        <p style={{ marginTop: "12px", fontSize: "15px", color: "#505872", maxWidth: "480px", margin: "12px auto 0" }}>
          Built from the ground up for traders who value precision over noise.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
        {features.map((feature, index) => (
          <div
            key={index}
            className={visible ? `animate-fade-in-up delay-${(index + 3) * 100}` : ""}
            style={{
              padding: "28px",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(255,255,255,0.015)",
              transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              cursor: "default",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${feature.accent}20`;
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = `0 20px 50px rgba(0,0,0,0.3), 0 0 50px ${feature.accent}08`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
              e.currentTarget.style.background = "rgba(255,255,255,0.015)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-50px",
                right: "-50px",
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${feature.accent}08 0%, transparent 70%)`,
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: `${feature.accent}10`,
                color: feature.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              {feature.icon}
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f0f2f5", marginBottom: "8px", letterSpacing: "-0.01em" }}>
              {feature.title}
            </h3>
            <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#6b7394" }}>{feature.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturesSection;
