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
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";

// Placeholder for profile picture component or logic
const ProfileAvatar = ({ user }: { user: any }) => {
  // Replace with your actual avatar logic if available (e.g., user?.avatarUrl)
  const avatarUrl = null; // Example: No avatar URL

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        className="w-20 h-20 rounded-full mb-2"
      />
    );
  }
  // Fallback Icon using View and Icon
  return (
    <View className="w-20 h-20 rounded-full mb-2 bg-primary items-center justify-center border-2 border-primary-foreground/20">
      {/* Using Ionicons as a placeholder */}
      <Ionicons name="person" size={40} color="white" />
      {/* You could also use a Text initial like your original code if preferred */}
      {/* <Text className="text-primary-foreground font-bold text-3xl">
         {user?.email?.charAt(0).toUpperCase() || 'U'}
       </Text> */}
    </View>
  );
};

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
          <View className="bg-black items-center pt-8 pb-5">
            <ProfileAvatar user={user} />
            <Text className="text-white font-semibold text-lg mb-1 native:text-xl">
              {user?.email || "test@mail.com"}
            </Text>
            <Text className="text-white text-sm native:text-base">
              {formattedTime}
            </Text>
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
                className="items-center w-[45%]" // Adjust width as needed
                onPress={navigateToCheckIn}
                activeOpacity={0.7}
              >
                <View className="w-full aspect-square bg-card rounded-lg items-center justify-center mb-2 border border-border shadow-sm">
                  <AntDesign
                    name="scan1"
                    size={48}
                    className="text-foreground"
                  />
                </View>
                <Text className="text-foreground font-semibold text-center native:text-base">
                  Presensi{"\n"}Datang
                </Text>
              </TouchableOpacity>

              {/* Presensi Pulang */}
              <TouchableOpacity
                className="items-center w-[45%]" // Adjust width as needed
                onPress={navigateToCheckOut}
                activeOpacity={0.7}
              >
                <View className="w-full aspect-square bg-card rounded-lg items-center justify-center mb-2 border border-border shadow-sm">
                  <AntDesign
                    name="scan1"
                    size={48}
                    className="text-foreground"
                  />
                </View>
                <Text className="text-foreground font-semibold text-center native:text-base">
                  Presensi{"\n"}Pulang
                </Text>
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
                  <Text className="text-white font-medium text-lg ml-3">
                    Riwayat
                  </Text>
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
                  <Text className="text-white font-medium text-lg ml-3">
                    Pengaturan
                  </Text>
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
                  <Text className="text-white font-medium text-lg ml-3">
                    Profil
                  </Text>
                </View>
              </Button>
            </View>
          </ScrollView>

          {/* --- Footer Section --- */}
          <View className="items-center py-4 bg-background border-t border-border">
            <Text className="text-foreground text-xs native:text-sm">
              Version 0.3.0
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
