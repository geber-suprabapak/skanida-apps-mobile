import { render } from "@testing-library/react-native";
import * as React from "react";
import { View } from "react-native";
import type { LucideIcon, LucideProps } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";

// SAFETY: TestIcon satisfies the LucideIcon interface for testing.
const TestIcon = (({ size, ...props }: LucideProps) => (
  <View
    {...props}
    style={[
      props.style,
      size !== undefined ? { height: size, width: size } : undefined,
    ]}
  />
)) as LucideIcon;

describe("Icon", () => {
  it("renders a Lucide icon at the documented default size", async () => {
    const { getByTestId } = await render(
      <Icon as={TestIcon} testID="default-icon" />,
    );

    expect(getByTestId("default-icon").props.style).toEqual([
      undefined,
      { height: 14, width: 14 },
    ]);
  });

  it("preserves an explicit icon-size override", async () => {
    const { getByTestId } = await render(
      <Icon as={TestIcon} size={20} testID="sized-icon" />,
    );

    expect(getByTestId("sized-icon").props.style).toEqual([
      undefined,
      { height: 20, width: 20 },
    ]);
  });

  it("maps a UniWind size utility when no size prop is explicit", async () => {
    const { getByTestId } = await render(
      <Icon as={TestIcon} className="size-5" testID="class-sized-icon" />,
    );

    expect(getByTestId("class-sized-icon").props.style).toEqual([
      undefined,
      { height: 20, width: 20 },
    ]);
  });
});
