// framer motion animation presets

export const spring = { type: "spring", stiffness: 300, damping: 30 };
export const springSnappy = { type: "spring", stiffness: 400, damping: 28 };
export const easeOutExpo = { duration: 0.5, ease: [0.16, 1, 0.3, 1] };
export const easeOutQuart = { duration: 0.4, ease: [0.25, 1, 0.5, 1] };
export const easeFast = { duration: 0.2, ease: "easeOut" };

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: easeOutExpo,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: easeOutExpo,
};

export const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: easeOutExpo,
};

export const slideInRight = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: easeOutExpo,
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: easeOutQuart,
};

export const buttonHover = {
  scale: 1.02,
  y: -1,
  transition: easeFast,
};

export const buttonTap = {
  scale: 0.97,
  transition: { duration: 0.1 },
};

export const cardHover = {
  y: -2,
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

export const pulseVariants = {
  animate: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.6, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

export const counterSpring = {
  type: "spring",
  stiffness: 100,
  damping: 20,
};
