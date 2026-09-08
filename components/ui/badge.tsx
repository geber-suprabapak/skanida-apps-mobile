import * as React from "react";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Platform, View, type ViewProps } from "react-native";

const badgeVariants = cva(
  cn(
    "border-border group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5",
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3",
    }),
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary border-transparent",
          Platform.select({ web: "[a&]:hover:bg-primary/90" }),
        ),
        secondary: cn(
          "bg-secondary border-transparent",
          Platform.select({ web: "[a&]:hover:bg-secondary/90" }),
        ),
        destructive: cn(
          "bg-destructive border-transparent",
          Platform.select({ web: "[a&]:hover:bg-destructive/90" }),
        ),
        outline: Platform.select({
          web: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        }),
        hadir: "border-emerald-500/30 bg-emerald-500/15",
        terlambat: "border-amber-500/30 bg-amber-500/15",
        izin: "border-slate-500/30 bg-slate-500/15",
        sakit: "border-indigo-500/30 bg-indigo-500/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const badgeTextVariants = cva("text-xs font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      destructive: "text-white",
      outline: "text-foreground",
      hadir: "text-emerald-700 dark:text-emerald-300",
      terlambat: "text-amber-700 dark:text-amber-300",
      izin: "text-slate-700 dark:text-slate-200",
      sakit: "text-indigo-700 dark:text-indigo-300",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type BadgeProps = ViewProps & {
  asChild?: boolean;
} & VariantProps<typeof badgeVariants>;

const Badge = React.forwardRef<View, BadgeProps>(
  ({ className, variant, asChild, ...props }, ref) => {
    const Component = asChild ? Slot : View;
    return (
      <TextClassContext.Provider value={badgeTextVariants({ variant })}>
        <Component
          ref={ref}
          className={cn(badgeVariants({ variant }), className)}
          {...props}
        />
      </TextClassContext.Provider>
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
