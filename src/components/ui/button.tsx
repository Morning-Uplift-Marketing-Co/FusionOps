import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white shadow-[0_2px_12px_rgba(99,102,241,.25)] hover:-translate-y-px",
        ghost:
          "border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]",
        danger:
          "border border-[hsl(var(--destructive))/44] bg-[hsl(var(--destructive))/13] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/25]",
        success:
          "bg-[hsl(var(--success))] text-white hover:opacity-90",
      },
      size: {
        default: "px-[18px] py-[9px]",
        sm: "px-[10px] py-[6px] text-[10px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
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
