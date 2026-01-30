import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface ParallaxImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  speed?: number; // 0.1 = subtle, 0.5 = strong
  direction?: "up" | "down";
  scale?: boolean;
  style?: React.CSSProperties;
}

const ParallaxImage = ({
  src,
  alt,
  className,
  containerClassName,
  speed = 0.15,
  direction = "up",
  scale = true,
  style,
}: ParallaxImageProps) => {
  const ref = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Calculate parallax offset based on direction and speed
  const yOffset = direction === "up" ? -100 * speed : 100 * speed;
  const y = useTransform(scrollYProgress, [0, 1], [yOffset, -yOffset]);
  
  // Optional subtle scale effect
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.05, 1, 1.05]);

  return (
    <div 
      ref={ref} 
      className={cn("relative overflow-hidden", containerClassName)}
    >
      <motion.img
        src={src}
        alt={alt}
        className={cn("w-full h-auto object-cover", className)}
        style={{
          y,
          scale: scale ? imageScale : 1,
          ...style,
        }}
      />
    </div>
  );
};

export default ParallaxImage;
