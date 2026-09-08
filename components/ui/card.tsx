import * as React from "react";
import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { View, type ViewProps } from "react-native";

const Card = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextClassContext.Provider value="text-card-foreground">
        <View
          ref={ref}
          className={cn(
            "bg-card border-border flex flex-col gap-6 rounded-xl border py-6 shadow-sm shadow-black/5",
            className,
          )}
          {...props}
        />
      </TextClassContext.Provider>
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn("flex flex-col gap-1.5 px-6", className)}
        {...props}
      />
    );
  },
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  React.ElementRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => {
  return (
    <Text
      ref={ref}
      role="heading"
      aria-level={3}
      className={cn("font-semibold leading-none", className)}
      {...props}
    />
  );
});
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  React.ElementRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => {
  return (
    <Text
      ref={ref}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
});
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => {
    return <View ref={ref} className={cn("px-6", className)} {...props} />;
  },
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn("flex flex-row items-center px-6", className)}
        {...props}
      />
    );
  },
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
