const TrustedByBar = ({ logos }) => {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        marginTop: "40px",
        padding: "24px 0",
        borderTop: "1px solid rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
        <p
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#3b4260",
            marginBottom: "16px",
            fontWeight: 500,
          }}
        >
          Integrated with leading platforms
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "48px",
            flexWrap: "wrap",
            opacity: 0.3,
          }}
        >
          {logos.map((logo, index) => (
            <span key={index} style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "0.05em", color: "#505872" }}>
              {logo}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustedByBar;
