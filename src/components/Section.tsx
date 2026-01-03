import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  background?: "default" | "muted" | "accent";
}

const Section = ({
  children,
  className,
  id,
  background = "default",
}: SectionProps) => {
  const bgClasses = {
    default: "bg-transparent",
    muted: "bg-secondary/30",
    accent: "bg-muted/50",
  };

  return (
    <section
      id={id}
      className={cn("section-padding relative z-10", bgClasses[background], className)}
    >
      <div className="container-editorial">{children}</div>
    </section>
  );
};

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

const SectionHeader = ({
  eyebrow,
  title,
  subtitle,
  centered = true,
  className,
}: SectionHeaderProps) => {
  return (
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
};

export { Section, SectionHeader };
