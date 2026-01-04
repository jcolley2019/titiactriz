import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import ScrollReveal from "./ScrollReveal";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  background?: "default" | "muted" | "accent";
  animate?: boolean;
  animationDirection?: "up" | "down" | "left" | "right" | "none";
  animationDelay?: number;
}

const Section = ({
  children,
  className,
  id,
  background = "default",
  animate = true,
  animationDirection = "up",
  animationDelay = 0,
}: SectionProps) => {
  const bgClasses = {
    default: "bg-transparent",
    muted: "bg-secondary/30",
    accent: "bg-muted/50",
  };

  const content = (
    <section
      id={id}
      className={cn("section-padding relative z-10", bgClasses[background], className)}
    >
      <div className="container-editorial">{children}</div>
    </section>
  );

  if (!animate) {
    return content;
  }

  return (
    <ScrollReveal direction={animationDirection} delay={animationDelay}>
      {content}
    </ScrollReveal>
  );
};

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
  animate?: boolean;
}

const SectionHeader = ({
  eyebrow,
  title,
  subtitle,
  centered = true,
  className,
  animate = true,
}: SectionHeaderProps) => {
  const content = (
    <div
      className={cn(
        "mb-16 md:mb-20",
        centered && "text-center",
        className
      )}
    >
      {eyebrow && (
        <span className="text-caps text-accent mb-4 block">{eyebrow}</span>
      )}
      <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground mb-5 leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
      <div className="gold-line max-w-24 mx-auto mt-8" />
    </div>
  );

  if (!animate) {
    return content;
  }

  return (
    <ScrollReveal direction="up" delay={0.1}>
      {content}
    </ScrollReveal>
  );
};

export { Section, SectionHeader };
