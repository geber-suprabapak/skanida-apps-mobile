import * as React from "react";
import { View } from "react-native";

export function SafeAreaView({
  children,
  ...props
}: React.PropsWithChildren<object>) {
  return <View {...props}>{children}</View>;
}

export const useSafeAreaInsets = () => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export function SafeAreaProvider({
  children,
  ...props
}: React.PropsWithChildren<object>) {
  return <View {...props}>{children}</View>;
}
