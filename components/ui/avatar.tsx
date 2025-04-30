import * as React from "react";
import { Image, View, Text } from "react-native";

import { cn } from "~/lib/utils";

interface AvatarProps {
  className?: string;
  fallback?: string;
  source?: string;
  size?: "sm" | "md" | "lg";
}

const Avatar = React.forwardRef<React.ElementRef<typeof View>, AvatarProps>(
  ({ className, fallback, source, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-16 w-16",
    };

    return (
      <View
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {source ? (
          <Image
            source={{ uri: source }}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <View className="flex h-full w-full items-center justify-center bg-muted">
            <Text className="text-sm font-medium text-muted-foreground">
              {fallback || "?"}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

Avatar.displayName = "Avatar";

export { Avatar };
export type { AvatarProps };
