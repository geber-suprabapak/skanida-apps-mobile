// app/Dashboard.tsx
import {
  AntDesign,
  Ionicons,
  MaterialIcons,
  Feather, // For profile icon
} from "@expo/vector-icons";
import { format } from "date-fns"; // Ensure installed: pnpm add date-fns
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import your reusable shadcn/ui components
import { Avatar } from "~/components/ui/avatar"; // Import Avatar component
import { Button } from "~/components/ui/button";
import { Small, H2, H3 } from "~/components/ui/typography"; // Import H2 and H3
import useAuthStore from "~/store/authStore";

// Import the icon image
const profileImage = require("../assets/logosmk.png"); // Import the new image

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const formattedTime = format(currentTime, "dd-MM-yyyy | HH:mm:ss");

  // --- Navigation Handlers ---
  const navigateToCheckIn = () => router.push("/attendance/AbsenceReport"); // Adjust route if needed
  const navigateToCheckOut = () => router.push("/attendance/AbsenceReport"); // Adjust route if needed
  const navigateToHistory = () => router.push("/extra/riwayat");
  const navigateToSettings = () => router.push("/extra/pengaturan");
  const navigateToProfile = () => router.push("/profile/EditProfile"); // Adjust route if needed

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
        {/* Main container with white background */}
        <View className="flex-1 bg-white">
          {/* --- Header Section (Black Background) --- */}
          <View className="bg-black items-center pt-28 pb-28">
            {" "}
            {/* Slightly increased top and bottom padding */}
            {/* Use the Avatar component from ui/avatar */}
            <Avatar
              size="lg" // Use the 'lg' size defined in ui/avatar
              fallback={user?.email?.charAt(0).toUpperCase() || "?"} // Fallback initial
              className="mb-2" // Add margin if needed
              source={Image.resolveAssetSource(profileImage).uri} // Use the muflih_hitam.jpg as source
            />
            <H2 className="text-white mb-1">
              {user?.email || "test@mail.com"}
            </H2>
            <H3 className="text-white">{formattedTime}</H3>
          </View>

          {/* --- Content Section (Scrollable, White Background) --- */}
          <ScrollView
            className="flex-1 px-5 pt-6" // Added padding top
            contentContainerStyle={{ paddingBottom: 20 }} // Ensure padding at the bottom
            showsVerticalScrollIndicator={false}
          >
            {/* --- Main Action Buttons (TouchableOpacity for custom layout) --- */}
            <View className="flex-row justify-around items-start mb-8">
              {/* Presensi Datang */}
              <TouchableOpacity
                className="items-center w-[40%]" // Reduced width from w-[45%]
                onPress={navigateToCheckIn}
                activeOpacity={0.7}
              >
                <View className="w-full aspect-square bg-card rounded-lg items-center justify-center mb-2 border border-border shadow-sm">
                  <AntDesign
                    name="scan1"
                    size={40} // Reduced icon size from 48
                    className="text-foreground"
                  />
                </View>
                <Small className="text-foreground font-semibold text-center native:text-base">
                  Presensi{"\n"}Datang
                </Small>
              </TouchableOpacity>

              {/* Presensi Pulang */}
              <TouchableOpacity
                className="items-center w-[40%]" // Reduced width from w-[45%]
                onPress={navigateToCheckOut}
                activeOpacity={0.7}
              >
                <View className="w-full aspect-square bg-card rounded-lg items-center justify-center mb-2 border border-border shadow-sm">
                  <AntDesign
                    name="scan1"
                    size={40} // Reduced icon size from 48
                    className="text-foreground"
                  />
                </View>
                <Small className="text-foreground font-semibold text-center native:text-base">
                  Presensi{"\n"}Pulang
                </Small>
              </TouchableOpacity>
            </View>

            {/* --- Secondary Action Buttons (Using reusable Button component) --- */}
            <View>
              {/* Riwayat Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full justify-center bg-black mb-8 h-16"
                onPress={navigateToHistory}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="history" size={24} color="white" />
                  <Small className="text-white font-medium text-lg ml-3">
                    Riwayat
                  </Small>
                </View>
              </Button>

              {/* Pengaturan Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full justify-center bg-black mb-8 h-16"
                onPress={navigateToSettings}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="settings-outline" size={24} color="white" />
                  <Small className="text-white font-medium text-lg ml-3">
                    Pengaturan
                  </Small>
                </View>
              </Button>

              {/* Profil Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full justify-center bg-black h-16"
                onPress={navigateToProfile}
              >
                <View className="flex-row items-center justify-center">
                  <Feather name="user" size={24} color="white" />
                  <Small className="text-white font-medium text-lg ml-3">
                    Profil
                  </Small>
                </View>
              </Button>
            </View>
          </ScrollView>

          {/* --- Footer Section --- */}
          <View className="items-center py-4 bg-background border-t border-border">
            <Small className="text-foreground">Version 0.3.0</Small>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
