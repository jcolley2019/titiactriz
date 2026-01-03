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
    default: "bg-background",
    muted: "bg-muted/50",
    accent: "bg-secondary/30",
  };

  return (
    <section
      id={id}
      className={cn("section-padding", bgClasses[background], className)}
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
        "mb-12 md:mb-16",
        centered && "text-center",
        className
      )}
    >
      {eyebrow && (
        <span className="text-caps text-accent mb-3 block">{eyebrow}</span>
      )}
      <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
      <div className="gold-line max-w-32 mx-auto mt-6" />
    </div>
  );
};

export { Section, SectionHeader };
