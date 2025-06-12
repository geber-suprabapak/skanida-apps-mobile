// filepath: e:\skanida-apps-mobile\app\auth\AuthSelector.tsx
// app/login.tsx
import { useRouter, Stack } from "expo-router";
import { View, ScrollView, Image } from "react-native";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { H1, H3 } from "~/components/ui/typography";
import { useColorScheme } from "~/lib/useColorScheme";
import useThemeStore from "~/store/themeStore";

const SkanidaLogo = require("../../assets/skanida.png");

export default function LoginScreen() {
  const router = useRouter();
  const { isDarkColorScheme } = useColorScheme();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerClassName="flex-grow justify-center items-center p-6 bg-white">
        <View className="w-full max-w-md items-center">
          <Image
            source={SkanidaLogo}
            className="w-96 h-96 mb-6"
            resizeMode="contain"
          />
          <H1 className="text-5xl font-extrabold text-center mb-2 text-foreground">
            Skanida Apps
          </H1>
          <Text className="text-center mb-12 text-lg mt-4 text-muted-foreground">
            Sistem Kehadiran dan Informasi Data
          </Text>
          <Button
            variant="default"
            size="lg"
            className={`mb-5 w-full ${isDarkColorScheme ? "bg-white" : "bg-black"}`}
            onPress={() => router.push("/auth/Login")}
          >
            <H3
              className={`font-bold ${isDarkColorScheme ? "text-black" : "text-white"}`}
            >
              Masuk
            </H3>
          </Button>
          <Button
            variant="default"
            size="lg"
            className={`mb-5 w-full ${isDarkColorScheme ? "bg-white" : "bg-black"}`}
            onPress={() => router.push("/auth/Register")}
          >
            <H3
              className={`font-bold ${isDarkColorScheme ? "text-black" : "text-white"}`}
            >
              Daftar
            </H3>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
