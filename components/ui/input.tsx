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
        // Increase height from h-12 to h-14
        "flex h-14 w-full rounded-md border border-gray-300 bg-white px-4 py-2.5",
        // Increase base text size from text-base to text-lg
        "text-lg placeholder:text-gray-500", // Darker text, gray placeholder
        // Focus styles (darker gray border)
        "focus:border-gray-500", // Simple border change on focus
        // Adjust native styles if needed (e.g., native:text-xl)
        "native:text-xl native:leading-[1.25]",
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
