import { render } from "@testing-library/react-native";
import { Circle } from "lucide-react-native";
import * as mockReact from "react";
import { View as mockView } from "react-native";

import { Icon } from "@/components/ui/icon";

jest.mock("lucide-react-native", () => {
  return {
    Circle: ({
      size,
      ...props
    }: { size?: number } & mockReact.ComponentProps<typeof mockView>) => {
      const MockView = mockView;

      return (
        <MockView
          {...props}
          style={[props.style, { height: size, width: size }]}
        />
      );
    },
  };
});

jest.mock("uniwind", () => ({
  withUniwind: <Props extends { className?: string; size?: number }>(
    Component: mockReact.ComponentType<Props>,
    config: {
      size: { fromClassName: string; styleProperty: string };
    },
  ) => {
    return ({ className, size, ...props }: Props) => {
      const classSize = className?.match(/size-(\d+)/)?.[1];
      const supportsClassSize =
        config.size.fromClassName === "className" &&
        config.size.styleProperty === "width";
      const mappedSize =
        supportsClassSize && classSize ? Number(classSize) * 4 : undefined;

      return (
        <Component
          {...(props as Props)}
          className={className}
          size={size ?? mappedSize}
        />
      );
    };
  },
}));

describe("Icon", () => {
  it("renders a Lucide icon at the documented default size", async () => {
    const { getByTestId } = await render(
      <Icon as={Circle} testID="default-icon" />,
    );

    expect(getByTestId("default-icon").props.style).toEqual([
      undefined,
      { height: 14, width: 14 },
    ]);
  });

  it("preserves an explicit icon-size override", async () => {
    const { getByTestId } = await render(
      <Icon as={Circle} size={20} testID="sized-icon" />,
    );

    expect(getByTestId("sized-icon").props.style).toEqual([
      undefined,
      { height: 20, width: 20 },
    ]);
  });

  it("maps a UniWind size utility when no size prop is explicit", async () => {
    const { getByTestId } = await render(
      <Icon as={Circle} className="size-5" testID="class-sized-icon" />,
    );

    expect(getByTestId("class-sized-icon").props.style).toEqual([
      undefined,
      { height: 20, width: 20 },
    ]);
  });
});
