import * as React from "react";
import { View } from "react-native";

export function SafeAreaView({
  children,
  ...props
}: React.PropsWithChildren<object>) {
  return <View {...props}>{children}</View>;
}
