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
        // Increase height from h-14 to h-16
        "flex h-16 w-full rounded-md border border-gray-300 bg-white px-4 py-3",
        // Increase text size from text-lg to text-xl
        "text-xl placeholder:text-gray-500", // Darker text, gray placeholder
        // Focus styles (darker gray border)
        "focus:border-gray-500", // Simple border change on focus
        // Adjust native styles if needed (e.g., native:text-xl)
        "native:text-2xl native:leading-[1.3]",
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
