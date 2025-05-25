import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";

import useAuthStore from "../store/authStore";
import { supabase } from "../utils/supabase";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Memanggil Supabase untuk cek session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.log("Terjadi error saat mengambil session:", error.message);
        }

        console.log("Session =>", session);
        if (session?.user) {
          setLoadingMessage("Session found");
          setUser(session.user);
          router.replace("/Dashboard");
          console.log("welcome back");
        } else {
          router.replace("/auth/AuthSelector");
          console.log("welcome to auth selector");
        }
      } catch (err) {
        // Tangani error tak terduga
        console.log("Error tak terduga:", err);
        setLoadingMessage("Error occurred while checking session");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser]);

  return (
    <>
      <Stack.Screen options={{ title: "Index" }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl font-bold">{loadingMessage}</Text>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    </>
  );
}
