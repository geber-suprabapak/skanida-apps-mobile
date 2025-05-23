import { useRouter, Stack } from "expo-router";
import React, { useState } from "react";
import {
  View,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { supabase } from "~/utils/supabase";

export default function ChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Semua kolom harus diisi");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Konfirmasi password tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password baru minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      // Re-authenticate user
      const session = await supabase.auth.getSession();
      const email = session.data.session?.user.email;
      if (!email) throw new Error("Session tidak valid");
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (loginError) {
        Alert.alert("Error", "Password lama salah");
        setLoading(false);
        return;
      }
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }
      Alert.alert("Sukses", "Password berhasil diubah", [
        { text: "OK", onPress: () => router.back() },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      Alert.alert("Error", "Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "left", "right"]}
    >
      <Stack.Screen options={{ title: "Ubah Password" }} />
      <ScrollView contentContainerClassName="flex-grow">
        <View className="flex-1 p-6 justify-center">
          <Text className="text-2xl font-bold mb-6 text-center text-foreground">
            Ubah Password
          </Text>
          <View className="mb-4">
            <Text className="mb-2 text-muted-foreground">Password Lama</Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-2.5 bg-background text-foreground"
              placeholder="Password lama"
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
          </View>
          <View className="mb-4">
            <Text className="mb-2 text-muted-foreground">Password Baru</Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-2.5 bg-background text-foreground"
              placeholder="Password baru"
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>
          <View className="mb-6">
            <Text className="mb-2 text-muted-foreground">
              Konfirmasi Password Baru
            </Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-2.5 bg-background text-foreground"
              placeholder="Konfirmasi password baru"
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>
          <Button
            variant="default"
            size="lg"
            disabled={loading}
            onPress={handleChangePassword}
            className="mb-4"
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color="hsl(var(--primary-foreground))"
                className="mr-2"
              />
            ) : null}
            <Text>Simpan</Text>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text>Batal</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
