import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft hover:shadow-card rounded-lg",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-lg",
        link: "text-primary underline-offset-4 hover:underline",
        // Custom editorial variants
        editorial:
          "bg-foreground text-background hover:bg-foreground/90 shadow-soft hover:shadow-card hover:scale-[1.02] rounded-lg",
        "editorial-outline":
          "border-2 border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background hover:scale-[1.02] rounded-lg",
        gold: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-soft hover:shadow-lg hover:shadow-accent/20 hover:scale-[1.02] rounded-lg",
        "gold-outline":
          "border border-accent bg-transparent text-accent hover:bg-accent hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02] rounded-lg",
        blush:
          "bg-secondary text-foreground hover:bg-blush-deep shadow-soft rounded-lg",
        subtle:
          "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-lg",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 py-3 text-base",
        xl: "h-14 px-10 py-4 text-base font-semibold",
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
