import * as React from "react";
import { cn } from "@/lib/utils";
import { Platform, TextInput, type TextInputProps } from "react-native";

export type InputProps = TextInputProps;

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          "border-input bg-background text-foreground flex min-h-12 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5",
          props.editable === false &&
            cn(
              "opacity-50",
              Platform.select({
                web: "disabled:pointer-events-none disabled:cursor-not-allowed",
              }),
            ),
          Platform.select({
            web: cn(
              "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            ),
            native: "placeholder:text-muted-foreground/70",
          }),
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
