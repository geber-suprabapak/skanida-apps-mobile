import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";

import { cn } from "~/lib/utils";

const Input = React.forwardRef<
  React.ElementRef<typeof TextInput>,
  TextInputProps
>(({ className, placeholderClassName, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      className={cn(
        // Base styles to match the image (white bg, light gray border)
        "flex h-12 w-full rounded-md border border-gray-300 bg-white px-4 py-2.5",
        // Text and placeholder styles
        "text-base placeholder:text-gray-500", // Darker text, gray placeholder
        // Focus styles (darker gray border)
        "focus:border-gray-500", // Simple border change on focus
        // Native-specific styles (adjust if needed)
        "native:text-lg native:leading-[1.25]",
        // Disabled styles
        props.editable === false && "opacity-50 web:cursor-not-allowed",
        // Allow overriding with className prop (important for error state)
        className,
      )}
      placeholderClassName={cn("text-gray-500", placeholderClassName)} // Consistent placeholder color
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };
