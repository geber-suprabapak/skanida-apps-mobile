import React from "react";
import { View, Image } from "react-native";

import { Text } from "~/components/ui/text";

const LoadingScreen = () => {
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Image
        source={require("../../assets/skanida.png")}
        className="w-96 h-96 mb-6"
        resizeMode="contain"
      />
      <Text className="text-4xl font-bold text-foreground">SKANIDA</Text>
      <Text className="text-lg tracking-widest text-muted-foreground">
        APPS
      </Text>
    </View>
  );
};

export default LoadingScreen;
