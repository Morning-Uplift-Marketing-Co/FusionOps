import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-[7px] py-[2px] text-[10px] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--primary))/18] text-[hsl(var(--primary))]",
        success: "bg-[hsl(var(--success))/18] text-[hsl(var(--success))]",
        danger: "bg-[hsl(var(--destructive))/18] text-[hsl(var(--destructive))]",
        warning: "bg-[hsl(var(--warning))/18] text-[hsl(var(--warning))]",
        muted: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
        secondary: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
