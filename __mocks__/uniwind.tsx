import * as React from "react";

type UniwindConfig = {
  size?: { fromClassName: string; styleProperty: string };
  color?: { fromClassName: string; styleProperty: string };
};

export const withUniwind = jest.fn(
  <Props extends { className?: string; size?: number; style?: unknown }>(
    Component: React.ComponentType<Props>,
    config?: UniwindConfig,
  ) => {
    return function UniwindBoundComponent({
      className,
      size,
      style,
      ...props
    }: Props) {
      const classSize = className?.match(/size-(\d+)/)?.[1];
      const supportsClassSize =
        config?.size?.fromClassName === "className" &&
        config?.size?.styleProperty === "width";
      const mappedSize =
        supportsClassSize && classSize ? Number(classSize) * 4 : undefined;

      const classNameStyle = className?.includes("bg-red-500")
        ? { backgroundColor: "#ef4444" }
        : undefined;

      // SAFETY: Props forwarding to wrapped component in test environment.
      const computedProps = { ...(props as Props), className };

      const resolvedSize = size ?? mappedSize;
      if (resolvedSize !== undefined) {
        computedProps.size = resolvedSize;
      }

      if (classNameStyle !== undefined || style !== undefined) {
        // SAFETY: Style merging with classNameStyle.
        computedProps.style = [style as object, classNameStyle];
      }

      return <Component {...computedProps} />;
    };
  },
);
