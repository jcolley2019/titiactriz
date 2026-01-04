import { motion } from "framer-motion";
import { ReactNode } from "react";

type AnimationDirection = "up" | "down" | "left" | "right" | "none";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: AnimationDirection;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}

const getInitialPosition = (direction: AnimationDirection) => {
  const distance = 40;
  
  switch (direction) {
    case "up":
      return { opacity: 0, y: distance };
    case "down":
      return { opacity: 0, y: -distance };
    case "left":
      return { opacity: 0, x: distance };
    case "right":
      return { opacity: 0, x: -distance };
    case "none":
      return { opacity: 0, x: 0, y: 0 };
    default:
      return { opacity: 0, y: distance };
  }
};

const ScrollReveal = ({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  className = "",
  once = true,
  amount = 0.2,
}: ScrollRevealProps) => {
  const initial = getInitialPosition(direction);
  
  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Staggered children animation wrapper
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
}

export const StaggerContainer = ({
  children,
  className = "",
  staggerDelay = 0.1,
  once = true,
}: StaggerContainerProps) => {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Staggered child item
interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  direction?: AnimationDirection;
}

export const StaggerItem = ({
  children,
  className = "",
  direction = "up",
}: StaggerItemProps) => {
  const initial = getInitialPosition(direction);
  
  return (
    <motion.div
      variants={{
        hidden: initial,
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: {
            duration: 0.5,
            ease: [0.25, 0.1, 0.25, 1],
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default ScrollReveal;
