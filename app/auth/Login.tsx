import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import useAuthStore from "../../store/authStore";
import { supabase } from "../../utils/supabase";
import { useColorScheme } from "~/lib/useColorScheme";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { H1, P, H3 } from "~/components/ui/typography";
import { cn } from "~/lib/utils";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const { isDarkColorScheme } = useColorScheme();

  const handleLogin = async () => {
    setEmailError(false);
    setPasswordError(false);

    let hasError = false;
    if (!email) {
      setEmailError(true);
      hasError = true;
    }
    if (!password) {
      setPasswordError(true);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase login error:", error.message); // Keep console log for debugging
        alert("Login failed. Please check your email and password."); // Set user-facing error message
        return;
      }

      if (data?.user) {
        setUser(data.user);
        router.replace("/Dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen name="auth/Login" options={{ headerShown: false }} />
      <SafeAreaView
        className="flex-1 pt-10 bg-background"
        edges={["top", "left", "right"]}
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 pb-6 bg-white">
          <View>
            <H1 className="mb-2 text-center text-foreground">Selamat Datang</H1>
          </View>

          <View>
            <P className="text-center mb-8 text-muted-foreground">
              Masuk ke akun Anda untuk melanjutkan
            </P>
          </View>

          <View>
            <View className="mb-4">
              <Text className="mb-2 text-foreground">Email</Text>
              <Input
                className={cn(emailError && "border-red-500")}
                placeholder="Masukkan email Anda"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError(false);
                }}
              />
            </View>
          </View>

          <View>
            <View className="mb-6">
              <Text className="mb-2 text-foreground">Password</Text>
              <Input
                className={cn(passwordError && "border-red-500")}
                placeholder="Masukkan password Anda"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError(false);
                }}
              />
            </View>
          </View>

          <View>
            <Button
              variant="default"
              size="lg"
              className={`mb-4 w-full ${isDarkColorScheme ? "bg-white" : "bg-black"}`}
              onPress={handleLogin}
              disabled={loading}
            >
              <H3
                className={`font-medium text-center ${isDarkColorScheme ? "text-black" : "text-white"}`}
              >
                {loading ? "Loading..." : "Masuk"}
              </H3>
            </Button>
          </View>

          <View>
            <View className="flex-row justify-center mt-4">
              <Text className="text-muted-foreground">
                Belum memiliki akun?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/auth/Register")}>
                <Text className="font-semibold text-foreground">Daftar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
