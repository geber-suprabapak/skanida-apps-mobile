import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";

import { Text } from "~/components/ui/text";

const LoadingScreen = () => {
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Image
        source={require("../../assets/skanida.png")}
        style={{ width: 144, height: 144 }}
        className="w-36 h-36 mb-6"
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityLabel="Logo SMKN 2 Magelang"
      />
      <Text className="text-4xl font-bold text-foreground">SKANIDA</Text>
      <Text className="text-lg tracking-widest text-muted-foreground">
        APPS
      </Text>
    </View>
  );
};

export default LoadingScreen;
