import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import * as mockReact from "react";
import { View as mockView } from "react-native";
import { withUniwind } from "uniwind";

import { SafeAreaView } from "@/components/ui/safe-area-view";

const MockView = mockView;

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: function MockSafeAreaView({
    children,
    ...props
  }: mockReact.PropsWithChildren<object>) {
    return <MockView {...props}>{children}</MockView>;
  },
}));

jest.mock("uniwind", () => ({
  withUniwind: jest.fn(
    <Props extends { className?: string; style?: unknown }>(
      Component: mockReact.ComponentType<Props>,
    ) => {
      function UniwindBoundSafeAreaView({ className, style, ...props }: Props) {
        const classNameStyle = className?.includes("bg-red-500")
          ? { backgroundColor: "#ef4444" }
          : undefined;

        return (
          <Component {...(props as Props)} style={[style, classNameStyle]} />
        );
      }

      return UniwindBoundSafeAreaView;
    },
  ),
}));

function collectScreenFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectScreenFiles(path);
    }

    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("SafeAreaView UniWind binding", () => {
  it("wraps the safe-area-context component with UniWind", () => {
    expect(withUniwind).toHaveBeenCalledWith(RNSafeAreaView);
  });

  it("maps className and forwards safe-area props", async () => {
    const { getByTestId } = await render(
      <SafeAreaView
        className="bg-red-500"
        edges={["top"]}
        mode="margin"
        testID="safe-area"
      >
        <MockView testID="safe-area-child" />
      </SafeAreaView>,
    );

    const safeArea = getByTestId("safe-area");

    expect(safeArea.props.style).toEqual([
      undefined,
      { backgroundColor: "#ef4444" },
    ]);
    expect(safeArea.props.edges).toEqual(["top"]);
    expect(safeArea.props.mode).toBe("margin");
    expect(getByTestId("safe-area-child")).toBeTruthy();
  });

  it("keeps app screens on the canonical SafeAreaView binding", () => {
    const appDirectory = join(process.cwd(), "app");
    const directSafeAreaImports = collectScreenFiles(appDirectory).filter(
      (file) =>
        readFileSync(file, "utf8").includes(
          'import { SafeAreaView } from "react-native-safe-area-context";',
        ),
    );

    expect(directSafeAreaImports).toEqual([]);
  });
});
