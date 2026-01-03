import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}

const FeatureCard = ({ title, description, icon, className }: FeatureCardProps) => {
  return (
    <div
      className={cn(
        "group p-8 rounded-2xl bg-card border border-border/50 shadow-soft hover-lift",
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-accent mb-5 group-hover:bg-accent group-hover:text-background transition-colors">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-xl text-foreground mb-3">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
};

interface LinkCardProps {
  title: string;
  description: string;
  href: string;
  image?: string;
  external?: boolean;
  className?: string;
}

const LinkCard = ({
  title,
  description,
  href,
  image,
  external = false,
  className,
}: LinkCardProps) => {
  const CardContent = () => (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-soft hover-lift",
        className
      )}
    >
      {image && (
        <div className="aspect-[16/10] overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif text-xl text-foreground">{title}</h3>
          <ArrowRight className="w-5 h-5 text-accent opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {/* Gold accent line on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        <CardContent />
      </a>
    );
  }

  return (
    <Link to={href}>
      <CardContent />
    </Link>
  );
};

interface StatCardProps {
  value: string;
  label: string;
  className?: string;
}

const StatCard = ({ value, label, className }: StatCardProps) => {
  return (
    <div
      className={cn(
        "p-6 rounded-2xl bg-card border border-border/50 shadow-soft text-center",
        className
      )}
    >
      <div className="font-serif text-3xl md:text-4xl text-accent mb-2">
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
};

interface ProductCardProps {
  name: string;
  description: string;
  image: string;
  buyLink?: string;
  learnMoreLink?: string;
  className?: string;
}

const ProductCard = ({
  name,
  description,
  image,
  buyLink = "#",
  learnMoreLink,
  className,
}: ProductCardProps) => {
  return (
    <div
      className={cn(
        "group rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden hover-lift",
        className
      )}
    >
      <div className="aspect-square overflow-hidden bg-muted">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <h3 className="font-serif text-xl text-foreground mb-2">{name}</h3>
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
        <div className="flex gap-3">
          <a
            href={buyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Buy Now
          </a>
          {learnMoreLink && (
            <a
              href={learnMoreLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground hover:border-foreground transition-colors"
            >
              Learn More
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export { FeatureCard, LinkCard, StatCard, ProductCard };
