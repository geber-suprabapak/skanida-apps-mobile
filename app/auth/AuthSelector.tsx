// app/login.tsx
import { useRouter, Stack } from "expo-router";
import React from "react";
import { View, Text, TouchableOpacity, ImageBackground } from "react-native";
import Animated, { FadeIn, SlideInUp, BounceIn } from "react-native-reanimated";

import { Button } from "~/components/Button";

export default function LoginScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require("../../assets/splash.png")}
      className="flex-1"
      resizeMode="cover"
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-1 justify-end p-6 pb-12 bg-black bg-opacity-20">
        <Animated.View entering={BounceIn.delay(300).duration(800)}>
          <Text className="text-4xl font-bold text-white text-center mb-2">
            Skanida Apps
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(600).duration(800)}>
          <Text className="text-white text-center mb-12 text-lg mt-4">
            Sistem Kehadiran dan Informasi Data
          </Text>
        </Animated.View>

        <Animated.View entering={SlideInUp.delay(800).duration(500)}>
          <Button
            variant="outline"
            size="large"
            className="mb-4 border-white mt-4"
            textClassName="text-white"
            onPress={() => router.push("/auth/Login")}
          >
            Masuk
          </Button>
        </Animated.View>

        <Animated.View entering={SlideInUp.delay(1000).duration(500)}>
          <Button
            variant="outline"
            size="large"
            className="mb-4 border-white"
            textClassName="text-white"
            onPress={() => router.push("/auth/Register")}
          >
            Daftar
          </Button>
        </Animated.View>
      </View>
    </ImageBackground>
  );
}
//test
