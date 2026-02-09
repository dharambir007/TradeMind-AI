const Card = ({ 
  children, 
  padding = "16px", 
  glow = false,
  style = {},
  ...props 
}) => {
  const cardStyles = {
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.04)",
    background: "rgba(255,255,255,0.015)",
    backdropFilter: "blur(12px)",
    padding,
    position: "relative",
    overflow: "hidden",
    transition: "border-color 0.25s ease, background 0.25s ease",
    ...style,
  };

  return (
    <div
      style={cardStyles}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.background = "rgba(255,255,255,0.025)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
        e.currentTarget.style.background = "rgba(255,255,255,0.015)";
      }}
      {...props}
    >
      {glow && (
        <div style={{
          position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)",
          pointerEvents: "none",
        }} />
      )}
      {children}
    </div>
  );
};

export default Card;
