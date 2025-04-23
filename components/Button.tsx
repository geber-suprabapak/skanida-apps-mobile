import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, View } from "react-native"; // Added View import
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type ButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "danger";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  className?: string; // Allow passing additional Tailwind classes
  textClassName?: string; // Allow passing additional Tailwind classes for text
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  className = "",
  textClassName = "",
  leftIcon,
  rightIcon,
}) => {
  const baseClasses =
    "flex-row items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2";

  // Animation values
  const scale = useSharedValue(1);

  // Animated styles for the button
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Handle press animation
  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  const disabledClasses = "opacity-50"; // Removed cursor-not-allowed as it's web-specific

  const variantStyles = {
    primary: "bg-gray-500 focus:ring-gray-500",
    secondary: "bg-gray-200 focus:ring-gray-200",
    tertiary: "bg-gray-100 focus:ring-gray-100",
    outline: "border border-gray-500 bg-transparent focus:ring-gray-500",
    danger: "bg-brand-red focus:ring-brand-red",
  };

  const textVariantStyles = {
    primary: "text-white",
    secondary: "text-gray-700",
    tertiary: "text-gray-700",
    outline: "text-gray-700",
    danger: "text-red-600",
  };

  const sizeStyles = {
    small: "px-3 py-1.5",
    medium: "px-4 py-2",
    large: "px-6 py-3",
  };

  const textSizeStyles = {
    small: "text-sm font-medium",
    medium: "text-base font-semibold",
    large: "text-lg font-bold",
  };

  const spinnerColor =
    variant === "outline" || variant === "tertiary" || variant === "secondary"
      ? "#212121"
      : "#ffffff";

  return (
    <Animated.View style={animatedStyles}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? disabledClasses : ""} ${className}`}
        activeOpacity={0.8}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          <>
            {leftIcon && <View className="mr-2">{leftIcon}</View>}
            <Text
              className={`${textVariantStyles[variant]} ${textSizeStyles[size]} ${textClassName}`}
            >
              {children}
            </Text>
            {rightIcon && <View className="ml-2">{rightIcon}</View>}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};
