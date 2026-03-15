const LandingBackground = () => {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      <div
        style={{
          position: "absolute",
          left: "-10%",
          top: "-5%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
          animation: "orb-drift 20s ease-in-out infinite",
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "-5%",
          top: "30%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          animation: "orb-drift 25s ease-in-out infinite reverse",
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "40%",
          bottom: "-10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
          animation: "orb-drift 30s ease-in-out infinite",
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        }}
      />
    </div>
  );
};

export default LandingBackground;
