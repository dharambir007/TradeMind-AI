import { motion as Motion } from "framer-motion";

const SettingsFab = ({ isMobile, onOpen }) => {
  return (
    <Motion.button
      onClick={onOpen}
      whileHover={{ y: -2, scale: 1.06, boxShadow: "0 12px 40px rgba(99,102,241,0.4)" }}
      whileTap={{ scale: 0.95 }}
      style={{
        position: "fixed",
        bottom: isMobile ? "76px" : "24px",
        right: "24px",
        width: "44px",
        height: "44px",
        borderRadius: "12px",
        background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "#fff",
        cursor: "pointer",
        boxShadow: "0 8px 30px rgba(99,102,241,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
      }}
      title="Settings"
    >
      <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </Motion.button>
  );
};

export default SettingsFab;
