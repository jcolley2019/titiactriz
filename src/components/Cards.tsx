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
        "group p-8 bg-secondary/50 border border-border/30 hover:border-accent/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-lg hover:shadow-accent/10",
        className
      )}
    >
      {icon && (
        <div className="w-14 h-14 rounded-none bg-background/50 border border-border/50 flex items-center justify-center text-accent mb-6 group-hover:bg-accent group-hover:text-background group-hover:border-accent group-hover:scale-110 transition-all duration-500">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-xl text-foreground mb-4 group-hover:text-accent transition-colors duration-300">{title}</h3>
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
  hoverImage?: string;
  external?: boolean;
  className?: string;
  imageBackground?: "transparent" | "white";
  imageFit?: "contain" | "cover";
  hoverColor?: "accent" | "red" | "green" | "gold";
}

const LinkCard = ({
  title,
  description,
  href,
  image,
  hoverImage,
  external = false,
  className,
  imageBackground = "transparent",
  imageFit = "contain",
  hoverColor = "accent",
}: LinkCardProps) => {
  const isRed = hoverColor === "red";
  const isGreen = hoverColor === "green";
  const isGold = hoverColor === "gold";
  
  const CardContent = () => (
    <div
      className={cn(
        "group relative h-full flex flex-col overflow-hidden bg-secondary/30 border border-border/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl",
        isRed 
          ? "hover:border-red-500/50 hover:shadow-red-500/20" 
          : isGreen
          ? "hover:border-green-500/50 hover:shadow-green-500/20"
          : isGold
          ? "hover:border-accent/50 hover:shadow-accent/20"
          : "hover:border-accent/30 hover:shadow-accent/20",
        className
      )}
    >
      {image && (
        <div className={cn(
          "aspect-[4/3] overflow-hidden flex items-center justify-center relative",
          imageBackground === "white" ? "bg-white" : "bg-background/50",
          imageFit === "contain" && "p-8"
        )}>
          {/* Default image */}
          <img
            src={image}
            alt={title}
            className={cn(
              "w-full h-full transition-all duration-700 group-hover:scale-110",
              imageFit === "cover" ? "object-cover" : "object-contain",
              hoverImage 
                ? "group-hover:opacity-0" 
                : "grayscale group-hover:grayscale-0"
            )}
          />
          {/* Hover image (if provided) */}
          {hoverImage && (
            <img
              src={hoverImage}
              alt={title}
              className={cn(
                "absolute inset-0 w-full h-full transition-all duration-700 opacity-0 group-hover:opacity-100 group-hover:scale-110",
                imageFit === "cover" ? "object-cover" : "object-contain",
                imageFit === "contain" && "p-6"
              )}
            />
          )}
        </div>
      )}
      <div className="p-6 pt-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className={cn(
            "font-serif text-xl text-foreground transition-colors duration-300",
            isRed ? "group-hover:text-red-500" : isGreen ? "group-hover:text-green-500" : isGold ? "group-hover:text-gold-light" : "group-hover:text-accent"
          )}>{title}</h3>
          <ArrowRight className={cn(
            "w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300",
            isRed ? "text-red-500" : isGreen ? "text-green-500" : isGold ? "text-gold-light" : "text-accent"
          )} />
        </div>
        <p className="text-muted-foreground text-base leading-relaxed flex-1">{description}</p>
      </div>
      {/* Accent line on hover */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-1 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left",
        isRed ? "bg-red-500" : isGreen ? "bg-green-500" : isGold ? "bg-accent" : "bg-accent"
      )} />
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        <CardContent />
      </a>
    );
  }

  return (
    <Link to={href} className="block h-full">
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
