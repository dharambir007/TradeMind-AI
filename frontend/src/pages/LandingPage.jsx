import { useRef, useState } from "react";
import LandingBackground from "../components/landing/LandingBackground";
import LandingNavbar from "../components/landing/LandingNavbar";
import HeroSection from "../components/landing/HeroSection";
import TrustedByBar from "../components/landing/TrustedByBar";
import FeaturesSection from "../components/landing/FeaturesSection";
import CtaSection from "../components/landing/CtaSection";
import LandingFooter from "../components/landing/LandingFooter";
import { LANDING_FEATURES, LANDING_STATS, LANDING_LOGOS } from "../constants/landingContent.jsx";

const LandingPage = () => {
  const [visible] = useState(true);
  const heroRef = useRef(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#06080f",
        color: "#f0f2f5",
        fontFamily: "'Inter', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <LandingBackground />
      <LandingNavbar />
      <HeroSection visible={visible} heroRef={heroRef} stats={LANDING_STATS} />
      <TrustedByBar logos={LANDING_LOGOS} />
      <FeaturesSection visible={visible} features={LANDING_FEATURES} />
      <CtaSection />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
