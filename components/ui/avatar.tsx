import * as React from "react";
import { Image, View, Text } from "react-native";

import { cn } from "~/lib/utils";
import { Icon } from "~/components/ui/icon";
import { UserRound } from "lucide-react-native";

interface AvatarProps {
  className?: string;
  fallback?: string;
  source?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const Avatar = React.forwardRef<React.ElementRef<typeof View>, AvatarProps>(
  ({ className, fallback, source, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-48 w-48",
      xl: "h-64 w-64",
    };

    const iconSizeClasses = {
      sm: "size-4",
      md: "size-5",
      lg: "size-12",
      xl: "size-16",
    } as const;

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
            {fallback ? (
              <Text
                className={`font-medium text-muted-foreground ${size === "lg" || size === "xl" ? "text-3xl" : "text-sm"}`}
              >
                {fallback}
              </Text>
            ) : (
              <Icon
                as={UserRound}
                className={cn(
                  "text-muted-foreground/80",
                  iconSizeClasses[size],
                )}
              />
            )}
          </View>
        )}
      </View>
    );
  },
);

Avatar.displayName = "Avatar";

export { Avatar };
export type { AvatarProps };
