// app/riwayat/riwayat.tsx
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";

import PhotoViewModal from "~/components/PhotoViewModal";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

type AttendanceRecord = {
  id: string;
  date: string;
  created_at: string;
  reason: string;
  photo_url: string;
};

export default function Riwayat() {
  const user = useAuthStore((state) => state.user);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();

  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setAttendanceHistory(data || []);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Riwayat Kehadiran",
          headerStyle: {
            backgroundColor: "hsl(var(--primary))",
          },
          headerTintColor: "hsl(var(--primary-foreground))",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
      <View
        className={`flex-1 ${isDarkMode ? "dark:bg-background" : "bg-background"}`}
      >
        <ScrollView
          className={`flex-1 pb-32 ${isDarkMode ? "dark:bg-background" : "bg-background"}`}
        >
          {/* Back Button at the top of content area */}
          <TouchableOpacity
            className={`flex-row items-center mx-5 mt-4 mb-2 p-3 rounded-lg ${isDarkMode ? "bg-card" : "bg-card"}`}
            onPress={() => router.push("/Dashboard")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-back-outline"
              size={24}
              color={isDarkMode ? "#C0DAFF" : "#0066FF"}
            />
            <Text
              className={`ml-2 text-base font-medium ${isDarkMode ? "text-white" : "text-card-foreground"}`}
            >
              Kembali ke Dashboard
            </Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="hsl(var(--primary))"
              className="mt-10"
            />
          ) : attendanceHistory.length > 0 ? (
            <View className="px-5 py-4">
              {attendanceHistory.map((record) => (
                <View
                  key={record.id}
                  className={`rounded-xl p-4 mb-4 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
                >
                  <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-border">
                    <Text
                      className={`text-base font-bold ${isDarkMode ? "text-white" : "text-card-foreground"}`}
                    >
                      {record.date}
                    </Text>
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-300" : "text-muted-foreground"}`}
                    >
                      {new Date(record.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-2">
                    <View className="flex-row items-center">
                      <AntDesign name="checkcircle" size={20} color="#28a745" />
                      <Text className="text-sm ml-2 text-green-600">
                        {record.reason}
                      </Text>
                    </View>
                    {record.photo_url && (
                      <TouchableOpacity
                        className="p-1 -m-1 rounded-md"
                        onPress={() => {
                          setSelectedPhoto(record.photo_url);
                          setPhotoModalVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{ uri: record.photo_url }}
                          className="w-10 h-10 rounded-md bg-muted"
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center p-10 mt-10">
              <Ionicons
                name="document-text-outline"
                size={60}
                color="hsl(var(--muted))"
              />
              <Text
                className={`text-lg font-bold mt-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
              >
                Belum Ada Data Kehadiran
              </Text>
              <Text
                className={`text-sm mt-2 text-center ${isDarkMode ? "text-gray-300" : "text-muted-foreground/70"}`}
              >
                Riwayat kehadiran Anda akan muncul di sini
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Photo Viewing Modal */}
        <PhotoViewModal
          photoUrl={selectedPhoto}
          isVisible={photoModalVisible}
          onClose={() => {
            setPhotoModalVisible(false);
            setSelectedPhoto(null);
          }}
        />
      </View>
    </>
  );
}
