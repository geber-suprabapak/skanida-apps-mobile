import * as React from "react";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Platform, Pressable } from "react-native";

const buttonVariants = cva(
  cn(
    "group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none",
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    }),
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary active:bg-primary/90 shadow-sm shadow-black/5",
          Platform.select({ web: "hover:bg-primary/90" }),
        ),
        destructive: cn(
          "bg-destructive active:bg-destructive/90 dark:bg-destructive/60 shadow-sm shadow-black/5",
          Platform.select({
            web: "hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
          }),
        ),
        outline: cn(
          "border-border bg-background active:bg-accent dark:bg-input/30 dark:border-input dark:active:bg-input/50 border shadow-sm shadow-black/5",
          Platform.select({
            web: "hover:bg-accent dark:hover:bg-input/50",
          }),
        ),
        secondary: cn(
          "bg-secondary active:bg-secondary/80 shadow-sm shadow-black/5",
          Platform.select({ web: "hover:bg-secondary/80" }),
        ),
        ghost: cn(
          "active:bg-accent dark:active:bg-accent/50",
          Platform.select({ web: "hover:bg-accent dark:hover:bg-accent/50" }),
        ),
        link: "",
      },
      size: {
        default: cn(
          "min-h-12 px-4 py-2",
          Platform.select({ web: "has-[>svg]:px-3" }),
        ),
        sm: cn(
          "min-h-12 gap-1.5 rounded-md px-3",
          Platform.select({ web: "has-[>svg]:px-2.5" }),
        ),
        lg: cn(
          "min-h-12 rounded-md px-6",
          Platform.select({ web: "has-[>svg]:px-4" }),
        ),
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva(
  cn(
    "text-foreground text-sm font-medium",
    Platform.select({ web: "pointer-events-none transition-colors" }),
  ),
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        destructive: "text-white",
        outline: cn(
          "group-active:text-accent-foreground",
          Platform.select({ web: "group-hover:text-accent-foreground" }),
        ),
        secondary: "text-secondary-foreground",
        ghost: "group-active:text-accent-foreground",
        link: cn(
          "text-primary group-active:underline",
          Platform.select({
            web: "underline-offset-4 hover:underline group-hover:underline",
          }),
        ),
      },
      size: {
        default: "",
        sm: "",
        lg: "",
        icon: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(({ className, variant, size, ...props }, ref) => {
  const rippleConfig = Platform.select({
    android: {
      color:
        variant === "destructive"
          ? "rgba(255, 255, 255, 0.2)"
          : variant === "default"
            ? "rgba(255, 255, 255, 0.2)"
            : "rgba(0, 0, 0, 0.12)",
      borderless: false,
    },
    default: undefined,
  });

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        ref={ref}
        className={cn(
          props.disabled && "opacity-50",
          buttonVariants({ variant, size }),
          className,
        )}
        role="button"
        accessibilityRole={props.accessibilityRole ?? "button"}
        hitSlop={props.hitSlop ?? { top: 4, bottom: 4, left: 4, right: 4 }}
        android_ripple={props.android_ripple ?? rippleConfig}
        {...props}
      />
    </TextClassContext.Provider>
  );
});

Button.displayName = "Button";

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
