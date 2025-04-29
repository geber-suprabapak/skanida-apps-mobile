import * as React from "react";
import { Pressable, View } from "react-native";

import { Small } from "~/components/ui/typography";
import { cn } from "~/lib/utils";

const Card = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-card px-6 py-4 shadow-sm",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  React.ElementRef<typeof Small>,
  React.ComponentPropsWithoutRef<typeof Small>
>(({ className, ...props }, ref) => (
  <Small
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  React.ElementRef<typeof Small>,
  React.ComponentPropsWithoutRef<typeof Small>
>(({ className, ...props }, ref) => (
  <Small
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn("pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn("flex flex-row items-center pt-4", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

const PressableCard = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  React.ComponentPropsWithoutRef<typeof Pressable> & { disabled?: boolean }
>(({ className, disabled, ...props }, ref) => (
  <Pressable
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-card px-6 py-4 shadow-sm",
      disabled && "opacity-50",
      className,
    )}
    disabled={disabled}
    {...props}
  />
));
PressableCard.displayName = "PressableCard";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  PressableCard,
};
