import * as React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";

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
      lg: "h-20 w-20",
      xl: "h-28 w-28",
    };

    const iconSizeClasses = {
      sm: "size-4",
      md: "size-5",
      lg: "size-8",
      xl: "size-12",
    } as const;

    const fallbackTextClasses = {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-2xl font-bold",
      xl: "text-4xl font-bold",
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
            style={{ width: "100%", height: "100%" }}
            className="h-full w-full rounded-full"
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityRole="image"
            accessibilityLabel="Foto profil"
          />
        ) : (
          <View className="flex h-full w-full items-center justify-center bg-muted">
            {fallback ? (
              <Text
                className={cn(
                  "font-medium text-muted-foreground",
                  fallbackTextClasses[size],
                )}
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
