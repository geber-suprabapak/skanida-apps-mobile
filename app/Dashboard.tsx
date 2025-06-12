// app/Dashboard.tsx
import {
  AntDesign,
  Ionicons,
  MaterialIcons,
  Feather, // Untuk ikon pensil
} from "@expo/vector-icons";
import { format } from "date-fns"; // Ensure installed: pnpm add date-fns
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native"; // Import useIsFocused

// Import your reusable shadcn/ui components
import { Avatar } from "~/components/ui/avatar"; // Import Avatar component
import { Button } from "~/components/ui/button";
import { H1, H2, H3, H4, Large } from "~/components/ui/typography"; // Import typography components
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { useColorScheme } from "~/lib/useColorScheme";
// Fallback profile image in case avatar_url is not available
const fallbackProfileImage = require("../assets/muflih.jpg");

// Define interface for user profile data
interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const { isDarkColorScheme, setColorScheme } = useColorScheme();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const isFocused = useIsFocused(); // Add isFocused hook

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  // Fetch profile data from the user_profiles table
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) {
        setProfileData(null); // Clear profile data if no user
        return;
      }

      try {
        // Fetching only full_name and avatar_url as those are used for display
        const { data, error } = await supabase
          .from("user_profiles")
          .select("full_name, avatar_url") // Specific fields
          .eq("user_id", user.id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // This means no profile row was found for the user_id.
            // It's not an "error" in the sense of a failed query, but rather no data.
            setProfileData(null);
          } else {
            // For other actual database errors during fetch
            console.error(
              "Dashboard: Error fetching profile data from user_profiles:",
              error.message,
            );
            setProfileData(null);
          }
        } else if (data) {
          // Successfully fetched data (which could include null for full_name or avatar_url if DB has them as null)
          setProfileData(data as UserProfile); // Cast to UserProfile; only full_name and avatar_url will be populated
        } else {
          // This case (no error, but no data) should ideally be covered by PGRST116.
          // Setting to null defensively.
          setProfileData(null);
        }
      } catch (err: any) {
        console.error(
          "Dashboard: Exception during user_profiles data fetch:",
          err.message,
        );
        setProfileData(null);
      }
    };

    if (isFocused && user) {
      // Fetch only when focused and user exists
      fetchProfileData();
    } else if (!user) {
      setProfileData(null); // Ensure profileData is cleared if user logs out
    }
  }, [user, isFocused]); // Add isFocused to dependency array

  const formattedTime = format(currentTime, "dd-MM-yyyy | HH:mm:ss");

  // Get user's display name prioritizing profile data, then falling back to metadata
  const displayName =
    profileData?.full_name || // Uses profileData.full_name if it's a truthy string
    user?.user_metadata?.name ||
    user?.email ||
    "Pengguna";

  // Get user's avatar URL from profile data or from metadata
  const avatarUrl =
    profileData?.avatar_url || user?.user_metadata?.avatar_url || null;

  // --- Navigation Handlers ---
  const navigateToCheckIn = () => router.push("/attendance/AbsenceReport"); // Adjust route if needed
  const navigateToHistory = () => router.push("/extra/riwayat");
  const navigateToSettings = () => router.push("/extra/pengaturan");
  const navigateToPerizinan = () => router.push("/perizinan/izin"); // New handler for Perizinan

  // Prevent back navigation
  useEffect(() => {
    const backAction = () => {
      // Prevent going back to login screen
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false, // Disable swipe back on iOS
        }}
      />
      {/* Apply dynamic background based on theme */}
      <SafeAreaView
        className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-white"}`}
        edges={["top"]}
      >
        {/* Main container with theme-based background */}
        <View
          className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-white"}`}
        >
          {/* --- Header Section (Black Background) --- */}
          {/* Header can stay black in both themes */}
          <View className="bg-black items-center py-5">
            {/* Reduced padding */}
            {/* Use the Avatar component from ui/avatar */}
            <View className="relative">
              <Avatar
                size="lg" // Use the 'lg' size defined in ui/avatar
                fallback={displayName.charAt(0).toUpperCase() || "?"} // Fallback initial from name instead of email
                className="mb-2" // Add margin if needed
                source={
                  avatarUrl ||
                  Image.resolveAssetSource(fallbackProfileImage).uri
                } // Use the avatar URL from profile data or metadata
              />
            </View>
            <H2 className="text-white mb-1">{displayName}</H2>
            <H3 className="text-white">{formattedTime}</H3>
          </View>

          {/* --- Content Section (Scrollable, Theme-based Background) --- */}
          <ScrollView
            className={`flex-1 px-5 pt-6 ${isDarkColorScheme ? "bg-gray-900" : "bg-white"}`} // Added theme colors
            contentContainerStyle={{ paddingBottom: 20 }} // Ensure padding at the bottom
            showsVerticalScrollIndicator={false}
          >
            {/* --- Main Action Buttons (TouchableOpacity for custom layout) --- */}
            <View className="items-center justify-center mb-8">
              {/* Presensi Datang */}
              <TouchableOpacity
                className="items-center w-[45%]"
                onPress={navigateToCheckIn}
                activeOpacity={0.7}
              >
                <View className="w-full aspect-square bg-black rounded-lg items-center justify-center mb-2 border border-border shadow-sm">
                  <AntDesign name="login" size={40} color="white" />
                </View>
                <H1
                  className={`font-semibold text-center ${isDarkColorScheme ? "text-white" : "text-black"}`}
                >
                  Presensi
                </H1>
              </TouchableOpacity>
            </View>

            <View>
              {/* Riwayat Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full justify-center bg-black mb-5"
                onPress={navigateToHistory}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="history" size={28} color="white" />
                  <Large className="text-white font-medium ml-4">Riwayat</Large>
                </View>
              </Button>

              {/* Pengaturan Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full justify-center bg-black mb-5"
                onPress={navigateToSettings}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="settings-outline" size={28} color="white" />
                  <Large className="text-white font-medium ml-4">
                    Pengaturan
                  </Large>
                </View>
              </Button>

              {/* Perizinan Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full justify-center bg-black mb-5"
                onPress={navigateToPerizinan}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="assignment" size={28} color="white" />
                  <Large className="text-white font-medium ml-4">
                    Perizinan
                  </Large>
                </View>
              </Button>
            </View>
          </ScrollView>

          {/* --- Footer Section with theme colors --- */}
          <View
            className={`items-start px-5 py-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-background border-border"
            } border-t`}
          >
            <H4
              className={isDarkColorScheme ? "text-white" : "text-foreground"}
            >
              Version 0.4.0
            </H4>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
