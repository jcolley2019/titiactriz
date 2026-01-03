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
        "group p-8 bg-secondary/50 border border-border/30 hover:border-accent/30 transition-all duration-500",
        className
      )}
    >
      {icon && (
        <div className="w-14 h-14 rounded-none bg-background/50 border border-border/50 flex items-center justify-center text-accent mb-6 group-hover:bg-accent group-hover:text-background group-hover:border-accent transition-all duration-500">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-xl text-foreground mb-4">{title}</h3>
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
        "group relative overflow-hidden bg-secondary/30 border border-border/30 hover:border-accent/30 transition-all duration-500",
        className
      )}
    >
      {image && (
        <div className="aspect-[16/10] overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-xl text-foreground">{title}</h3>
          <ArrowRight className="w-5 h-5 text-accent opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
      {/* Accent line on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
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
        "p-8 bg-secondary/30 border border-border/30 text-center",
        className
      )}
    >
      <div className="font-serif text-4xl md:text-5xl text-accent mb-3">
        {value}
      </div>
      <div className="text-sm text-muted-foreground tracking-wide">{label}</div>
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
        "group bg-secondary/30 border border-border/30 overflow-hidden hover:border-accent/30 transition-all duration-500",
        className
      )}
    >
      <div className="aspect-square overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <h3 className="font-serif text-xl text-foreground mb-3">{name}</h3>
        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">{description}</p>
        <div className="flex gap-3">
          <a
            href={buyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center h-11 px-5 bg-accent text-accent-foreground text-xs font-medium tracking-widest uppercase hover:bg-accent/90 transition-colors"
          >
            Buy Now
          </a>
          {learnMoreLink && (
            <a
              href={learnMoreLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-11 px-5 border border-border text-muted-foreground text-xs tracking-widest uppercase hover:text-foreground hover:border-foreground transition-colors"
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
