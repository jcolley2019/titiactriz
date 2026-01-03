import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg shadow-soft hover:shadow-card rounded-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg rounded-sm",
        outline:
          "border border-input bg-background hover:bg-accent/10 hover:text-accent hover:border-accent/50 hover:shadow-md rounded-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md rounded-sm",
        ghost: "hover:bg-accent/10 hover:text-accent rounded-sm",
        link: "text-accent underline-offset-4 hover:underline hover:text-accent/80",
        // Cosmic editorial variants
        editorial:
          "bg-cream text-charcoal hover:bg-cream/90 shadow-card hover:shadow-elevated hover:shadow-lg tracking-[0.15em] uppercase text-xs font-sans font-medium rounded-none",
        "editorial-outline":
          "border border-foreground/30 bg-transparent text-foreground hover:bg-foreground/5 hover:border-accent hover:text-accent hover:shadow-md tracking-[0.15em] uppercase text-xs font-sans font-medium rounded-none",
        gold: 
          "bg-accent text-accent-foreground hover:bg-accent/90 shadow-soft hover:shadow-glow hover:shadow-lg tracking-[0.15em] uppercase text-xs font-sans font-medium rounded-none",
        "gold-outline":
          "border border-accent/50 bg-transparent text-accent hover:bg-accent/10 hover:border-accent hover:shadow-md tracking-[0.15em] uppercase text-xs font-sans font-medium rounded-none",
        cosmic:
          "relative bg-transparent border border-foreground/20 text-foreground hover:border-accent hover:text-accent hover:shadow-md tracking-[0.2em] uppercase text-xs font-sans font-medium rounded-none overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-accent/10 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700",
        blush:
          "bg-secondary text-foreground hover:bg-secondary/80 shadow-soft hover:shadow-md rounded-sm",
        subtle:
          "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:shadow-sm rounded-sm",
      },
      size: {
        default: "h-12 px-8 py-3",
        sm: "h-10 px-5 text-xs",
        lg: "h-14 px-10 py-4",
        xl: "h-16 px-12 py-5 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
