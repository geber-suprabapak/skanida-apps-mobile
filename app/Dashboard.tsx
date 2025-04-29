// app/Dashboard.tsx
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-brand-background"}`}
        edges={["top", "left", "right"]}
      >
        <ScrollView
          className={`flex-1 pb-32 ${isDarkMode ? "dark:bg-background" : "bg-background"}`}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* User greeting and info */}
          <View
            className={`flex-row items-center p-4 mb-2 rounded-xl mx-5 mt-4 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
          >
            <View className="w-14 h-14 mr-4 flex items-center justify-center rounded-full bg-primary">
              <Text className="text-primary-foreground font-bold text-2xl">
                {user?.email?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-muted-foreground"
                }`}
              >
                Selamat datang,
              </Text>
              <Text
                className={`font-bold text-lg ${
                  isDarkMode ? "text-white" : "text-card-foreground"
                }`}
              >
                {user?.email || "Pengguna"}
              </Text>
            </View>
          </View>

          {/* Navigation buttons */}
          <View className="flex-row justify-between px-5 mb-5 space-x-3">
            <Button
              variant="default"
              size="sm"
              className={`flex-1 max-w-[105px] h-[40px] py-2 ${isDarkMode ? "bg-white" : "bg-black"}`}
              onPress={() => router.push("/attendance/AbsenceReport")}
            >
              <View className="flex-row items-center justify-center">
                <View className="mr-1">
                  <AntDesign
                    name="scan1"
                    size={16}
                    color={isDarkMode ? "black" : "white"}
                  />
                </View>
                <Text
                  className={`text-xs ${isDarkMode ? "text-black" : "text-white"}`}
                >
                  Absen
                </Text>
              </View>
            </Button>
            <Button
              variant="default"
              size="sm"
              className={`flex-1 max-w-[105px] h-[40px] py-2 ${isDarkMode ? "bg-white" : "bg-black"}`}
              onPress={() => router.push("/extra/riwayat")}
            >
              <View className="flex-row items-center justify-center">
                <View className="mr-1">
                  <MaterialIcons
                    name="history"
                    size={16}
                    color={isDarkMode ? "black" : "white"}
                  />
                </View>
                <Text
                  className={`text-xs ${isDarkMode ? "text-black" : "text-white"}`}
                >
                  Riwayat
                </Text>
              </View>
            </Button>
            <Button
              variant="default"
              size="sm"
              className={`flex-1 max-w-[105px] h-[40px] py-2 ${isDarkMode ? "bg-white" : "bg-black"}`}
              onPress={() => router.push("/extra/pengaturan")}
            >
              <View className="flex-row items-center justify-center">
                <View className="mr-1">
                  <Ionicons
                    name="settings-outline"
                    size={16}
                    color={isDarkMode ? "black" : "white"}
                  />
                </View>
                <Text
                  className={`text-xs ${isDarkMode ? "text-black" : "text-white"}`}
                >
                  Pengaturan
                </Text>
              </View>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
