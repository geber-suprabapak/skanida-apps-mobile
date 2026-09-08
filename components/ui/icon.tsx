import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { LucideIcon, LucideProps } from "lucide-react-native";
import * as React from "react";
import { withUniwind } from "uniwind";

type IconProps = LucideProps & {
  as: LucideIcon;
};

function IconImplementation({
  as: IconComponent,
  size = 14,
  ...props
}: IconProps) {
  return <IconComponent size={size} {...props} />;
}

const IconImpl = withUniwind(IconImplementation, {
  size: {
    fromClassName: "className",
    styleProperty: "width",
  },
  color: {
    fromClassName: "className",
    styleProperty: "color",
  },
});

function Icon({ as: IconComponent, className, size, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  return (
    <IconImpl
      as={IconComponent}
      className={cn("text-foreground", textClass, className)}
      {...(size === undefined ? {} : { size })}
      {...props}
    />
  );
}

export { Icon };
