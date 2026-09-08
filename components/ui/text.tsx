import { cn } from "@/lib/utils";
import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText, type Role } from "react-native";

const textVariants = cva(
  cn(
    "text-foreground text-base",
    Platform.select({
      web: "select-text",
    }),
  ),
  {
    variants: {
      variant: {
        default: "",
        h1: cn(
          "text-center text-4xl font-extrabold tracking-tight",
          Platform.select({ web: "scroll-m-20 text-balance" }),
        ),
        h2: cn(
          "border-border border-b pb-2 text-3xl font-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20 first:mt-0" }),
        ),
        h3: cn(
          "text-2xl font-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20" }),
        ),
        h4: cn(
          "text-xl font-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20" }),
        ),
        p: "mt-3 leading-7 sm:mt-6",
        blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
        code: cn(
          "bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        ),
        lead: "text-muted-foreground text-xl",
        large: "text-lg font-semibold",
        small: "text-sm font-medium leading-none",
        muted: "text-muted-foreground text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps["variant"]>;

const ROLE = {
  default: undefined,
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  p: undefined,
  // SAFETY: React Native Web accepts these accessibility roles.
  blockquote: Platform.select({ web: "blockquote" as Role }),
  // SAFETY: React Native Web accepts these accessibility roles.
  code: Platform.select({ web: "code" as Role }),
  lead: undefined,
  large: undefined,
  small: undefined,
  muted: undefined,
} satisfies Partial<Record<TextVariant, Role | undefined>>;

const ARIA_LEVEL = {
  default: undefined,
  h1: "1",
  h2: "2",
  h3: "3",
  h4: "4",
  p: undefined,
  blockquote: undefined,
  code: undefined,
  lead: undefined,
  large: undefined,
  small: undefined,
  muted: undefined,
} satisfies Partial<Record<TextVariant, string | undefined>>;

const TextClassContext = React.createContext<string | undefined>(undefined);

type TextProps = React.ComponentPropsWithoutRef<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  };

const Text = React.forwardRef<RNText, TextProps>(
  ({ className, asChild = false, variant = "default", ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const Component = asChild ? Slot : RNText;
    return (
      <Component
        ref={ref}
        className={cn(textVariants({ variant }), textClass, className)}
        role={variant ? ROLE[variant] : undefined}
        aria-level={variant ? ARIA_LEVEL[variant] : undefined}
        {...props}
      />
    );
  },
);
Text.displayName = "Text";

export { Text, TextClassContext };
export type { TextProps };
